import { GITIGNORE_ROOT } from '../shared/configs.js';
import { type FileDefinition, type GeneratorResult } from '../types.js';
import { logger } from '../utils/logger.js';
import { BaseGenerator } from './base.generator.js';
import { MernGenerator } from './mern.generator.js';
import { NextjsGenerator } from './nextjs.generator.js';
import { ViteGenerator } from './vite.generator.js';

export class FullstackGenerator extends BaseGenerator {
  // FullstackGenerator overrides generate() entirely, so buildFiles is never
  // called via the template method. Provide a stub to satisfy the abstract contract.
  protected buildFiles(_dir: string): FileDefinition[] {
    return [];
  }

  async generate(): Promise<GeneratorResult> {
    logger.header('Generating fullstack project...');
    logger.info('');

    let frontendGenerator: ViteGenerator | NextjsGenerator;
    if (this.options.frontendFramework === 'nextjs') {
      frontendGenerator = new NextjsGenerator(this.options);
    } else {
      frontendGenerator = new ViteGenerator(this.options);
    }

    const backendGenerator = new MernGenerator(this.options);

    logger.info('━━━ Frontend ━━━');
    const frontendResult = await frontendGenerator.generate();
    logger.info('');
    logger.info('━━━ Backend ━━━');
    const backendResult = await backendGenerator.generate();
    logger.info('');

    const totalFiles = frontendResult.filesCreated + backendResult.filesCreated;

    // Create root files (.gitignore always, workspace files only for pnpm)
    await this.createRootWorkspace();

    return {
      filesCreated: totalFiles,
      dir: this.options.projectDir,
    };
  }

  private async createRootWorkspace(): Promise<void> {
    const files: Array<{ path: string; content: string }> = [
      {
        path: this.resolvePath('.gitignore'),
        content: GITIGNORE_ROOT,
      },
    ];

    if (this.options.packageManager === 'pnpm') {
      const rootPackageJson = {
        name: this.options.projectName,
        private: true,
        scripts: {
          dev: 'concurrently "pnpm --filter server dev" "pnpm --filter client dev"',
          build: 'pnpm --filter client build && pnpm --filter server build',
          lint: 'pnpm --filter client lint && pnpm --filter server typecheck',
        },
        devDependencies: {
          concurrently: '^9.1.0',
        },
      };

      files.push(
        {
          path: this.resolvePath('package.json'),
          content: this.formatJson(rootPackageJson),
        },
        {
          path: this.resolvePath('pnpm-workspace.yaml'),
          content: `packages:
  - '${this.options.frontendDirName}'
  - '${this.options.backendDirName}'
`,
        }
      );
    }

    await this.writeFiles(files);

    const names = files.map((f) => f.path.split('\\').pop() || f.path.split('/').pop());
    logger.info(`Root files created: ${names.join(', ')}`);
  }
}
