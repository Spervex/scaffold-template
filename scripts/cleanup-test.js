#!/usr/bin/env node

/**
 * Testing cleanup script.
 * Deletes a test project directory and its GitHub repos.
 * Usage: node scripts/cleanup-test.js <project-name>
 *        node scripts/cleanup-test.js asdasdasd
 */

import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: node scripts/cleanup-test.js <project-name>');
  process.exit(1);
}

const cwd = process.cwd();
const projectPath = path.join(cwd, projectName);

// ── Step 1: Delete local directory ──
async function deleteLocalProject() {
  try {
    await fs.access(projectPath);
    await fs.rm(projectPath, { recursive: true, force: true });
    console.log(`✅ Deleted local project: ${projectPath}`);
  } catch {
    console.log(`⚠️  Local project not found: ${projectPath} (skipping)`);
  }
}

// ── Step 2: Delete GitHub repos ──
async function deleteGitHubRepo(repo) {
  try {
    await execa('gh', ['repo', 'delete', repo, '--yes'], { stdio: 'pipe' });
    console.log(`✅ Deleted GitHub repo: ${repo}`);
  } catch {
    console.log(
      `⚠️  Could not delete GitHub repo: ${repo} (may not exist or gh not authenticated)`
    );
  }
}

// ── Main ──
async function main() {
  console.log(`\n🧹 Cleaning up test project: "${projectName}"\n`);

  await deleteLocalProject();
  console.log('');
  await deleteGitHubRepo(`Spervex/${projectName}`);
  await deleteGitHubRepo(`Spervex/${projectName}-public`);

  console.log('\n✨ Cleanup complete!\n');
}

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
