import path from 'node:path';

import { GITIGNORE_DEFAULT } from '../shared/configs.js';
import { type FileDefinition } from '../types.js';
import { BaseGenerator } from './base.generator.js';

export class SystemGenerator extends BaseGenerator {
  protected getStepLabel(): string {
    return 'Generating blank project structure...';
  }

  protected getSuccessMessage(dir: string): string {
    return `Blank project created in ${dir}`;
  }

  protected buildFiles(dir: string): FileDefinition[] {
    return [
      {
        path: path.join(dir, '.gitignore'),
        content: GITIGNORE_DEFAULT,
      },
      {
        path: path.join(dir, 'README.md'),
        content: `# ${this.options.projectName}\n\nBlank project scaffolded with \`create-scaffold\`.\n\n## Getting Started\n\n\`\`\`bash\n${this.options.packageManager} install\n\`\`\`\n`,
      },
    ];
  }
}
