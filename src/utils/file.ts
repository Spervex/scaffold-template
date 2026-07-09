import fs from 'node:fs/promises';
import path from 'node:path';

import { type FileDefinition } from '../types.js';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function writeFiles(files: FileDefinition[]): Promise<void> {
  for (const file of files) {
    await writeFile(file.path, file.content);
  }
}

export function formatFilePath(baseDir: string, relativePath: string): string {
  return path.normalize(path.join(baseDir, relativePath));
}
