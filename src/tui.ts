import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import chalk from 'chalk';
import { execa } from 'execa';

import { createProject } from './commands/create.js';
import { repoInit } from './commands/repo-init.js';
import { repoStatus } from './commands/repo-status.js';
import { repoSync } from './commands/repo-sync.js';
import { ALL_EXTRAS } from './shared/packages.js';
import {
  hasBackend,
  hasFrontend,
  isKebabCase,
  isVite,
  needsDatabase,
  showTuiError,
  validateProjectName,
} from './tui-helpers.js';
import {
  type CliOptions,
  type Database,
  type ExtraPackage,
  type FolderName,
  type FrontendFramework,
  type PackageManager,
  type ProjectType,
} from './types.js';

function handleCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return value as T;
}

// ─── Main Menu ───────────────────────────────────────────────

async function mainMenu(): Promise<void> {
  intro(chalk.bold.cyan(' create-scaffold TUI v1.0.0 '));

  const action = handleCancel(
    await select({
      message: 'What would you like to do?',
      options: [
        {
          value: 'create',
          label: 'Create a new project',
          hint: 'Scaffold frontend, backend, or full-stack projects',
        },
        {
          value: 'repo',
          label: 'Manage dual-repo setup',
          hint: 'Init, sync, or view status of source-of-truth + public repos',
        },
        { value: 'dev-tools', label: 'Dev tools', hint: 'Cleanup test projects, utilities' },
        { value: 'exit', label: 'Exit' },
      ],
    })
  );

  switch (action) {
    case 'create':
      await createProjectWizard();
      break;
    case 'repo':
      await repoMenu();
      break;
    case 'dev-tools':
      await devToolsMenu();
      break;
    case 'exit':
      outro(chalk.green('Goodbye!'));
      process.exit(0);
  }
}

// ─── Create Project Wizard ────────────────────────────────────

