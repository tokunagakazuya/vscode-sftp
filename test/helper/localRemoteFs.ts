import * as fs from 'fs';
import * as fse from 'fs-extra';
import FileSystem, { FileStats } from '../../src/core/fs/fileSystem';
import localfs from '../../src/core/localFs';
import RemoteFileSystem from '../../src/core/fs/remoteFileSystem';

// @ts-ignore
export default class LocalRemoteFileSystem extends RemoteFileSystem {
  _createClient() {
    return {};
  }

  toFileStat(stat: fs.Stats): FileStats {
    return {
      type: FileSystem.getFileTypecharacter(stat),
      size: stat.size,
      mode: stat.mode & parseInt('777', 8), // tslint:disable-line:no-bitwise
      mtime: this.toLocalTime(stat.mtime.getTime()),
      atime: this.toLocalTime(stat.atime.getTime()),
    };
  }

  futimes(fd: number, atime: number, mtime: number): Promise<void> {
    // Use Date objects to avoid seconds/ms ambiguity across fs/memfs implementations
    const at = new Date(this.toRemoteTimeInSecnonds(atime) * 1000);
    const mt = new Date(this.toRemoteTimeInSecnonds(mtime) * 1000);
    return fse.futimes(fd, at, mt);
  }

  // Override put to avoid memfs stream close bug by buffering input
  async put(input: NodeJS.ReadableStream, path: string, option?: any): Promise<void> {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      input.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      input.on('error', reject);
      input.on('end', () => resolve());
    });
    const buffer = Buffer.concat(chunks);
    if (option && typeof option.fd === 'number') {
      await new Promise<void>((resolve, reject) => {
        fs.write(option.fd as number, buffer, 0, buffer.length, 0, err =>
          err ? reject(err) : resolve()
        );
      });
    } else {
      await fse.outputFile(path, buffer, option && option.mode ? { mode: option.mode } : undefined);
    }
  }
}

[
  'toFileEntry',
  'readFile',
  'open',
  'close',
  'fstat',
  'get',
  'mkdir',
  'ensureDir',
  'list',
  'stat',
  'lstat',
  'readlink',
  'symlink',
  'unlink',
  'rmdir',
  'rename',
].forEach(method => {
  Object.defineProperty(LocalRemoteFileSystem.prototype, method, {
    enumerable: false,
    value(...args) {
      const fn = localfs[method];
      return fn.call(this, ...args);
    },
  });
});
