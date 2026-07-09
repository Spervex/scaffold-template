import chalk from 'chalk';

import { CreateError, type FrontendFramework, type ProjectType, RepoError } from './types.js';

export function hasBackend(type: ProjectType): boolean {
  return type === 'backend' || type === 'fullstack-vite' || type === 'fullstack-nextjs';
}

export function hasFrontend(type: ProjectType): boolean {
  return type === 'frontend' || type === 'fullstack-vite' || type === 'fullstack-nextjs';
}

export function needsDatabase(type: ProjectType): boolean {
  return hasBackend(type);
}

export function isVite(framework: FrontendFramework | undefined, type: ProjectType): boolean {
  return framework === 'vite' || type === 'fullstack-vite';
}

export function isKebabCase(str: string): boolean {
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(str);
}

/**
 * Validates a project name for use in file paths.
 * Returns an error message string if invalid, or undefined if valid.
 */
export function validateProjectName(name: string): string | undefined {
  if (!name || !name.trim()) return 'Project name is required';
  if (!isKebabCase(name.trim())) {
    return 'Must be kebab-case (lowercase letters, numbers, and hyphens only, cannot start or end with a hyphen)';
  }
  return undefined;
}

export function showTuiError(error: unknown): void {
  if (error instanceof CreateError || error instanceof RepoError) {
    console.error(chalk.red(`  ${error.message}`));
  } else if (error instanceof Error) {
    console.error(chalk.red(`  ${error.message}`));
    if (process.env.DEBUG) console.error(error);
  }
}

export const HEADER_LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export function projectTypeLabel(type: ProjectType, database?: string): string {
  switch (type) {
    case 'fullstack-vite':
      return 'fullstack (Vite + Express)';
    case 'fullstack-nextjs':
      return `fullstack (Next.js + ${database || 'MongoDB'})`;
    case 'backend':
      return `backend (Express + ${database || 'MongoDB'})`;
    case 'frontend':
      return 'frontend';
    case 'cli':
      return 'CLI tool (Commander)';
    case 'tui':
      return 'TUI tool (@clack/prompts)';
    case 'system':
      return 'system';
  }
}

export const TYPE_LABELS: Record<ProjectType, string> = {
  'fullstack-vite': 'fullstack (Vite + Express)',
  'fullstack-nextjs': 'fullstack (Next.js + PostgreSQL/MongoDB)',
  backend: 'backend (Express + PostgreSQL/MongoDB)',
  frontend: 'frontend',
  cli: 'CLI tool (Commander)',
  tui: 'TUI tool (@clack/prompts)',
  system: 'system',
};