async function createProjectWizard(): Promise<void> {
  // 1. Project name
  const projectName = handleCancel(
    await text({
      message: 'Enter project name',
      placeholder: 'my-awesome-project',
      validate: (value) => {
        if (!value || !value.trim()) return 'Project name is required';
        if (!isKebabCase(value.trim())) {
          return 'Must be kebab-case (lowercase letters, numbers, and hyphens only)';
        }
        return undefined;
      },
    })
  );

  // 2. Project type
  const projectType = handleCancel(
    await select({
      message: 'Select project type',
      options: [
        {
          value: 'fullstack-vite',
          label: 'Vite + Express',
          hint: 'Vite React frontend + Express backend',
        },
        {
          value: 'fullstack-nextjs',
          label: 'Next.js (fullstack)',
          hint: 'Next.js with API routes (no Express needed)',
        },
        { value: 'frontend', label: 'Frontend only', hint: 'Vite or Next.js' },
        { value: 'backend', label: 'Backend only', hint: 'Express API server' },
        { value: 'system', label: 'System', hint: 'Blank project structure' },
        { value: 'cli', label: 'CLI tool', hint: 'Command-line app with Commander' },
        { value: 'tui', label: 'TUI tool', hint: 'Terminal UI with interactive prompts' },
      ],
    })
  ) as ProjectType;

  // 3. Database
  let database: Database = 'mongodb';
  if (needsDatabase(projectType)) {
    database = handleCancel(
      await select({
        message: 'Select database',
        options: [
          { value: 'mongodb', label: 'MongoDB', hint: 'With Mongoose ODM' },
          { value: 'postgresql', label: 'PostgreSQL', hint: 'With Prisma ORM' },
        ],
      })
    ) as Database;
  }

  // 4. Frontend framework (derived from project type)
  let frontendFramework: FrontendFramework | undefined;
  if (projectType === 'fullstack-vite') {
    frontendFramework = 'vite';
  } else if (projectType === 'fullstack-nextjs') {
    frontendFramework = 'nextjs';
  } else if (projectType === 'frontend') {
    frontendFramework = handleCancel(
      await select({
        message: 'Select frontend framework',
        options: [
          { value: 'vite', label: 'Vite + React + TypeScript' },
          { value: 'nextjs', label: 'Next.js + TypeScript' },
        ],
      })
    ) as FrontendFramework;
  }

  // 5. Frontend directory name
  let frontendDirName: FolderName = 'client';
  if (
    projectType === 'frontend' ||
    projectType === 'fullstack-vite' ||
    projectType === 'fullstack-nextjs'
  ) {
    frontendDirName = handleCancel(
      await select({
        message: 'Frontend directory name',
        options: [
          { value: 'client', label: 'client' },
          { value: 'frontend', label: 'frontend' },
        ],
      })
    ) as FolderName;
  }

  // 6. Backend directory name
  let backendDirName: FolderName = 'server';
  if (
    projectType === 'backend' ||
    projectType === 'fullstack-vite' ||
    projectType === 'fullstack-nextjs'
  ) {
    backendDirName = handleCancel(
      await select({
        message: 'Backend directory name',
        options: [
          { value: 'server', label: 'server' },
          { value: 'backend', label: 'backend' },
        ],
      })
    ) as FolderName;
  }

  // 7. Package manager
  const packageManager = handleCancel(
    await select({
      message: 'Select package manager',
      options: [
        { value: 'pnpm', label: 'pnpm', hint: 'Recommended' },
        { value: 'npm', label: 'npm' },
      ],
    })
  ) as PackageManager;

  // 8. Install dependencies?
  const installDeps = handleCancel(
    await confirm({
      message: 'Install dependencies?',
      initialValue: true,
    })
  );

  // 9. Repository setup
  type RepoChoice = {
    git: boolean;
    dualRepo: boolean;
  };

  const repoChoice: RepoChoice = handleCancel(
    await select({
      message: 'Repository setup',
      options: [
        { value: { git: true, dualRepo: false }, label: 'Initialize git', hint: 'Basic git init' },
        {
          value: { git: false, dualRepo: true },
          label: 'Initialize dual-repo',
          hint: 'Source-of-truth + public repos via gh CLI',
        },
        { value: { git: false, dualRepo: false }, label: 'Skip', hint: 'No repository setup' },
      ],
    })
  );

  const git = repoChoice.git;
  const dualRepo = repoChoice.dualRepo;

  // 10. Extra packages — select all, skip all, or choose individually

  const extrasChoice = handleCancel(
    await select({
      message: 'Configure additional packages?',
      options: [
        { value: 'all', label: 'Select all extras', hint: 'Include every optional package' },
        { value: 'none', label: 'Skip all extras', hint: 'No optional packages' },
        { value: 'custom', label: 'Choose individually', hint: 'Pick what you need' },
      ],
    })
  );

  let selectedExtras: ExtraPackage[] = [];

  if (extrasChoice === 'all') {
    selectedExtras = [...ALL_EXTRAS];
  } else if (extrasChoice === 'custom') {
    // Build grouped options dynamically based on project type
    const groupedOptions: Record<
      string,
      Array<{ value: string; label: string; hint?: string; selected?: boolean }>
    > = {};

    if (hasBackend(projectType)) {
      groupedOptions['Backend Features'] = [
        { value: 'auth', label: 'Auth', hint: 'argon2 + jsonwebtoken', selected: true },
        { value: 'compression', label: 'Compression', hint: 'gzip responses' },
        { value: 'rate-limit', label: 'Rate Limiting', hint: 'express-rate-limit' },
        { value: 'email', label: 'Email', hint: 'nodemailer' },
        { value: 'swagger', label: 'Swagger API Docs', hint: 'swagger-ui-express' },
      ];
    }

    if (hasFrontend(projectType)) {
      const frontendOptions: Array<{
        value: string;
        label: string;
        hint?: string;
        selected?: boolean;
      }> = [
        { value: 'zustand', label: 'Zustand', hint: 'State management', selected: true },
        { value: 'tailwindcss', label: 'Tailwind CSS', hint: 'Styling framework', selected: true },
        { value: 'tanstack-query', label: 'TanStack Query + Axios', hint: 'Data fetching' },
        { value: 'lucide-react', label: 'Lucide React', hint: 'Icons' },
        { value: 'react-hot-toast', label: 'React Hot Toast', hint: 'Notifications' },
        { value: 'motion', label: 'Motion', hint: 'Animations' },
        { value: 'gsap', label: 'GSAP', hint: 'Advanced animations' },
        { value: 'shadcn', label: 'shadcn/ui', hint: 'Component library + CLI' },
      ];
      // Only show React Router for Vite projects (Next.js uses file-based routing)
      if (isVite(frontendFramework, projectType)) {
        frontendOptions.unshift({
          value: 'react-router',
          label: 'React Router',
          hint: 'Client routing',
          selected: true,
        });
      }
      groupedOptions['Frontend Features'] = frontendOptions;
    }

    groupedOptions['Infrastructure, Testing & DevOps'] = [
      { value: 'redis', label: 'Redis', hint: 'Caching & pub/sub' },
      { value: 'socket-io', label: 'Socket.IO', hint: 'Real-time communication' },
      { value: 'stripe', label: 'Stripe', hint: 'Payment processing' },
      { value: 'sentry', label: 'Sentry', hint: 'Error tracking & performance' },
      { value: 'opentelemetry', label: 'OpenTelemetry', hint: 'Traces, metrics & logs' },
      { value: 'slack', label: 'Slack Webhook', hint: 'Deploy/monitor alerts' },
      { value: 'vitest', label: 'Vitest', hint: 'Unit testing' },
      { value: 'playwright', label: 'Playwright', hint: 'E2E browser testing' },
      { value: 'prettier', label: 'Prettier', hint: 'Code formatter' },
    ];

    const extras = handleCancel(
      await groupMultiselect({
        message: 'Select additional packages',
        options: groupedOptions,
        required: false,
      })
    );
    selectedExtras = extras as ExtraPackage[];
  }

  const options: CliOptions = {
    projectName,
    projectDir: projectName,
    projectType,
    database,
    frontendFramework,
    frontendDirName,
    backendDirName,
    packageManager,
    installDeps,
    git,
    extraPackages: selectedExtras,
  };

  // Run project creation
  const s = spinner();
  try {
    s.start('Creating project...');
    await createProject(options);
    s.stop(chalk.green('Project created successfully!'));
  } catch (error) {
    s.stop(chalk.red('Failed to create project'));
    showTuiError(error);
  }

  // Initialize dual-repo if selected
  if (dualRepo) {
    const cliDir = path.dirname(fileURLToPath(import.meta.url));
    const scaffoldDir = path.resolve(cliDir, '..');
    const projectPath = path.resolve(projectName);

    console.log('');
    const initResult = handleCancel(
      await confirm({
        message: 'Proceed with dual-repo setup for this project?',
        initialValue: true,
      })
    );

    if (initResult) {
      // Short interactive flow: name (pre-filled), suffix, excludes
      const repoName = handleCancel(
        await text({
          message: 'Source repo name',
          placeholder: projectName,
          initialValue: projectName,
          validate: (value) => {
            if (!value || !value.trim()) return 'Repo name is required';
            if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value.trim())) {
              return 'Must be kebab-case (lowercase letters, numbers, and hyphens only)';
            }
            return undefined;
          },
        })
      );

      const publicSuffix = handleCancel(
        await text({
          message: 'Public repo suffix',
          placeholder: '-public',
          initialValue: '-public',
        })
      );

      const excludeStr = handleCancel(
        await text({
          message: 'Folders to exclude from public repo (comma-separated)',
          placeholder: 'core,src',
          initialValue: 'core,src',
        })
      );

      const s2 = spinner();
      s2.start('Setting up dual-repo...');
      try {
        await repoInit(
          {
            name: repoName,
            publicSuffix,
            sourceUrl: undefined,
            publicUrl: undefined,
            dir: projectPath,
            sourceBranch: 'main',
            publicBranch: 'main',
            exclude: excludeStr.split(',').map((s: string) => s.trim()),
            yes: true,
            initialVersion: '1.0.0',
          },
          scaffoldDir
        );
        s2.stop(chalk.green('Dual-repo setup complete!'));
      } catch (error) {
        s2.stop(chalk.red('Dual-repo setup failed'));
        showTuiError(error);
      }
    }
  }

  const nextAction = handleCancel(
    await select({
      message: 'What next?',
      options: [
        { value: 'menu', label: 'Back to main menu' },
        { value: 'exit', label: 'Exit' },
      ],
    })
  );

  if (nextAction === 'menu') {
    await mainMenu();
  } else {
    outro(chalk.green('Happy coding! 🚀'));
    process.exit(0);
  }
}

