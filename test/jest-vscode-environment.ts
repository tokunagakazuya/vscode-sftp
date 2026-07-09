/**
 * Exposes the Visual Studio Code extension API to the Jest testing environment.
 *
 * Tests would otherwise not have access because they are sandboxed.
 *
 * @see https://github.com/Unibeautify/vscode/blob/61897cd6cd0567db2c8688c3c0b835f9b5c5b446/test/jest-vscode-environment.ts
 */

import NodeEnvironment from 'jest-environment-node';

class VsCodeEnvironment extends NodeEnvironment {
    constructor(config: any, context: any) {
        super(config, context);
    }

    public async setup() {
        await super.setup();
        this.global.vscode = require('vscode');
    }

    public async teardown() {
        delete this.global.vscode;
        await super.teardown();
    }

    public getVmContext() {
        return super.getVmContext();
    }
}

module.exports = VsCodeEnvironment;