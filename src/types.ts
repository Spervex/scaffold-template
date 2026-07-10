export type ProjectType =
  'frontend' | 'backend' | 'fullstack-vite' | 'fullstack-nextjs' | 'system' | 'cli' | 'tui';
export type FrontendFramework = 'vite' | 'nextjs';
export type PackageManager = 'pnpm' | 'npm';
export type FolderName = 'client' | 'frontend' | 'server' | 'backend';
export type Database = 'mongodb' | 'postgresql';

export type ExtraPackage =
  // Backend features
  | 'auth'
  | 'compression'
  | 'rate-limit'
  | 'email'
  | 'swagger'
  // Frontend features
  | 'zustand'
  | 'tailwindcss'
  | 'tanstack-query'
  | 'react-router'
  | 'shadcn'
  | 'lucide-react'
  | 'react-hot-toast'
  | 'motion'
  | 'gsap'
  // Cross-cutting
  | 'redis'
  | 'slack'
  | 'sentry'
  | 'opentelemetry'
  | 'stripe'
  | 'socket-io'
  | 'vitest'
  | 'playwright'
  | 'prettier';

export type CliOptions = {
  projectName: string;
  projectDir: string;
  projectType: ProjectType;
  database: Database;
  frontendFramework?: FrontendFramework;
  frontendDirName: FolderName;
  backendDirName: FolderName;
  packageManager: PackageManager;
  installDeps: boolean;
  git: boolean;
  extraPackages: ExtraPackage[];
};

export type FileDefinition = {
  path: string;
  content: string;
};

export type GeneratorResult = {
  filesCreated: number;
  dir: string;
};

export class CreateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CreateError';
  }
}

// ── Repo Management Types ──

export type RepoFilterConfig = {
  version: string;
  publicRepo: {
    exclude: string[];
    include: string[];
    versionOffset: 'major' | 'minor' | 'none';
    publicBranch: string;
    sourceBranch: string;
  };
};

export type RepoInitOptions = {
  // Auto-setup via gh (preferred)
  name?: string;
  publicSuffix: string;
  // Explicit URLs (fallback)
  sourceUrl?: string;
  publicUrl?: string;
  // Target directory
  dir?: string;
  // Shared
  sourceBranch: string;
  publicBranch: string;
  exclude: string[];
  yes: boolean;
  // For new projects without setup.config.json
  initialVersion?: string;
};

export type RepoSyncOptions = {
  dryRun: boolean;
  yes: boolean;
};

export class RepoError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RepoError';
  }
}
