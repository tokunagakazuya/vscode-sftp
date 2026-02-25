import { FileServiceConfig } from "../../src/core";
import fillFs, { FileTree } from "./fillFs";
import * as serviceManager from '../../src/modules/serviceManager';
import { setTimeout } from "timers/promises";
import * as output from '../../src/ui/output';


/**
 * Prepare test by:
 * - loading a config, 
 * - creating the local and remote file structures,
 * - running some preparatory instructions (e.g. to complement the file structures)
 *   before the watcher is started
 * - running the watcher according to the config
 * - running additional instructions which are under the control of the watcher
 * @param config 
 * @param local 
 * @param remote 
 * @param beforeWatchInstructions 
 * @param watchedInstructions 
 * @returns 
 * * A file service created according to the config. You must dispose it after use.
 * * Log information produced in the output panel, once the watcher is started,
 *   presented under different forms: 
 *   - logLines: all captured log lines
 *   - sortedUniqArrowLines: all sorted unique captured log lines 
 *   - arrowLines: [info] lines containing an arrow ➞ (file transfers)
 *   - calls: raw calls to output print function
 */
const prepareTest = async (testConfig: {
    config: Partial<FileServiceConfig>,
    local: FileTree,
    remote: FileTree,
    beforeWatchInstructions?: () => void | Promise<void>,
    watchedInstructions?: () => void | Promise<void>,
}) => {

    const _waitUntilAllTransfersCompletedAndDispose = async () => {
        if (!fileService) return;

        await setTimeout(0); // needed to start processing pending tasks
        if (fileService.getPendingTransferTasks().length == 0) {
            // tasks are created during file transfers, i.e. when
            // files are created/modified.
            // when files are removed, no tasks are created.
            // To make sure all actions are done, we can check
            // pending tasks, but only if some have been create.
            // if no pending task, it may that only deletions were done,
            // in which case we need to wait a bit for the deletions to complete
            await setTimeout(2000);
        }
        while (fileService.getPendingTransferTasks().length > 0) {
            await setTimeout(0);
        }
    }

    fillFs({
        local: testConfig.local,
        remote: testConfig.remote,
    });

    const defaultConfig: Partial<FileServiceConfig> = {
        "host": "some host",
        "protocol": "local",
        "port": 22,
        "username": "some user",
        "remotePath": "/remote",
        "concurrency": 1,
        "uploadOnSave": false,
        "watcher": {
            "files": "**/*",
            "ignore": [
                "node_modules",
            ],
            "autoUpload": true,
            "autoDelete": true
        },
        "syncOption": {
            "delete": true,
            "update": true,
            "skipCreate": false,
            "ignoreExisting": false,
        },
        "ignore": [
        ],
        "useTempFile": true,
        "openSsh": true
    }

    testConfig.beforeWatchInstructions && await testConfig.beforeWatchInstructions();

    testConfig.beforeWatchInstructions && await testConfig.beforeWatchInstructions();

    const fileService = serviceManager.createFileService({ ...defaultConfig, ...testConfig.config }, "/local");
    const scheduler = fileService.createTransferScheduler(1);
    scheduler.add
    const outputSpy: jest.SpyInstance<void, string[]> = jest.spyOn(output, 'print');

    testConfig.watchedInstructions && await testConfig.watchedInstructions();

    await _waitUntilAllTransfersCompletedAndDispose();

    const logLines = outputSpy.mock.calls.map(lineArr => lineArr.slice(2).join(' '));
    const arrowLines = outputSpy.mock.calls.filter(lineArr => lineArr[1] === '[info]' && lineArr.join(' ').includes(' ➞ ')).map((lineArr: string[]) => lineArr.slice(2).join(' '));

    outputSpy.mockRestore();

    return {
        fileService,
        logLines,
        arrowLines,
        sortedUniqArrowLines: [...new Set(arrowLines)].sort(),
        calls: outputSpy.mock.calls
    };
}

export default prepareTest;


