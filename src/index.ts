#!/usr/bin/env node

import { runTui } from './tui.js';
import { logger } from './utils/logger.js';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:');
  console.error(reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:');
  console.error(error);
  process.exit(1);
});

await runTui();
