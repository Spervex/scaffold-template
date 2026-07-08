import { BaseGenerator } from './base.generator.js';
import { type CliOptions, type FileDefinition, type GeneratorResult } from '../types.js';
import { logger } from '../utils/logger.js';
import { mergeDeps, applyExtras } from '../shared/packages.js';

function getSystemPackageJson(options: CliOptions): Record<string, unknown> {
  const base = {
    name: options.projectName,
    version: '1.0.0',
    private: true,
    type: 'module',
  };
  return mergeDeps(base, options, false) as Record<string, unknown>;
}

export class SystemGenerator extends BaseGenerator {
  async generate(): Promise<GeneratorResult> {
    logger.step('Generating blank project structure...');

    const files: FileDefinition[] = this.getFiles();

    await this.writeFiles(files);

    logger.success(`Blank project created in ${this.options.projectDir}`);
    return { filesCreated: files.length, dir: this.options.projectDir };
  }

  private getFiles(): FileDefinition[] {
    const files: FileDefinition[] = [
      {
        path: this.resolvePath('package.json'),
        content: this.formatJson(getSystemPackageJson(this.options)),
      },
      {
        path: this.resolvePath('.gitignore'),
        content: `node_modules
dist
.env
.env.local
*.log
`,
      },
      {
        path: this.resolvePath('README.md'),
        content: `# ${this.options.projectName}

A blank project scaffolded with \`create-scaffold\`.

## Getting Started

\`\`\`bash
${this.options.packageManager} install
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`${this.options.packageManager} dev\` | Start development server |
| \`${this.options.packageManager} build\` | Build for production |
`,
      },
      {
        path: this.resolvePath('src', '.gitkeep'),
        content: '',
      },
    ];

    // Add extra files from selected packages
    const { files: extraFiles } = applyExtras(this.options, this.options.projectDir);
    files.push(...extraFiles);

    return files;
  }
}
