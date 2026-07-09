import path from 'node:path';

import { applyExtras } from '../shared/packages.js';
import { type CliOptions, type FileDefinition, type GeneratorResult } from '../types.js';
import { writeFiles } from '../utils/file.js';
import { logger } from '../utils/logger.js';

export abstract class BaseGenerator {
  constructor(protected options: CliOptions) {}

  /** Template method — drives the generate cycle. Override hooks below to customize. */
  async generate(): Promise<GeneratorResult> {
    logger.step(this.getStepLabel());
    const dir = this.getTargetDir();
    const files: FileDefinition[] = this.buildFiles(dir);
    // Append extras automatically — subclasses don't need to call this
    files.push(...this.getExtraFiles(dir));
    await this.writeFiles(files);
    logger.success(this.getSuccessMessage(dir));
    return { filesCreated: files.length, dir };
  }

  // ── Hooks for subclasses ──

  protected getStepLabel(): string {
    return 'Generating project...';
  }

  protected getTargetDir(): string {
    return this.options.projectDir;
  }

  protected getSuccessMessage(_dir: string): string {
    return 'Project created successfully!';
  }

  /** Build the file list (without extras — those are appended automatically). */
  protected abstract buildFiles(dir: string): FileDefinition[];

  // ── Shared helpers ──

  protected resolvePath(...segments: string[]): string {
    return path.join(this.options.projectDir, ...segments);
  }

  protected formatJson(data: Record<string, unknown>): string {
    return JSON.stringify(data, null, 2) + '\n';
  }

  protected getExtraFiles(dir: string): FileDefinition[] {
    const { files } = applyExtras(this.options, dir);
    return files;
  }

  protected async writeFiles(files: FileDefinition[]): Promise<void> {
    await writeFiles(files);
  }
}
