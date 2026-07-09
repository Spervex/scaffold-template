import path from 'node:path';
import { BaseGenerator } from './base.generator.js';
import { type CliOptions, type FileDefinition } from '../types.js';
import { mergeDeps } from '../shared/packages.js';
import { TSCONFIG_NODE, GITIGNORE_DEFAULT, ENV_BASIC } from '../shared/configs.js';
import { pinoLoggerFile } from '../shared/file-snippets.js';

function getToolPackageJson(options: CliOptions): Record<string, unknown> {
  const isTui = options.projectType === 'tui';
  const base = {
    name: options.projectName,
    version: '1.0.0',
    description: isTui
      ? 'TUI tool scaffolded with create-scaffold'
      : 'CLI tool scaffolded with create-scaffold',
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit',
      lint: 'eslint src/',
    },
    dependencies: {
      ...(isTui ? { '@clack/prompts': '^1.7.0' } : { commander: '^13.0.0' }),
      chalk: '^5.3.0',
    },
    devDependencies: {
      typescript: '~6.0.2',
      tsx: '^4.19.0',
      '@types/node': '^24.13.2',
      eslint: '^9.0.0',
    },
  };
  return mergeDeps(base, options, false) as Record<string, unknown>;
}

export class ToolGenerator extends BaseGenerator {
  protected getStepLabel(): string {
    const label = this.options.projectType === 'tui' ? 'TUI' : 'CLI';
    return `Generating ${label} project...`;
  }

  protected getSuccessMessage(dir: string): string {
    const label = this.options.projectType === 'tui' ? 'TUI' : 'CLI';
    return `${label} project created in ${dir}`;
  }

  protected buildFiles(dir: string): FileDefinition[] {
    const isTui = this.options.projectType === 'tui';

    const files: FileDefinition[] = [
      {
        path: path.join(dir, 'package.json'),
        content: this.formatJson(getToolPackageJson(this.options)),
      },
      {
        path: path.join(dir, 'tsconfig.json'),
        content: this.formatJson(TSCONFIG_NODE),
      },
      {
        path: path.join(dir, '.env.example'),
        content: ENV_BASIC,
      },
      {
        path: path.join(dir, '.gitignore'),
        content: GITIGNORE_DEFAULT,
      },
      {
        path: path.join(dir, 'README.md'),
        content: isTui
          ? `# ${this.options.projectName}\n\nA TUI (Terminal User Interface) tool scaffolded with \`create-scaffold\`.\n\n## Getting Started\n\n\`\`\`bash\npnpm install\npnpm dev\n\`\`\`\n\n## Scripts\n\n| Command | Description |\n|---------|-------------|\n| \`pnpm dev\` | Run with hot reload |\n| \`pnpm build\` | Build for production |\n| \`pnpm start\` | Run production build |\n| \`pnpm typecheck\` | TypeScript type checking |\n| \`pnpm lint\` | Lint source files |\n`
          : `# ${this.options.projectName}\n\nA CLI tool scaffolded with \`create-scaffold\`.\n\n## Getting Started\n\n\`\`\`bash\npnpm install\npnpm dev -- --help\n\`\`\`\n\n## Scripts\n\n| Command | Description |\n|---------|-------------|\n| \`pnpm dev\` | Run with hot reload |\n| \`pnpm build\` | Build for production |\n| \`pnpm start\` | Run production build |\n| \`pnpm typecheck\` | TypeScript type checking |\n| \`pnpm lint\` | Lint source files |\n`,
      },
      {
        path: path.join(dir, 'src', 'index.ts'),
        content: isTui
          ? `import { intro, outro, select, text, isCancel, cancel } from '@clack/prompts';
import chalk from 'chalk';
import { logger } from './logger.js';

function handleCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return value as T;
}

async function main(): Promise<void> {
  intro(chalk.bold.cyan(' ${this.options.projectName} '));

  const action = handleCancel(
    await select({
      message: 'What would you like to do?',
      options: [
        { value: 'greet', label: 'Greet someone' },
        { value: 'info', label: 'Show info' },
        { value: 'exit', label: 'Exit' },
      ],
    }),
  );

  if (action === 'greet') {
    const name = handleCancel(
      await text({
        message: 'Enter your name',
        placeholder: 'world',
      }),
    );
    logger.info(chalk.green(\`Hello, \${name || 'world'}! 🎉\`));
  } else if (action === 'info') {
    logger.info(chalk.blue('This is a TUI tool scaffolded with create-scaffold.'));
    logger.info(chalk.blue('Edit src/index.ts to build your interactive terminal app.'));
  } else {
    outro(chalk.green('Goodbye!'));
    process.exit(0);
  }

  outro(chalk.green('Done!'));
}

main().catch((error) => {
  logger.error(error);
  process.exit(1);
});
`
          : `import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './logger.js';

const program = new Command();

program
  .name('${this.options.projectName}')
  .description('CLI tool scaffolded with create-scaffold')
  .version('1.0.0');

program
  .command('greet')
  .description('Greet a user')
  .argument('[name]', 'Name to greet', 'world')
  .action((name: string) => {
    logger.info(chalk.green(\`Hello, \${name}! 🎉\`));
  });

program.parse();
`,
      },
      {
        path: path.join(dir, 'src', 'logger.ts'),
        content: pinoLoggerFile(),
      },
      {
        path: path.join(dir, 'src', 'types', 'index.ts'),
        content: isTui
          ? `export interface MenuOption {\n  value: string;\n  label: string;\n  hint?: string;\n}\n`
          : `export interface CliOptions {\n  verbose?: boolean;\n  config?: string;\n}\n`,
      },
      {
        path: path.join(dir, 'src', isTui ? 'commands' : 'utils', '.gitkeep'),
        content: '',
      },
    ];

    return files;
  }
}
