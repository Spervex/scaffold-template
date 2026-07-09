import { execa } from 'execa';
import { RepoError } from '../types.js';
import { logger } from './logger.js';

export type GhUserInfo = {
  username: string;
};

/**
 * Verify gh CLI is installed and authenticated.
 * Returns the authenticated GitHub username.
 */
export async function checkGh(): Promise<GhUserInfo> {
  try {
    const { stdout } = await execa('gh', ['auth', 'status', '--show-token'], { stdio: 'pipe' });
    // Parse: "✓ Logged in to github.com account Spervex (keyring)" or "as Spervex"
    const match = stdout.match(/(?:account|as)\s+(\S+)/);
    if (!match || !match[1]) {
      throw new RepoError(
        "Could not detect GitHub username from gh auth status. Make sure you're logged in with `gh auth login`.",
        'GH_AUTH_PARSE_ERROR'
      );
    }
    return { username: match[1] };
  } catch (err) {
    if (err instanceof RepoError) throw err;
    throw new RepoError(
      'GitHub CLI (gh) is not installed or not authenticated. Run `gh auth login` first, or use --source-url / --public-url to specify repos manually.',
      'GH_NOT_FOUND'
    );
  }
}

export async function createGhRepo(
  name: string,
  options: { visibility: 'private' | 'public'; remoteName: string; description?: string }
): Promise<string> {
  const { visibility, remoteName, description } = options;
  logger.step(`Creating ${visibility} repo: ${name}...`);
  const args = [
    'repo',
    'create',
    name,
    `--${visibility}`,
    '--source',
    '.',
    '--remote',
    remoteName,
    '--push',
  ];
  if (description) {
    args.push('--description', description);
  }

  try {
    const { stdout } = await execa('gh', args, { stdio: 'pipe' });
    logger.success(`${visibility === 'private' ? 'Private' : 'Public'} repo created: ${name}`);
    const urlMatch = stdout.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?/);
    return urlMatch ? urlMatch[0] : `https://github.com/${name}.git`;
  } catch (err) {
    throw new RepoError(
      `Failed to create ${visibility} repo "${name}": ${(err as Error).message}`,
      'GH_CREATE_ERROR'
    );
  }
}

/**
 * Create both private and public repos for a given base name.
 * baseName is just the repo name (e.g., "my-template"), NOT including org.
 * publicSuffix is appended to the base name for the public repo (e.g., "-public").
 * Returns { sourceRepo, publicRepo, sourceUrl, publicUrl } where repo names include org.
 */
export async function createDualRepos(
  username: string,
  baseName: string,
  publicSuffix: string,
  description?: string
): Promise<{ sourceRepo: string; publicRepo: string; sourceUrl: string; publicUrl: string }> {
  const sourceRepo = `${username}/${baseName}`;
  const publicRepo = `${username}/${baseName}${publicSuffix}`;

  const fullDesc = description || `Scaffold template: ${baseName}`;
  const publicDesc = `${fullDesc} (public)`;

  const sourceUrl = await createGhRepo(sourceRepo, {
    visibility: 'private',
    remoteName: 'origin',
    description: fullDesc,
  });
  const publicUrl = await createGhRepo(publicRepo, {
    visibility: 'public',
    remoteName: 'public',
    description: publicDesc,
  });

  return { sourceRepo, publicRepo, sourceUrl, publicUrl };
}
