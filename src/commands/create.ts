import fs from 'node:fs/promises';
import path from 'node:path';

import { execa } from 'execa';

import {
  FullstackGenerator,
  MernGenerator,
  NextjsGenerator,
  SystemGenerator,
  ToolGenerator,
  ViteGenerator,
} from '../generators/index.js';
import { isKebabCase, projectTypeLabel } from '../tui-helpers.js';
import { type CliOptions, CreateError } from '../types.js';
import { logger } from '../utils/logger.js';

export async function createProject(options: CliOptions): Promise<void> {
  // Validate project name
  validateProjectName(options.projectName);

  // Check if directory exists
  const projectPath = path.resolve(options.projectDir);
  try {
    await fs.access(projectPath);
    throw new CreateError(
      `Directory "${options.projectDir}" already exists. Please choose a different name or location.`,
      'DIR_EXISTS'
    );
  } catch (_err) {
    if (_err instanceof CreateError) throw _err;
    // Directory doesn't exist, which is what we want
  }

  // Create project directory
  logger.step(`Creating project directory: ${projectPath}`);
  await fs.mkdir(projectPath, { recursive: true });

  // Run appropriate generator
  let result;
  try {
    switch (options.projectType) {
      case 'frontend': {
        if (options.frontendFramework === 'nextjs') {
          const gen = new NextjsGenerator(options);
          result = await gen.generate();
        } else {
          const gen = new ViteGenerator(options);
          result = await gen.generate();
        }
        break;
      }
      case 'backend': {
        const gen = new MernGenerator(options);
        result = await gen.generate();
        break;
      }
      case 'fullstack-vite': {
        const gen = new FullstackGenerator(options);
        result = await gen.generate();
        break;
      }
      case 'fullstack-nextjs': {
        const gen = new NextjsGenerator(options);
        result = await gen.generate();
        break;
      }
      case 'system': {
        const gen = new SystemGenerator(options);
        result = await gen.generate();
        break;
      }
      case 'cli':
      case 'tui': {
        const gen = new ToolGenerator(options);
        result = await gen.generate();
        break;
      }
      default: {
        throw new CreateError(`Unknown project type: ${options.projectType}`, 'INVALID_TYPE');
      }
    }
  } catch (err) {
    // Clean up on failure
    await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  logger.info('');
  logger.success(`Created ${result.filesCreated} files`);

  // Install dependencies
  if (options.installDeps) {
    await installDependencies(projectPath, options.packageManager);
  }

  // Initialize git
  if (options.git) {
    await initializeGit(projectPath);
  }

  // Print success message
  printSuccessMessage(options, projectPath);
}

function validateProjectName(name: string): void {
  if (!isKebabCase(name)) {
    throw new CreateError(
      `Invalid project name "${name}". Project name must be in kebab-case (lowercase letters, numbers, and hyphens only, cannot start or end with a hyphen).`,
      'INVALID_NAME'
    );
  }
}

async function installDependencies(projectPath: string, packageManager: string): Promise<void> {
  const cmd = packageManager === 'pnpm' ? 'pnpm' : 'npm';

  logger.step(`Installing dependencies with ${cmd}...`);

  try {
    await execa(cmd, ['install', '--ignore-scripts'], {
      cwd: projectPath,
      stdio: 'pipe', // capture all output — suppress pnpm's progress bar garbage
    });
    logger.success('Dependencies installed');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to install dependencies: ${msg}`);
    logger.warn(`You can run "${cmd} install" manually in ${projectPath}`);
  }
}

async function initializeGit(projectPath: string): Promise<void> {
  logger.step('Initializing git repository...');

  try {
    await execa('git', ['init'], { cwd: projectPath, stdio: 'pipe' });

    // Create initial commit
    try {
      await execa('git', ['add', '.'], { cwd: projectPath, stdio: 'pipe' });
      await execa('git', ['commit', '-m', 'Initial commit: scaffolded with create-scaffold'], {
        cwd: projectPath,
        stdio: 'pipe',
      });
    } catch {
      // git might not have user config set up
      logger.warn('Could not create initial commit. Set up git user config first.');
    }

    logger.success('Git repository initialized');
  } catch {
    logger.warn('Failed to initialize git repository. You can run "git init" manually.');
  }
}

function printSuccessMessage(options: CliOptions, projectPath: string): void {
  logger.info('');
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.header('  Project created successfully!');
  logger.header('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');

  logger.info(`  Project: ${options.projectName}`);
  logger.info(`  Location: ${projectPath}`);
  const dbDisplay =
    options.database === 'postgresql' ? 'PostgreSQL (Prisma)' : 'MongoDB (Mongoose)';
  const typeDisplay = projectTypeLabel(options.projectType, dbDisplay);
  logger.info(`  Type: ${typeDisplay}`);
  if (options.projectType === 'frontend' || options.projectType === 'fullstack-vite') {
    logger.info(`  Frontend: ${options.frontendFramework} (./${options.frontendDirName})`);
  }
  if (options.projectType === 'backend' || options.projectType === 'fullstack-vite') {
    logger.info(
      `  Backend: ${options.frontendDirName ? `Express (./${options.backendDirName})` : `Express (./${options.backendDirName})`}`
    );
  }
  logger.info(`  Package manager: ${options.packageManager}`);

  if (options.extraPackages.length > 0) {
    logger.info(`  Extras: ${options.extraPackages.join(', ')}`);
  }

  logger.info('');
  logger.info('  Next steps:');
  logger.info('');

  logger.info(`    cd ${options.projectName}`);

  if (!options.installDeps) {
    logger.info(`    ${options.packageManager} install`);
  }

  const nextSteps: string[] = [];

  if (options.projectType === 'fullstack-nextjs' || options.projectType === 'fullstack-vite') {
    if (options.projectType !== 'fullstack-nextjs') {
      // fullstack-vite with pnpm
      if (options.packageManager === 'pnpm') {
        nextSteps.push(`${options.packageManager} dev  # runs both frontend and backend`);
      } else {
        nextSteps.push('# In separate terminals:');
        nextSteps.push(`cd ${options.frontendDirName} && ${options.packageManager} dev`);
        nextSteps.push(`cd ${options.backendDirName} && ${options.packageManager} dev`);
      }
    } else {
      // fullstack-nextjs — standalone
      nextSteps.push(`cp .env.example .env`);
      nextSteps.push(`${options.packageManager} dev`);
    }
  } else if (options.projectType === 'backend') {
    nextSteps.push(`cp ${options.backendDirName}/.env.example ${options.backendDirName}/.env`);
    nextSteps.push(`${options.packageManager} --filter ${options.backendDirName} dev`);
  } else if (
    options.projectType === 'cli' ||
    options.projectType === 'tui' ||
    options.projectType === 'system' ||
    options.projectType === 'frontend'
  ) {
    nextSteps.push(`${options.packageManager} dev`);
  }

  for (const step of nextSteps) {
    logger.info(`    ${step}`);
  }

  logger.info('');
  logger.info('  Happy coding! 🚀');
  logger.info('');
}
