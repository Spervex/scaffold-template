import path from 'node:path';
import fs from 'node:fs/promises';
import { ViteGenerator, NextjsGenerator, MernGenerator, FullstackGenerator, NextjsFullstackGenerator, SystemGenerator } from '../generators/index.js';
import { type CliOptions, CreateError } from '../types.js';
import { logger } from '../utils/logger.js';
import { execa } from 'execa';

export async function createProject(options: CliOptions): Promise<void> {
  // Validate project name
  validateProjectName(options.projectName);

  // Check if directory exists
  const projectPath = path.resolve(options.projectDir);
  try {
    await fs.access(projectPath);
    throw new CreateError(
      `Directory "${options.projectDir}" already exists. Please choose a different name or location.`,
      'DIR_EXISTS',
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
        const gen = new NextjsFullstackGenerator(options);
        result = await gen.generate();
        break;
      }
      case 'system': {
        const gen = new SystemGenerator(options);
        result = await gen.generate();
        break;
      }
      default: {
        throw new CreateError(
          `Unknown project type: ${options.projectType}`,
          'INVALID_TYPE',
        );
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
  const kebabCaseRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
  if (!kebabCaseRegex.test(name)) {
    throw new CreateError(
      `Invalid project name "${name}". Project name must be in kebab-case (lowercase letters, numbers, and hyphens only, cannot start or end with a hyphen).`,
      'INVALID_NAME',
    );
  }
}

async function installDependencies(projectPath: string, packageManager: string): Promise<void> {
  const cmd = packageManager === 'pnpm' ? 'pnpm' : 'npm';

  logger.step(`Installing dependencies with ${cmd}...`);

  try {
    await execa(cmd, ['install', '--ignore-scripts'], {
      cwd: projectPath,
      stdio: 'pipe',  // capture all output — suppress pnpm's progress bar garbage
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
  const dbDisplay = options.database === 'postgresql' ? 'PostgreSQL (Prisma)' : 'MongoDB (Mongoose)';
  const typeDisplay = options.projectType === 'fullstack-vite'
    ? 'fullstack (Vite + Express)'
    : options.projectType === 'fullstack-nextjs'
      ? `fullstack (Next.js + ${dbDisplay})`
      : options.projectType === 'backend'
        ? `backend (Express + ${dbDisplay})`
        : options.projectType;
  logger.info(`  Type: ${typeDisplay}`);
  if (options.projectType === 'frontend' || options.projectType === 'fullstack-vite') {
    logger.info(`  Frontend: ${options.frontendFramework} (./${options.frontendDirName})`);
  }
  if (options.projectType === 'backend' || options.projectType === 'fullstack-vite') {
    logger.info(`  Backend: ${options.frontendDirName ? `Express (./${options.backendDirName})` : `Express (./${options.backendDirName})`}`);
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

  if (options.projectType === 'frontend') {
    const devCmd = options.frontendFramework === 'nextjs' ? `${options.packageManager} dev` : `${options.packageManager} dev`;
    logger.info(`    ${devCmd}`);
  } else if (options.projectType === 'backend') {
    logger.info(`    cp ${options.backendDirName}/.env.example ${options.backendDirName}/.env`);
    logger.info(`    ${options.packageManager} --filter ${options.backendDirName} dev`);
  } else if (options.projectType === 'fullstack-vite') {
    if (options.packageManager === 'pnpm') {
      logger.info(`    ${options.packageManager} dev  # runs both frontend and backend`);
    } else {
      logger.info(`    # In separate terminals:`);
      logger.info(`    cd ${options.frontendDirName} && ${options.packageManager} dev`);
      logger.info(`    cd ${options.backendDirName} && ${options.packageManager} dev`);
    }
  } else if (options.projectType === 'fullstack-nextjs') {
    logger.info(`    cp .env.example .env`);
    logger.info(`    ${options.packageManager} dev`);
  }

  logger.info('');
  logger.info('  Happy coding! 🚀');
  logger.info('');
}
