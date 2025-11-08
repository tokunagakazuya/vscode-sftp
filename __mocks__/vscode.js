// use original console log implementation to avoid jest decorations
const log = require('console').log.bind(console);

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

// Mock vscode OutputChannel to include source location in log messages and display in console during tests
// OutputChannel is normally not visible during tests, making it hard to trace log origins
// it is used by logger.ts via output.ts
module.exports.window.createOutputChannel = () => {
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
			let LOCATION_LINE_INDEX = 5;
			const locationLine = (new Error).stack?.split('\n')[LOCATION_LINE_INDEX];

			// line in the form:
			//  at TransferTask.<anonymous> (C:\Users\bruno\Projects\vscode-sftp-2\src\core\transferTask.ts:160:34)
			// or
			//  at C:\Users\bruno\Projects\vscode-sftp-2\src\fileHandlers\transfer\transfer.ts:129:34
			const location = locationLine ? locationLine.split(/[\\:]/).slice(-3, -2).join(':') : ''; // do not take line number as not accurate (from compiled JS?)
			const f = locationLine && locationLine.includes('(') ? locationLine.split(/ +/).slice(2, 3) : '';

			const msgs = msg.split(' ');

			log(`${msgs[0]} ${msgs[1]} ${msgs[2]} ${location} (${f}) ${msgs.slice(3).join(' ')}`);//, (new Error).stack);
		}
	}
}