// ─── Repo Management Menu ────────────────────────────────────

async function repoMenu(): Promise<void> {
  const action = handleCancel(
    await select({
      message: 'Dual-repo management',
      options: [
        {
          value: 'init',
          label: 'Initialize dual-repo setup',
          hint: 'Set up source-of-truth + public repos',
        },
        {
          value: 'sync',
          label: 'Sync changes to both repos',
          hint: 'Push to origin + public with filtering',
        },
        {
          value: 'status',
          label: 'Show dual-repo status',
          hint: 'View current configuration and state',
        },
        { value: 'back', label: 'Back to main menu' },
      ],
    })
  );

  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const baseDir = path.resolve(cliDir, '..');

  try {
    switch (action) {
      case 'init': {
        await repoInitWizard(baseDir);
        break;
      }
      case 'sync': {
        const s = spinner();
        s.start('Syncing repos...');
        await repoSync({ dryRun: false, yes: false }, baseDir);
        s.stop(chalk.green('Sync complete!'));
        break;
      }
      case 'status': {
        await repoStatus(baseDir);
        break;
      }
      case 'back': {
        await mainMenu();
        return;
      }
    }
  } catch (error) {
    console.error('');
    showTuiError(error);
  }

  const nextAction = handleCancel(
    await select({
      message: 'What next?',
      options: [
        { value: 'menu', label: 'Back to repo menu' },
        { value: 'main', label: 'Back to main menu' },
        { value: 'exit', label: 'Exit' },
      ],
    })
  );

  if (nextAction === 'menu') {
    await repoMenu();
  } else if (nextAction === 'main') {
    await mainMenu();
  } else {
    outro(chalk.green('Goodbye!'));
    process.exit(0);
  }
}

