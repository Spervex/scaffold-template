import path from 'node:path';

import { execa } from 'execa';

import { RepoError } from '../types.js';
import { getGitRoot, getStatus, hasRemote } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { getPublicExcludeList, loadFilterConfig } from '../utils/repo-filter.js';
import { applyVersionOffset, readSourceVersion } from '../utils/version.js';

export async function repoStatus(baseDir: string): Promise<void> {
  const rootDir = process.env.INIT_CWD || process.cwd();

  const gitRoot = await getGitRoot(rootDir);
  if (!gitRoot || path.resolve(gitRoot) !== path.resolve(rootDir)) {
    throw new RepoError('Not a git repository. Run "pnpm cli:dev repo init" first.', 'NOT_A_REPO');
  }

  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.header('  Dual-Repo Status');
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Remotes
  const hasOrigin = await hasRemote(rootDir, 'origin');
  const hasPublic = await hasRemote(rootDir, 'public');

  logger.info('');
  logger.info('  Remotes:');
  if (hasOrigin) {
    const { stdout: originUrl } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd: rootDir,
    });
    logger.info(`    ✓ origin → ${originUrl} (source-of-truth)`);
  } else {
    logger.warn('    ✗ origin — not configured');
  }
  if (hasPublic) {
    const { stdout: publicUrl } = await execa('git', ['remote', 'get-url', 'public'], {
      cwd: rootDir,
    });
    logger.info(`    ✓ public → ${publicUrl} (public)`);
  } else {
    logger.warn('    ✗ public — not configured');
  }

  // Current branch & status
  const status = await getStatus(rootDir);
  logger.info('');
  logger.info(`  Current branch: ${status.branch}`);
  logger.info(`  Working tree: ${status.clean ? 'clean ✓' : 'has changes ✗'}`);

  if (!status.clean) {
    if (status.modified.length > 0) {
      logger.info('  Modified:');
      for (const f of status.modified.slice(0, 10)) logger.info(`    M ${f}`);
      if (status.modified.length > 10)
        logger.info(`    ... and ${status.modified.length - 10} more`);
    }
    if (status.untracked.length > 0) {
      logger.info('  Untracked:');
      for (const f of status.untracked.slice(0, 10)) logger.info(`    ? ${f}`);
      if (status.untracked.length > 10)
        logger.info(`    ... and ${status.untracked.length - 10} more`);
    }
  }

  // Version info
  try {
    const sourceVersion = await readSourceVersion(baseDir);
    if (sourceVersion) {
      const filterConfig = await loadFilterConfig(rootDir);
      const publicVersion = applyVersionOffset(
        sourceVersion,
        filterConfig.publicRepo.versionOffset
      );
      logger.info('');
      logger.info('  Versions:');
      logger.info(`    Source-of-truth: v${sourceVersion}`);
      logger.info(
        `    Public:          v${publicVersion} (${filterConfig.publicRepo.versionOffset} offset)`
      );
    }
  } catch {
    // Version may not be configured yet
  }

  // Filter config
  try {
    const filterConfig = await loadFilterConfig(rootDir);
    const exclude = getPublicExcludeList(filterConfig);
    logger.info('');
    logger.info('  Public repo exclusion:');
    if (exclude.length > 0) {
      for (const e of exclude) logger.info(`    ✗ ${e}`);
    } else {
      logger.info('    (none configured)');
    }
  } catch {
    // Filter config may not exist
  }

  logger.info('');
  logger.info('  Commands:');
  logger.info('    pnpm cli:dev repo sync    — Sync changes to both repos');
  logger.info('    pnpm cli:dev repo init    — Reconfigure repo setup');
  logger.info('');
}
