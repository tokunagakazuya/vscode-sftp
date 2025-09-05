import { refreshRemoteExplorer } from './shared';
import upath from '../core/upath';
import { UResource } from '../core';
import { fileOperations } from '../core';
import createFileHandler from './createFileHandler';
import { FileHandleOption } from './option';

export const createRemoteFile = createFileHandler<FileHandleOption & { skipDir?: boolean }>({
  name: 'createRemoteFile',
  async handle(option) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;

    let promise;
    promise = fileOperations.createFile(remoteFsPath, remoteFs, {});

    /*
    const stat = await remoteFs.lstat(remoteFsPath);
    switch (stat.type) {
      case FileType.Directory:
        if (option.skipDir) {
          return;
        }
        promise = fileOperations.createDir(remoteFsPath, remoteFs, {});
        // promise = fileOperations.removeDir(remoteFsPath, remoteFs, {});
        break;
      case FileType.File:
      case FileType.SymbolicLink:
        // promise = fileOperations.removeFile(remoteFsPath, remoteFs, {});
        break;
      default:
        throw new Error(`Unsupported file type (type = ${stat.type})`);
    }*/
    await promise;
  },
  transformOption() {
    const config = this.config;
    return {
      ignore: config.ignore,
    };
  },
  afterHandle() {
    // Refresh parent folder to show the newly created file
    const currentRes = UResource.makeResource(this.target.remoteUri);
    const parent = UResource.updateResource(currentRes, { remotePath: upath.dirname(this.target.remoteFsPath) });
    // Use app.remoteExplorer to pass Resource directly
    const { default: app } = require('../app');
    app.remoteExplorer.refresh({ resource: parent, isDirectory: true });
  },
});

export const createRemoteFolder = createFileHandler<FileHandleOption & { skipDir?: boolean }>({
  name: 'createRemoteFolder',
  async handle(option) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;

    let promise;
    promise = fileOperations.createDir(remoteFsPath, remoteFs, {});

    /*
    const stat = await remoteFs.lstat(remoteFsPath);
    switch (stat.type) {
      case FileType.Directory:
        if (option.skipDir) {
          return;
        }
        promise = fileOperations.createDir(remoteFsPath, remoteFs, {});
        // promise = fileOperations.removeDir(remoteFsPath, remoteFs, {});
        break;
      case FileType.File:
      case FileType.SymbolicLink:
        // promise = fileOperations.removeFile(remoteFsPath, remoteFs, {});
        break;
      default:
        throw new Error(`Unsupported file type (type = ${stat.type})`);
    }*/
    await promise;
  },
  transformOption() {
    const config = this.config;
    return {
      ignore: config.ignore,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, false);
  },
});
