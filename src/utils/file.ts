import fs from 'node:fs/promises';
import path from 'node:path';

import { type FileDefinition } from '../types.js';
import { assertSubpath } from './path-safe.js';

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

/**
 * Safely joins baseDir and relativePath, ensuring the result does not escape baseDir.
 * Throws PathTraversalError if relativePath attempts directory traversal.
 */
export function formatFilePath(baseDir: string, relativePath: string): string {
  const fullPath = path.resolve(baseDir, relativePath);
  assertSubpath(baseDir, fullPath);
  return fullPath;
}
