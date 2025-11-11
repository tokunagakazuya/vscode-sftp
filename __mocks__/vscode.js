// use original console log implementation to avoid jest decorations
const log = require('console').log.bind(console);
const { vol } = require('memfs');
const path = require('path');

const Nothing = (() => {
	const fn = () => Nothing
	fn.toString = fn.toLocaleString = fn[Symbol.toPrimitive] = () => ''
	fn.valueOf = () => false

	return new Proxy(fn, {
		get: (o, key) => o.hasOwnProperty(key) ? o[key] : Nothing
	})
})()


// if running in VSCode through 'Launch Tests' task, global.vscode has been set by test/jest-vscode-environment
// otherwise, vscode is mocked as Nothing
module.exports = global.vscode || Nothing;

const vscode = module.exports;

// Mock vscode OutputChannel to include source location in log messages and display in console during tests
// OutputChannel is normally not visible during tests, making it hard to trace log origins
// it is used by logger.ts via output.ts
vscode.window.createOutputChannel = () => {
	return {
		appendLine: (msg) => {
			// Error stack in the form:
			// 0: Error:
			// 1:  at Object.appendLine (C:\\Users\\bruno\\Projects\\vscode-sftp-2\\src\\fileHandlers\\transfer\\__tests__\\transfer-test.ts:29:34)',
			// 2:  at Object.print (C:\\Users\\bruno\\Projects\\vscode-sftp-2\\src\\ui\\output.ts:45:19)',
			// 3:  at VSCodeLogger.Object.<anonymous>.logger_1.default.log [as log] (C:\Users\bruno\Projects\vscode-sftp-2\src\fileHandlers\transfer\__tests__\transfer-test.ts:41:54)
			// 4:  at VSCodeLogger.info (C:\Users\bruno\Projects\vscode-sftp-2\src\logger.ts:29:14)
			//
			// 5:  at TransferTask.<anonymous> (C:\Users\bruno\Projects\vscode-sftp-2\src\core\transferTask.ts:160:34)
			//   or
			//     at C:\Users\bruno\Projects\vscode-sftp-2\src\fileHandlers\transfer\transfer.ts:129:34
			//
			//  6: at Generator.next (<anonymous>)
			//  7: at fulfilled (C:\Users\bruno\Projects\vscode-sftp-2\src\core\transferTask.ts:5:58)
			//
			// The location line is right after consecutive lines containing "at VSCodeLogger."
			let LOCATION_LINE_INDEX = 0;
			const stack = (new Error).stack?.split('\n');
			do { LOCATION_LINE_INDEX++ } while (LOCATION_LINE_INDEX < stack.length && !stack[LOCATION_LINE_INDEX].includes("at VSCodeLogger."));
			do { LOCATION_LINE_INDEX++ } while (LOCATION_LINE_INDEX < stack.length && stack[LOCATION_LINE_INDEX].includes("at VSCodeLogger."));
			const locationLine = stack[LOCATION_LINE_INDEX < stack.length ? LOCATION_LINE_INDEX : stack.length - 1];

			// get workspace dir to transform paths to relative
			// this will allow displaying shorter paths and have vscode debug console highlight links to the files
			const workspaceDir = __dirname + '/..'; // we know we are in <workspace_dir>/__mocks__

			// line in the form:
			//  at TransferTask.<anonymous> (C:\Users\bruno\Projects\vscode-sftp-2\src\core\transferTask.ts:160:34)
			// or
			//  at C:\Users\bruno\Projects\vscode-sftp-2\src\fileHandlers\transfer\transfer.ts:129:34
			const location =
				'.' + path.sep + path.relative(workspaceDir,
					locationLine.includes('(')
						? locationLine.replace(/^[^(]+\((.*)\)$/, '$1').replaceAll('/', '\\')
						: locationLine.replace(/^ +at +/, ''))
				;
			const f = locationLine.includes('(') ? locationLine.split(/ +/).slice(2, 3) : '';

			const msgs = msg.split(' ');

			log(`${msgs[0]} ${msgs[1]} ${msgs[2]} ${location} (${f}) ${msgs.slice(3).join(' ')}`);//, (new Error).stack);
		}
	}
}

if (!global.vscode) {
	// we are running outside of vscode, hence we need to emulate some missing functions

	class Uri { }
	vscode.Uri = Uri.prototype.constructor;

	vscode.Uri.file = (fsPath) => {
		let uri = new Uri();
		uri.scheme = 'file';
		uri.path = fsPath;
		uri.fsPath = fsPath.replaceAll('/', '\\');
		uri.query = '';
		uri.fragment = '';
		uri.toString = () => fsPath;

		return uri;
	};

	vscode.Uri.parse = (uriString) => {
		const re = /^([a-zA-Z]+):\/\/(\/{0,3})([^\/\?#]+)([^\?#]*)?(\?[^#]*)?(#.*)?$/;
		const match = re.exec(uriString);
		const uri = vscode.Uri.file(match[4]);
		uri.scheme = match[1];
		uri.query = match[5] ? decodeURIComponent(match[5].substring(1)) : '';
		return uri;
	}


	class RelativePattern {
		constructor(base, pattern) {
			this.base = base;
			this.pattern = pattern;
		}
	}
	vscode.RelativePattern = RelativePattern.prototype.constructor;
}

// force printDebugLog to true for tests
vscode.workspace.getConfiguration = (section, resource) => {
	if (section === EXTENSION_NAME) {
		return {
			printDebugLog: true
		};
	}
}

class mockedFSWatcher {
	createListener;
	changeListener;
	deleteListener;
	watcher;

	constructor(globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents) {
		const root = globPattern.base.replace(/\\/g, '/');
		this.watcher = vol.watch(root, { persistent: false, recursive: true }, (eventType, filename) => {

			const fsPath = root + '/' + filename;
			const uri = vscode.Uri.file(fsPath);

			if (eventType === 'rename') {
				if (!vol.existsSync(uri.fsPath)) {
					if (!ignoreDeleteEvents) this.deleteListener(uri);
				} else {
					if (!ignoreCreateEvents) this.createListener(uri);
				}
			} else if (eventType === 'change') {
				if (!ignoreChangeEvents) this.changeListener(uri);
			}
		});
	}

	onDidCreate(fn) {
		this.createListener = fn;
	}
	onDidChange(fn) {
		this.changeListener = fn;
	}
	onDidDelete(fn) {
		this.deleteListener = fn;
	}
	dispose() {
		this.watcher.close();
	}

}

/** @type {(globPattern: GlobPattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher} */
const createFileSystemWatcher = (globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents) => {
	const watcher = new mockedFSWatcher(globPattern, ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents);

	return watcher;

};

vscode.workspace.createFileSystemWatcher = createFileSystemWatcher;

// side effect: add fake remoteExplorer to app
const app = require('../src/app');
const { EXTENSION_NAME } = require('../src/constants');
app.default.remoteExplorer = {
	refresh: () => { }
};
