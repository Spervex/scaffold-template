import chalk from 'chalk';

export const logger = {
  info(msg: string): void {
    console.log(chalk.blue(msg));
  },

  success(msg: string): void {
    console.log(chalk.green(msg));
  },

  warn(msg: string): void {
    console.log(chalk.yellow(msg));
  },

  error(msg: string): void {
    console.error(chalk.red(msg));
  },

  debug(msg: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray(msg));
    }
  },

  step(msg: string): void {
    console.log(chalk.cyan(`→ ${msg}`));
  },

  header(msg: string): void {
    console.log(chalk.bold.white(msg));
  },
};
