import path from 'node:path';
import readline from 'node:readline';

import { execa } from 'execa';

import { isKebabCase } from '../tui-helpers.js';
import { RepoError, type RepoInitOptions } from '../types.js';
import { checkGh } from '../utils/gh.js';
import {
  addRemote,
  commit,
  getGitRoot,
  hasRemote,
  initRepo,
  push,
  removeRemote,
  stageAll,
} from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { assertSubpath } from '../utils/path-safe.js';
import { saveFilterConfig } from '../utils/repo-filter.js';
import { readSourceVersion } from '../utils/version.js';

async function hasStagedChanges(dir: string): Promise<boolean> {
  try {
    await execa('git', ['diff', '--cached', '--quiet'], { cwd: dir, stdio: 'pipe' });
    return false; // exit code 0 = no changes
  } catch {
    return true; // exit code 1 = has changes
  }
}

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askYesNo(query: string, defaultYes: boolean): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${query} (${hint}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) {
        resolve(defaultYes);
        return;
      }
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

function validateGitHubUrl(url: string): boolean {
  // Accept: https://github.com/owner/repo, git@github.com:owner/repo, owner/repo
  const patterns = [
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/,
    /^git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?$/,
    /^[\w.-]+\/[\w.-]+$/,
  ];
  return patterns.some((p) => p.test(url));
}

function normalizeGitHubUrl(url: string): string {
  // If just owner/repo, convert to HTTPS URL
  if (/^[\w.-]+\/[\w.-]+$/.test(url) && !url.includes('://') && !url.includes('@')) {
    return `https://github.com/${url}.git`;
  }
  return url;
}

async function resolveRepoUrl(prompt: string, defaultUrl: string): Promise<string> {
  let url = await ask(prompt);
  if (!url) url = defaultUrl;
  url = normalizeGitHubUrl(url);
  if (!validateGitHubUrl(url)) {
    logger.warn(
      'Invalid GitHub URL format. Expected: owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo'
    );
    return resolveRepoUrl(prompt, defaultUrl);
  }
  return url;
}

async function resolveSourceVersion(options: RepoInitOptions, baseDir: string): Promise<string> {
  return options.initialVersion ?? (await readSourceVersion(baseDir)) ?? '1.0.0';
}

