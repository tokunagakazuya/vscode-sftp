/**
 * Wires in Jest as the test runner in place of the default Mocha.
 */
import * as path from 'path';
import * as sourceMapSupport from 'source-map-support';
import { runCLI } from 'jest';
import console from 'console';
import { readConfigs } from 'jest-config';
import { BaseReporter } from '@jest/reporters';
import chalk from 'chalk';


// fix __dirname issue, cf. https://flaviocopes.com/fix-dirname-not-defined-es-module-scope/
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AggregatedResult = import('@jest/test-result').AggregatedResult;

const rootDir = path.resolve(__dirname, '../');
const fromRoot = (...subPaths: string[]): string => path.resolve(rootDir, ...subPaths);

// check Argv definition in node_modules/@jest/types/index.d.ts
// to see which properties are allowed with which type.
// the type checking happens at the conversion "as Argv"  
type Argv = Parameters<typeof runCLI>[0];
const jestConfig = {
    rootDir: rootDir,
    verbose: true,
    runInBand: true, // Required due to the way the "vscode" module is injected.
    testEnvironment: fromRoot('test/jest-vscode-environment.ts'),
    watchAll: true,
} as Argv;

export async function run(_testRoot: string, callback: TestRunnerCallback) {
    // Enable source map support. This is done in the original Mocha test runner,
    // so do it here. It is not clear if this is having any effect.
    sourceMapSupport.install();

    // color display of jest results:
    // 1/ the Launch Tests task defines the env variable FORCE_COLOR=true as per https://jestjs.io/docs/cli#--colors
    // 2/ here we patch the reporters' log to override debug console's default color with white 
    BaseReporter.prototype.log = function log(message: string) {
        process.stdout.write(`${chalk.white(`${message}`)}\n`);
    }
    
    try {
        // get the globalConfig (from package.json)
        const { globalConfig } = await readConfigs(jestConfig, [rootDir]);

        console.log('Starting Jest...');
        // For some reason, runCLI fails if watch/watchAll is defined in package.json (globalConfig) and NOT in jestConfig.
        // Hence, we collect the value from globalConfig and override...
        // Note, overriden values must be true or undefined. E.g. watch=true and watchAll=false does not work...
        const config = { ...jestConfig, watch: globalConfig.watch ? true : undefined, watchAll: globalConfig.watchAll ? true : undefined } as Argv
        const { results } = await runCLI(config, [rootDir]);
        console.log('Jest completed.');

        const failures = collectTestFailureMessages(results);
        console.log(`${failures.length > 0 ? failures.length : 'No'} failure${failures.length > 1 ? 's' : ''} collected.`);

        if (failures.length > 0) {
            callback(null, failures);
            return;
        }

        callback(null);
    } catch (e: any) {
        callback(e);
    }
}

/**
 * Collect failure messages from Jest test results.
 *
 * @param results Jest test results.
 */
function collectTestFailureMessages(results: AggregatedResult): string[] {
    const failures = results.testResults.reduce<string[]>((acc, testResult) => {
        if (testResult.failureMessage) acc.push(testResult.failureMessage);
        return acc;
    }, []);

    return failures;
}

export type TestRunnerCallback = (error: Error | null, failures?: any) => void;