async function repoInitWizard(baseDir: string): Promise<void> {
  const setupMethod = handleCancel(
    await select({
      message: 'How would you like to set up the repos?',
      options: [
        {
          value: 'auto',
          label: 'Auto-setup via GitHub CLI',
          hint: 'Create repos with gh (requires gh auth)',
        },
        { value: 'manual', label: 'Manual URL entry', hint: 'Provide existing repo URLs' },
      ],
    })
  );

  if (setupMethod === 'auto') {
    const repoName = handleCancel(
      await text({
        message: 'Enter the base repo name',
        placeholder: 'my-template',
        validate: (value) => {
          if (!value || !value.trim()) return 'Repo name is required';
          if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value.trim())) {
            return 'Must be kebab-case (lowercase letters, numbers, and hyphens only)';
          }
          return undefined;
        },
      })
    );

    const publicSuffix = handleCancel(
      await text({
        message: 'Public repo suffix',
        placeholder: '-public',
        initialValue: '-public',
      })
    );

    const excludeStr = handleCancel(
      await text({
        message: 'Folders to exclude from public repo (comma-separated)',
        placeholder: 'core,src',
        initialValue: 'core,src',
      })
    );

    const proceed = handleCancel(
      await confirm({
        message: 'Proceed with creating these repos?',
        initialValue: true,
      })
    );

    if (!proceed) {
      outro(chalk.yellow('Aborted.'));
      return;
    }

    const s = spinner();
    s.start('Initializing dual-repo setup...');
    await repoInit(
      {
        name: repoName,
        publicSuffix,
        sourceUrl: undefined,
        publicUrl: undefined,
        dir: undefined,
        sourceBranch: 'main',
        publicBranch: 'main',
        exclude: excludeStr.split(',').map((s: string) => s.trim()),
        yes: true,
      },
      baseDir
    );
    s.stop(chalk.green('Dual-repo setup complete!'));
  } else {
    const sourceUrl = handleCancel(
      await text({
        message: 'Source-of-truth GitHub repo URL',
        placeholder: 'https://github.com/owner/private-template',
        validate: (value) => {
          if (!value || !value.trim()) return 'Source URL is required';
          return undefined;
        },
      })
    );

    const publicUrl = handleCancel(
      await text({
        message: 'Public GitHub repo URL',
        placeholder: 'https://github.com/owner/public-template',
        validate: (value) => {
          if (!value || !value.trim()) return 'Public URL is required';
          return undefined;
        },
      })
    );

    const excludeStr = handleCancel(
      await text({
        message: 'Folders to exclude from public repo (comma-separated)',
        placeholder: 'core,src',
        initialValue: 'core,src',
      })
    );

    const s = spinner();
    s.start('Initializing dual-repo setup...');
    await repoInit(
      {
        name: undefined,
        publicSuffix: '-public',
        sourceUrl,
        publicUrl,
        dir: undefined,
        sourceBranch: 'main',
        publicBranch: 'main',
        exclude: excludeStr.split(',').map((s: string) => s.trim()),
        yes: true,
      },
      baseDir
    );
    s.stop(chalk.green('Dual-repo setup complete!'));
  }
}

