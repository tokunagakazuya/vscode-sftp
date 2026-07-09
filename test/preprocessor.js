const ts = require('typescript');
const tsConfig = require('../tsconfig.json');

module.exports = {
  process(src, filename) {
    if (filename.endsWith('.ts')) {
      const res = ts.transpileModule(src, {
        compilerOptions: {
          ...tsConfig.compilerOptions,
          
          // for source maps to work properly with jest, the following 2 conditions must be met:
          // - inlineSourceMap generation at compilation time
          // - path "${workspaceFolder}/**" must be specified in "resolveSourceMapLocations" property of the launch task
          sourceMap: false, inlineSourceMap: true
        },
        fileName: filename,
        reportDiagnostics: false,
      });
      return { code: res.outputText };
    }
    return { code: src };
  },
};
