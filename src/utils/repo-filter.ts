import fs from 'node:fs/promises';
import path from 'node:path';

import { type RepoFilterConfig } from '../types.js';
import { logger } from './logger.js';

const DEFAULT_FILTER_PATH = '.github/repo-filter.json';

const DEFAULT_FILTER_CONFIG: RepoFilterConfig = {
  version: '1.0',
  publicRepo: {
    exclude: ['core', 'src'],
    include: [],
    versionOffset: 'major',
    publicBranch: 'main',
    sourceBranch: 'main',
  },
};

export async function loadFilterConfig(baseDir: string): Promise<RepoFilterConfig> {
  const filterPath = path.join(baseDir, DEFAULT_FILTER_PATH);
  try {
    const content = await fs.readFile(filterPath, 'utf-8');
    const parsed = JSON.parse(content) as RepoFilterConfig;
    return {
      ...DEFAULT_FILTER_CONFIG,
      ...parsed,
      publicRepo: { ...DEFAULT_FILTER_CONFIG.publicRepo, ...parsed.publicRepo },
    };
  } catch {
    logger.warn(`No filter config found at ${filterPath}, using defaults`);
    return structuredClone(DEFAULT_FILTER_CONFIG);
  }
}

export async function saveFilterConfig(baseDir: string, config: RepoFilterConfig): Promise<void> {
  const filterPath = path.join(baseDir, DEFAULT_FILTER_PATH);
  await fs.mkdir(path.dirname(filterPath), { recursive: true });
  await fs.writeFile(filterPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  logger.success(`Filter config saved to ${filterPath}`);
}

function isExcluded(relativePath: string, excludePatterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return excludePatterns.some((pattern) => {
    // Exact match of a top-level dir/file
    if (parts[0] === pattern) return true;
    // Match if the pattern is the start of the path
    if (normalized === pattern || normalized.startsWith(pattern + '/')) return true;
    return false;
  });
}

export function filterFilesForPublic(trackedFiles: string[], excludePatterns: string[]): string[] {
  return trackedFiles.filter((file) => !isExcluded(file, excludePatterns));
}

export function getPublicExcludeList(config: RepoFilterConfig): string[] {
  return config.publicRepo.exclude;
}
