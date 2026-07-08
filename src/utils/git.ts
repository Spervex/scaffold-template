import { execa } from 'execa';
import { logger } from './logger.js';

export type GitStatus = {
  clean: boolean;
  branch: string;
  untracked: string[];
  modified: string[];
};

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function getGitRoot(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: dir, stdio: 'pipe' });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function initRepo(dir: string): Promise<void> {
  await execa('git', ['init'], { cwd: dir, stdio: 'pipe' });
  logger.success('Git repository initialized');
}

export async function addRemote(dir: string, name: string, url: string): Promise<void> {
  await execa('git', ['remote', 'add', name, url], { cwd: dir, stdio: 'pipe' });
  logger.success(`Remote "${name}" added → ${url}`);
}

export async function hasRemote(dir: string, name: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', name], { cwd: dir, stdio: 'pipe' });
    return stdout.length > 0;
  } catch {
    return false;
  }
}

export async function removeRemote(dir: string, name: string): Promise<void> {
  await execa('git', ['remote', 'remove', name], { cwd: dir, stdio: 'pipe' });
  logger.info(`Remote "${name}" removed`);
}

export async function stageAll(dir: string): Promise<void> {
  await execa('git', ['add', '.'], { cwd: dir, stdio: 'pipe' });
}

export async function commit(dir: string, message: string): Promise<void> {
  await execa('git', ['commit', '-m', message], { cwd: dir, stdio: 'pipe' });
  logger.success(`Committed: ${message}`);
}

export async function push(dir: string, remote: string, branch: string): Promise<void> {
  logger.step(`Pushing to ${remote}/${branch}...`);
  await execa('git', ['push', '-u', remote, branch], { cwd: dir, stdio: 'pipe' });
  logger.success(`Pushed to ${remote}/${branch}`);
}

export async function getCurrentBranch(dir: string): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, stdio: 'pipe' });
  return stdout.trim();
}

export async function getStatus(dir: string): Promise<GitStatus> {
  const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: dir, stdio: 'pipe' });
  const lines = stdout.trim() ? stdout.split('\n') : [];
  const untracked: string[] = [];
  const modified: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('??')) {
      untracked.push(trimmed.slice(2).trim());
    } else if (/^[M ARCD]/.test(trimmed)) {
      modified.push(trimmed.slice(2).trim());
    }
  }

  const branch = await getCurrentBranch(dir);

  return {
    clean: lines.length === 0 || (lines.length === 1 && lines[0]!.trim() === ''),
    branch,
    untracked,
    modified,
  };
}

export async function createBranch(dir: string, branch: string): Promise<void> {
  await execa('git', ['checkout', '-b', branch], { cwd: dir, stdio: 'pipe' });
  logger.info(`Switched to new branch: ${branch}`);
}

export async function checkout(dir: string, branch: string): Promise<void> {
  await execa('git', ['checkout', branch], { cwd: dir, stdio: 'pipe' });
}

export async function forceAdd(dir: string, filePath: string): Promise<void> {
  await execa('git', ['add', '-f', filePath], { cwd: dir, stdio: 'pipe' });
}

export async function resetPath(dir: string, filePath: string): Promise<void> {
  await execa('git', ['reset', filePath], { cwd: dir, stdio: 'pipe' }).catch(() => {});
}

export async function listTrackedFiles(dir: string): Promise<string[]> {
  const { stdout } = await execa('git', ['ls-files'], { cwd: dir, stdio: 'pipe' });
  return stdout.trim() ? stdout.split('\n') : [];
}

export async function setUserConfig(dir: string, name: string, email: string): Promise<void> {
  await execa('git', ['config', 'user.name', name], { cwd: dir, stdio: 'pipe' });
  await execa('git', ['config', 'user.email', email], { cwd: dir, stdio: 'pipe' });
}
