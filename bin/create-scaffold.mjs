#!/usr/bin/env node
import { execa } from 'execa';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '../src/index.ts');
const args = process.argv.slice(2);

// Resolve tsx and convert to file:// URL so --import works from any CWD on Windows
const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve('tsx')).href;

const result = await execa('node', ['--import', tsxLoader, entry, ...args], {
  stdio: 'inherit',
  reject: false,
});

process.exit(result.exitCode);
