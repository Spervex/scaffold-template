import path from 'node:path';
import { execa } from 'execa';
import { readFile, writeFile } from 'node:fs/promises';
import { type RepoSyncOptions, RepoError } from '../types.js';
import { logger } from '../utils/logger.js';
import {
  getGitRoot,
  getStatus,
  stageAll,
  commit,
  push,
  listTrackedFiles,
  forceAdd,
} from '../utils/git.js';
import { loadFilterConfig, filterFilesForPublic } from '../utils/repo-filter.js';
import { readSourceVersion, applyVersionOffset } from '../utils/version.js';

export async function repoSync(options: RepoSyncOptions, baseDir: string): Promise<void> {
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.header('  Sync Dual-Repo');
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');

  const rootDir = process.env.INIT_CWD || process.cwd();

  // 1. Verify we're in a git repo
  const gitRoot = await getGitRoot(rootDir);
  if (!gitRoot || path.resolve(gitRoot) !== path.resolve(rootDir)) {
    throw new RepoError('Not a git repository. Run "pnpm cli:dev repo init" first.', 'NOT_A_REPO');
  }

  // 2. Check for clean working directory
  const status = await getStatus(rootDir);
  if (!status.clean && !options.yes) {
    logger.warn('You have uncommitted changes.');
    logger.info('  Modified files:');
    for (const f of status.modified) logger.info(`    M ${f}`);
    for (const f of status.untracked) logger.info(`    ? ${f}`);
    logger.info('');

    // Proceed anyway — we'll stage everything
  }

  // 3. Load filter config
  const filterConfig = await loadFilterConfig(rootDir);
  const excludePatterns = filterConfig.publicRepo.exclude;
  logger.info(`  Excluding from public: ${excludePatterns.join(', ')}`);

  // 4. Read source version
  const sourceVersion = await readSourceVersion(baseDir);
  const publicVersion = applyVersionOffset(sourceVersion, filterConfig.publicRepo.versionOffset);
  logger.info(`  Source version: ${sourceVersion} → Public version: ${publicVersion}`);

  // 5. Stage all changes
  logger.step('Staging all changes...');
  await stageAll(rootDir);

  // 6. Commit to source-of-truth (local)
  logger.step('Committing to source branch...');
  await commit(rootDir, `chore(repo): sync source-of-truth v${sourceVersion}`);

  // 7. Create/update public branch with filtered content
  const currentBranch = status.branch;
  const publicBranch = filterConfig.publicRepo.publicBranch;

  logger.step(`Preparing public branch (${publicBranch})...`);

  // Get all tracked files
  const allFiles = await listTrackedFiles(rootDir);

  // Filter for public
  const publicFiles = filterFilesForPublic(allFiles, excludePatterns);

  if (options.dryRun) {
    logger.info('');
    logger.info('  [DRY RUN] Files that would go to public repo:');
    for (const f of publicFiles) logger.info(`    ✓ ${f}`);
    logger.info('');
    const excluded = allFiles.filter((f) => !publicFiles.includes(f));
    logger.info('  [DRY RUN] Files excluded from public repo:');
    for (const f of excluded) logger.info(`    ✗ ${f}`);
    logger.info('');
    logger.info('  [DRY RUN] No changes were made.');
    return;
  }

  // Update version in public repo
  // Read the root package.json and update version
  const rootPackagePath = path.join(rootDir, 'package.json');
  try {
    const pkgContent = await readFile(rootPackagePath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    pkg.version = publicVersion;
    // Add a note about public repo
    pkg.publicVersion = publicVersion;
    pkg.sourceVersion = sourceVersion;
    await writeFile(rootPackagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    logger.info(`Root package.json version updated to ${publicVersion} for public branch`);
  } catch {
    logger.warn('Could not update root package.json version');
  }

  // Commit and push to public branch
  // We need to create a separate commit tree for public that excludes certain files
  // Strategy: use git filter-branch or just push what we have and use .gitignore
  // Simpler approach: push the full commit but also push a filtered tree

  // Actually, the cleanest approach for a template repo:
  // 1. Push full commit to origin (source-of-truth)
  // 2. For public: reset, remove excluded files, recommit, push

  // Push to source-of-truth
  await push(rootDir, 'origin', currentBranch);

  // Now handle public repo
  // Remove excluded files from tracking
  for (const pattern of excludePatterns) {
    // Remove from git tracking if it exists
    try {
      // Check if pattern exists in the repo
      await execa('git', ['rm', '-r', '--cached', '--ignore-unmatch', pattern], {
        cwd: rootDir,
        stdio: 'pipe',
      });
    } catch {
      // Pattern doesn't exist, skip
    }
  }

  // Re-commit with only public files
  await commit(
    rootDir,
    `chore(repo): sync public repo v${publicVersion}

Source-of-truth version: ${sourceVersion}
Public version: ${publicVersion}
Excludes: ${excludePatterns.join(', ')}`
  );

  // Push to public
  await push(rootDir, 'public', currentBranch);

  // Restore excluded files to tracking (for source-of-truth)
  logger.step('Restoring full source tree...');
  for (const pattern of excludePatterns) {
    try {
      await forceAdd(rootDir, pattern);
    } catch {
      // May not exist yet
    }
  }

  logger.info('');
  logger.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.success('  Sync complete!');
  logger.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');
  logger.info(`  ✓ Pushed source-of-truth (v${sourceVersion}) → origin/${currentBranch}`);
  logger.info(`  ✓ Pushed public (v${publicVersion}) → public/${publicBranch}`);
  logger.info('');
}
