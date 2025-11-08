import { SummaryReporter } from '@jest/reporters';
import { BaseReporter } from '@jest/reporters';
import chalk from 'chalk';

// needs to be used in conjunction with defining FORCE_COLORS="true" (used by chalk/supports-color)
BaseReporter.prototype.log = function log(message: string) {
    process.stdout.write(`${chalk.white(`${message}`)}\n`);
}

export default SummaryReporter;


