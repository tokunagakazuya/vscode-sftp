import * as vscode from 'vscode';
import * as debounce from 'lodash.debounce';
import logger from '../logger';
import { isValidFile, fileDepth } from '../helper';
import { upload, removeRemote } from '../fileHandlers';
import { WatcherService, TransferDirection } from '../core';
import app from '../app';
import StatusBarItem from '../ui/statusBarItem';
import { getRunningTransformTasks } from './serviceManager';
import { realpathSync } from 'fs';

const watchers: {
  [x: string]: vscode.FileSystemWatcher;
} = {};

const uploadQueue = new Set<vscode.Uri>();
const deleteQueue = new Set<vscode.Uri>();

// less than 550 will not work
const ACTION_INTEVAL = 550;

function doUpload() {
  const files = Array.from(uploadQueue).sort((a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath));
  uploadQueue.clear();

  files.forEach(async uri => {

    const fspath = uri.fsPath;
    logger.info(`[watcher/updated] ${fspath}`);
    try {
      await upload(uri);
    } catch (error) {
      logger.error(error, `upload ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  });
}

function doDelete() {
  const files = Array.from(deleteQueue).sort((a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath));
  deleteQueue.clear();
  files.forEach(async uri => {
    const fspath = uri.fsPath;
    logger.info(`[watcher/removed] ${fspath}`);
    try {
      await removeRemote(uri);
    } catch (error) {
      if (error.message.includes('ENOENT')) {
        // No such file
        // In the case of deletion of files and folders, no task is created, no task is registered in the pendingTasks list.
        // The deletion is performed "immediately", i.e. in doDelete function.
        // Hence, the deletion triggered by the watcher due to the sync deletion cannot be avoided 
        // as opposed to what is done in upload functions.
        // TODO: maybe refactor the deletion to be task based too?
      } else {
        logger.info(error, `remove ${fspath}`, error.message);
        app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
      }
    }
  });
}

const debouncedUpload = debounce(doUpload, ACTION_INTEVAL, { leading: true, trailing: true });
const debouncedDelete = debounce(doDelete, ACTION_INTEVAL, { leading: true, trailing: true });

function uploadHandler(uri: vscode.Uri) {
  if (!isValidFile(uri)) {
    return;
  }

  // further to debounce, look in current uploadQueue if we have already planned to upload the file
  // 
  // Note: possibly maybe we should see how to handle the case where this is already an uploading task for this file ?
  // - cancel the existing not running tasks and add a new one in uploadQueue?
  // - also maybe we should have a look at the scheduler to make sure 2 tasks on the same file cannot run in parallel
  if (Array.from(uploadQueue).some(u => u.fsPath === uri.fsPath)) {
    // file is already planned to be uploaded, ignore
    return;
  }

  const currentDownloadTasks = getRunningTransformTasks().filter(
    task => task.transferType === TransferDirection.REMOTE_TO_LOCAL
  );

  // current target is still in downloading, so don't upload it.
  // use realpath in the check, to avoid uploading a file which is a symlink to a downloading file.
  if (currentDownloadTasks.find(task => realpathSync(task.localFsPath) === uri.fsPath)) {
    return;
  }


  uploadQueue.add(uri);
  debouncedUpload();
}

function addWatcher(id, watcher) {
  watchers[id] = watcher;
}

function getWatcher(id) {
  return watchers[id];
}

function createWatcher(
  watcherBase: string,
  watcherConfig: { files: false | string; ignore: ((fsPath: string) => boolean) | null, autoUpload: boolean; autoDelete: boolean }
) {
  let watcher = getWatcher(watcherBase);
  if (watcher) {
    // clear old watcher
    watcher.dispose();
  }

  if (!watcherConfig) {
    return;
  }

  const shouldAddListenser = watcherConfig.autoUpload || watcherConfig.autoDelete;
  // tslint:disable-next-line triple-equals
  if (watcherConfig.files == false || !shouldAddListenser) {
    return;
  }

  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(watcherBase, watcherConfig.files),
    false,
    false,
    false
  );
  addWatcher(watcherBase, watcher);

  function checkIgnoredAndUploadHandler(handler: (uri: vscode.Uri) => void) {
    return (uri: vscode.Uri) => {
      if (watcherConfig.ignore && watcherConfig.ignore(uri.fsPath)) {
        return;
      }
      handler(uri);
    }
  }

  if (watcherConfig.autoUpload) {

    watcher.onDidCreate(checkIgnoredAndUploadHandler(uploadHandler));
    watcher.onDidChange(checkIgnoredAndUploadHandler(uploadHandler));
  }

  if (watcherConfig.autoDelete) {
    watcher.onDidDelete(checkIgnoredAndUploadHandler(uri => {
      if (!isValidFile(uri)) {
        return;
      }

      deleteQueue.add(uri);
      debouncedDelete();
    }));
  }
}

function removeWatcher(watcherBase: string) {
  const watcher = getWatcher(watcherBase);
  if (watcher) {
    watcher.dispose();
    delete watchers[watcherBase];
  }
}

const watcherService: WatcherService = {
  create: createWatcher,
  dispose: removeWatcher,
};

export default watcherService;
