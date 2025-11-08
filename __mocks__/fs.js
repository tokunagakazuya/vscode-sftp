const { fs } = require('memfs');

fs.__mock__ = true;

// suppress "Warning: fs.realpath.native is not a function. Is fs being monkey-patched?"
if (typeof fs.realpath.native !== 'function') fs.realpath.native = fs.realpath;

module.exports = fs;
