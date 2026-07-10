import { execa } from 'execa';

import { RepoError } from '../types.js';

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
