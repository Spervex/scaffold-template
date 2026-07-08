import path from 'node:path';
import { type CliOptions, type FileDefinition, type GeneratorResult } from '../types.js';
import { writeFiles } from '../utils/file.js';

export abstract class BaseGenerator {
  constructor(protected options: CliOptions) {}

  abstract generate(): Promise<GeneratorResult>;

  protected async writeFiles(files: FileDefinition[]): Promise<void> {
    await writeFiles(files);
  }

  protected resolvePath(...segments: string[]): string {
    return path.join(this.options.projectDir, ...segments);
  }

  protected formatJson(data: Record<string, unknown>): string {
    return JSON.stringify(data, null, 2) + '\n';
  }
}