// ─── Dev Tools Menu ──────────────────────────────────────────

async function devToolsMenu(): Promise<void> {
  const scaffoldDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  const action = handleCancel(
    await select({
      message: 'Dev tools',
      options: [
        {
          value: 'cleanup-test',
          label: 'Clean up test project',
          hint: 'Delete local dir + GitHub repos created during testing',
        },
        { value: 'back', label: 'Back to main menu' },
      ],
    })
  );

  if (action === 'back') {
    await mainMenu();
    return;
  }

  if (action === 'cleanup-test') {
    const projectName = handleCancel(
      await text({
        message: 'Project name to clean up',
        placeholder: 'asdasdasd',
        validate: (value) => validateProjectName(value ?? ''),
      })
    );

    const proceed = handleCancel(
      await confirm({
        message: `Delete local "${projectName}" dir AND GitHub repos Spervex/${projectName} and Spervex/${projectName}-public?`,
        initialValue: false,
      })
    );

    if (!proceed) {
      console.log(chalk.yellow('  Aborted.'));
    } else {
      try {
        const scriptPath = path.join(scaffoldDir, 'scripts', 'cleanup-test.js');
        await execa('node', [scriptPath, projectName], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`  Cleanup failed: ${msg}`));
      }
    }
  }

  const nextAction = handleCancel(
    await select({
      message: 'What next?',
      options: [
        { value: 'menu', label: 'Back to dev tools' },
        { value: 'main', label: 'Back to main menu' },
        { value: 'exit', label: 'Exit' },
      ],
    })
  );

  if (nextAction === 'menu') {
    await devToolsMenu();
  } else if (nextAction === 'main') {
    await mainMenu();
  } else {
    outro(chalk.green('Goodbye!'));
    process.exit(0);
  }
}

// ─── Entry Point ──────────────────────────────────────────────

export async function runTui(): Promise<void> {
  try {
    await mainMenu();
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\nFatal error: ${error.message}`));
      if (process.env.DEBUG) console.error(error);
    }
    process.exit(1);
  }
}