export async function repoInit(options: RepoInitOptions, baseDir: string): Promise<void> {
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.header('  Initialize Dual-Repo Setup');
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');

  const yesMode = options.yes;
  const rootDir = options.dir ? path.resolve(options.dir) : process.env.INIT_CWD || process.cwd();
  if (options.dir) {
    assertSubpath(process.cwd(), rootDir);
  }

  // Determine which flow to use: auto-setup (name provided) or explicit URLs (sourceUrl provided)
  const useAutoSetup = !!options.name && !options.sourceUrl;

  // ── Resolve repo URLs ──────────────────────────────────

  let sourceUrl: string;
  let publicUrl: string;
  let sourceRepoDisplay: string;
  let publicRepoDisplay: string;

  if (useAutoSetup) {
    // ── Auto-setup via gh CLI ──────────────────────────
    const baseName = options.name!;
    const publicSuffix = options.publicSuffix;

    // 1. Validate name is kebab-case
    if (!isKebabCase(baseName)) {
      throw new RepoError(
        `Invalid repo name "${baseName}". Must be kebab-case (lowercase letters, numbers, hyphens, cannot start/end with hyphen).`,
        'INVALID_NAME'
      );
    }

    // 2. Check gh is installed and get username
    const { username } = await checkGh();
    const fullSourceName = `${username}/${baseName}`;
    const fullPublicName = `${username}/${baseName}${publicSuffix}`;
    sourceRepoDisplay = fullSourceName;
    publicRepoDisplay = fullPublicName;

    // 3. Confirm
    logger.info('');
    logger.info(`  Detected GitHub user: ${username}`);
    logger.info('  Will create:');
    logger.info(`    🔒 ${fullSourceName}  (private, source-of-truth)`);
    logger.info(`    🌍 ${fullPublicName}  (public, filtered + version lag)`);
    logger.info(`  ─ Exclude folders: ${options.exclude.join(', ')}`);
    logger.info('');

    if (!yesMode) {
      const confirmed = await askYesNo('Proceed with creating these repos?', true);
      if (!confirmed) {
        logger.info('Aborted.');
        return;
      }
    }

    // 4. Check if already a git repo (warn if has remotes)
    const gitRoot = await getGitRoot(rootDir);
    const alreadyRepo = gitRoot !== null && path.resolve(gitRoot) === path.resolve(rootDir);
    if (alreadyRepo) {
      const originExists = await hasRemote(rootDir, 'origin');
      const publicExists = await hasRemote(rootDir, 'public');
      if (originExists || publicExists) {
        logger.warn('This project already has git remotes configured.');
        if (!yesMode) {
          const proceed = await askYesNo('Reinitialize? This will remove existing remotes.', false);
          if (!proceed) {
            logger.info('Aborted.');
            return;
          }
        }
        if (originExists) await removeRemote(rootDir, 'origin');
        if (publicExists) await removeRemote(rootDir, 'public');
      }
    }

    // 5. Read source version (fallback to 1.0.0 if no setup.config.json)
    const sourceVersion = await resolveSourceVersion(options, baseDir);

    // 6. Init git repo (if not already)
    if (!alreadyRepo) {
      logger.step('Initializing git repository...');
      await initRepo(rootDir);
    }

    // 7. Save filter config
    const filterConfig = {
      version: '1.0',
      publicRepo: {
        exclude: options.exclude,
        include: [] as string[],
        versionOffset: 'major' as const,
        publicBranch: options.publicBranch,
        sourceBranch: options.sourceBranch,
      },
    };
    await saveFilterConfig(rootDir, filterConfig);

    // 8. Stage everything and create initial commit (now includes repo-filter.json)
    await stageAll(rootDir);
    await commit(
      rootDir,
      `chore(repo): initialize dual-repo setup

Source-of-truth: ${fullSourceName}
Public: ${fullPublicName}
Version: ${sourceVersion}
Excluded from public: ${options.exclude.join(', ')}`
    );

    // 9. Create private repo and push via gh
    logger.step(`Creating private repo: ${fullSourceName}...`);
    const ghCreateArgs = [
      'repo',
      'create',
      fullSourceName,
      '--private',
      '--source',
      '.',
      '--remote',
      'origin',
      '--push',
    ];
    await execa('gh', ghCreateArgs, { cwd: rootDir, stdio: 'inherit' });
    sourceUrl = `https://github.com/${fullSourceName}.git`;
    logger.success(`Private repo created and pushed: ${fullSourceName}`);

    // 10. Create public repo (push happens after filtering)
    logger.step(`Creating public repo: ${fullPublicName}...`);
    const ghPublicArgs = [
      'repo',
      'create',
      fullPublicName,
      '--public',
      '--source',
      '.',
      '--remote',
      'public',
    ];
    // Don't use --push here because we need to filter first
    await execa('gh', ghPublicArgs, { cwd: rootDir, stdio: 'inherit' });
    publicUrl = `https://github.com/${fullPublicName}.git`;
    logger.success(`Public repo created: ${fullPublicName}`);

    // 11. Remove excluded files from tracking for public push
    for (const pattern of options.exclude) {
      try {
        await execa('git', ['rm', '-r', '--cached', '--ignore-unmatch', pattern], {
          cwd: rootDir,
          stdio: 'pipe',
        });
      } catch {
        // Pattern doesn't exist or is not tracked
      }
    }

    // 12. Commit filtered tree (only if there are staged changes)
    const hasExcludes = await hasStagedChanges(rootDir);
    if (hasExcludes) {
      await commit(
        rootDir,
        `chore(repo): initialize public repo

Public version: ${sourceVersion}
Excludes: ${options.exclude.join(', ')}`
      );
    } else {
      logger.info('No excluded files to filter, skipping filtered commit');
    }

    // 13. Push filtered tree to public repo (use current branch dynamically)
    const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: rootDir,
      stdio: 'pipe',
    });
    await push(rootDir, 'public', currentBranch.trim());

    // 14. Restore full tree locally (re-add excluded files to index)
    logger.step('Restoring full source tree...');
    for (const pattern of options.exclude) {
      try {
        await execa('git', ['add', '-f', pattern], { cwd: rootDir, stdio: 'pipe' });
      } catch {
        // May not exist yet
      }
    }

    // 15. Commit full tree locally so HEAD matches index (clears staged changes)
    const hasRestored = await hasStagedChanges(rootDir);
    if (hasRestored) {
      await commit(
        rootDir,
        `chore(repo): restore full source tree

Local working state with full tree (not pushed to either remote)`
      );
    }
  } else {
    // ── Explicit URLs flow (existing behavior) ─────────
    let explicitSourceUrl = options.sourceUrl;
    let explicitPublicUrl = options.publicUrl;

    // Check if already a git repo
    const gitRoot = await getGitRoot(rootDir);
    const alreadyRepo = gitRoot !== null && path.resolve(gitRoot) === path.resolve(rootDir);
    if (alreadyRepo) {
      const hasOrigin = await hasRemote(rootDir, 'origin');
      if (hasOrigin) {
        logger.warn('This project already has git remotes configured.');
        if (!yesMode) {
          const proceed = await askYesNo(
            'Reinitialize repo setup? This may overwrite existing configuration.',
            false
          );
          if (!proceed) {
            logger.info('Aborted.');
            return;
          }
        }
      }
    }

    // Resolve source URL
    if (!explicitSourceUrl && !yesMode) {
      explicitSourceUrl = await resolveRepoUrl(
        'Enter source-of-truth GitHub repo (e.g., owner/private-template): ',
        ''
      );
    }
    if (!explicitSourceUrl) {
      throw new RepoError(
        'Source-of-truth repo URL is required. Use --source-url or provide it interactively.',
        'NO_SOURCE_URL'
      );
    }
    sourceUrl = normalizeGitHubUrl(explicitSourceUrl);

    // Resolve public URL
    if (!explicitPublicUrl && !yesMode) {
      explicitPublicUrl = await resolveRepoUrl(
        'Enter public GitHub repo (e.g., owner/public-template): ',
        ''
      );
    }
    if (!explicitPublicUrl) {
      throw new RepoError(
        'Public repo URL is required. Use --public-url or provide it interactively.',
        'NO_PUBLIC_URL'
      );
    }
    publicUrl = normalizeGitHubUrl(explicitPublicUrl);

    sourceRepoDisplay = sourceUrl;
    publicRepoDisplay = publicUrl;

    // Confirm
    logger.info('');
    logger.info('  Configuration:');
    logger.info(`  ─ Source-of-truth: ${sourceUrl}`);
    logger.info(`  ─ Public repo:     ${publicUrl}`);
    logger.info(`  ─ Exclude folders: ${options.exclude.join(', ')}`);
    logger.info('');

    if (!yesMode) {
      const confirmed = await askYesNo('Proceed with this configuration?', true);
      if (!confirmed) {
        logger.info('Aborted.');
        return;
      }
    }

    // Read source version (fallback to 1.0.0 if no setup.config.json)
    const sourceVersion = await resolveSourceVersion(options, baseDir);

    // Init git repo
    if (!alreadyRepo) {
      logger.step('Initializing git repository...');
      await initRepo(rootDir);
    }

    // Configure remotes
    if (await hasRemote(rootDir, 'origin')) {
      logger.info('Remote "origin" already exists, updating...');
      await removeRemote(rootDir, 'origin');
    }
    await addRemote(rootDir, 'origin', sourceUrl);

    if (await hasRemote(rootDir, 'public')) {
      logger.info('Remote "public" already exists, updating...');
      await removeRemote(rootDir, 'public');
    }
    await addRemote(rootDir, 'public', publicUrl);

    // Save filter config
    const filterConfig = {
      version: '1.0',
      publicRepo: {
        exclude: options.exclude,
        include: [] as string[],
        versionOffset: 'major' as const,
        publicBranch: options.publicBranch,
        sourceBranch: options.sourceBranch,
      },
    };
    await saveFilterConfig(rootDir, filterConfig);

    // Initial commit
    if (!alreadyRepo) {
      logger.step('Creating initial commit...');
      await stageAll(rootDir);
      await commit(
        rootDir,
        `chore(repo): initialize dual-repo setup

Source-of-truth: ${sourceUrl}
Public: ${publicUrl}
Version: ${sourceVersion}
Excluded from public: ${options.exclude.join(', ')}`
      );
    }

    // Push to source-of-truth
    const pushToSource =
      yesMode || (await askYesNo('Push initial commit to source-of-truth?', true));
    if (pushToSource) {
      await push(rootDir, 'origin', options.sourceBranch);
    }
  }

  // ── Success message (shared) ─────────────────────────
  logger.info('');
  logger.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.success('  Dual-repo setup complete!');
  logger.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');
  logger.info('  Next steps:');
  logger.info('');
  logger.info('    # Make changes, then sync to both repos:');
  logger.info(`    pnpm cli:dev repo sync`);
  logger.info('');
  logger.info('  Remotes configured:');
  logger.info(`    origin → ${sourceRepoDisplay}  (source-of-truth, everything)`);
  logger.info(`    public → ${publicRepoDisplay}  (public, filtered, version lag)`);
  logger.info('');
}
