import { RepoError } from '../types.js';

type SemVer = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

function parseVersion(version: string): SemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new RepoError(`Invalid semver: "${version}". Expected format: X.Y.Z`, 'INVALID_VERSION');
  }
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
    prerelease: match[4],
  };
}

function formatVersion(semver: SemVer): string {
  const base = `${semver.major}.${semver.minor}.${semver.patch}`;
  return semver.prerelease ? `${base}-${semver.prerelease}` : base;
}

/**
 * Returns a version one major version behind.
 * If source is 2.0.0 → returns 1.0.0
 * If source is 1.3.0 → returns 0.3.0
 * If source is 0.x.y → returns 0.x.y (can't go negative)
 */
function lagOneMajor(version: string): string {
  const semver = parseVersion(version);
  if (semver.major <= 0) {
    return formatVersion(semver);
  }
  return formatVersion({ ...semver, major: semver.major - 1 });
}

/**
 * Apply the configured version offset to a source version.
 */
export function applyVersionOffset(
  sourceVersion: string,
  offset: 'major' | 'minor' | 'none'
): string {
  switch (offset) {
    case 'major':
      return lagOneMajor(sourceVersion);
    case 'minor':
      return lagOneMinor(sourceVersion);
    case 'none':
      return sourceVersion;
  }
}

function lagOneMinor(version: string): string {
  const semver = parseVersion(version);
  if (semver.minor <= 0) {
    return formatVersion(semver);
  }
  return formatVersion({ ...semver, minor: semver.minor - 1 });
}

/**
 * Read version from the root setup.config.json
 */
export async function readSourceVersion(baseDir: string): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const nodePath = await import('node:path');
  const configPath = nodePath.join(baseDir, 'setup.config.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (!config.version) throw new RepoError('No version found in setup.config.json', 'NO_VERSION');
    return config.version;
  } catch (err) {
    if (err instanceof RepoError) throw err;
    // File not found — caller can use initialVersion or fallback
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new RepoError(
      `Cannot read setup.config.json at ${configPath}: ${(err as Error).message}`,
      'CONFIG_READ_ERROR'
    );
  }
}
