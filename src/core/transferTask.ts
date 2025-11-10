import { Readable } from 'stream';
import * as fileOperations from './fileBaseOperations';
import { FileSystem, FileType } from './fs';
import { Task } from './scheduler';
import logger from '../logger';
import { t } from '../i18n';

let hasWarnedModifedTimePermission = false;

export enum TransferDirection {
  LOCAL_TO_REMOTE = 'local ➞ remote',
  REMOTE_TO_LOCAL = 'remote ➞ local',
}

interface FileHandle {
  fsPath: string;
  fileSystem: FileSystem;
}

export interface TransferOption {
  atime: number;
  mtime: number;
  mode?: number;
  filePerm?: number;
  dirPerm?: number;
  fallbackMode?: number;
  perserveTargetMode: boolean;
  useTempFile?: boolean;
  openSsh?: boolean;
  // When uploading local -> remote, warn if the remote file
  // is newer than the local copy before overwriting it.
  warnOnNewerRemote?: boolean;
  // during Sync Both Directions, do not perform any actual transfer
  dryRun?: boolean;
}

export default class TransferTask implements Task {
  readonly fileType: FileType;
  private readonly _srcFsPath: string;
  private readonly _targetFsPath: string;
  private readonly _srcFs: FileSystem;
  private readonly _targetFs: FileSystem;
  private readonly _transferDirection: TransferDirection;
  private readonly _TransferOption: TransferOption;
  private _handle: Readable;
  private _cancelled: boolean;
  // private _fileStatus: FileStatus;

  constructor(
    src: FileHandle,
    target: FileHandle,
    option: {
      fileType: FileType;
      transferDirection: TransferDirection;
      transferOption: TransferOption;
    }
  ) {
    this._srcFsPath = src.fsPath;
    this._targetFsPath = target.fsPath;
    this._srcFs = src.fileSystem;
    this._targetFs = target.fileSystem;
    this._TransferOption = option.transferOption;
    this._transferDirection = option.transferDirection;
    this.fileType = option.fileType;
  }

  get localFsPath() {
    if (this._transferDirection === TransferDirection.REMOTE_TO_LOCAL) {
      return this._targetFsPath;
    } else {
      return this._srcFsPath;
    }
  }

  get srcFsPath() {
    return this._srcFsPath;
  }

  get targetFsPath() {
    return this._targetFsPath;
  }

  get transferType() {
    return this._transferDirection;
  }

  async run() {
    const src = this._srcFsPath;
    const target = this._targetFsPath;
    const srcFs = this._srcFs;
    const targetFs = this._targetFs;
    switch (this.fileType) {
      case FileType.File:
        await this._transferFile();
        break;
      case FileType.SymbolicLink:
        await fileOperations.transferSymlink(
          src,
          target,
          srcFs,
          targetFs,
          this._TransferOption
        );
        break;
      default:
        logger.warn(`Unsupported file type (type = ${this.fileType}). File ${src}`);
    }
  }

  cancel() {
    if (this._handle && !this._cancelled) {
      this._cancelled = true;
      FileSystem.abortReadableStream(this._handle);
    }
  }

  isCancelled(): boolean {
    return this._cancelled;
  }

  private async _transferFile() {
    const src = this._srcFsPath;
    const target = this._targetFsPath;
    const srcFs = this._srcFs;
    const targetFs = this._targetFs;
    // Warn if remote is newer (only applies to local ➞ remote uploads)
    if (
      this._transferDirection === TransferDirection.LOCAL_TO_REMOTE &&
      this._TransferOption &&
      this._TransferOption.warnOnNewerRemote
    ) {
      try {
        const [localStat, remoteStat] = await Promise.all([
          srcFs.lstat(src),
          targetFs.lstat(target).catch(() => null),
        ]);
        if (remoteStat) {
          const DRIFT = 1000; // tolerate 1s drift
          if (remoteStat.mtime > localStat.mtime + DRIFT) {
            // Lazy import to avoid a hard dependency cycle
          const { showConfirmMessage } = await import('../host');
          const ok = await showConfirmMessage(
            t('sftp.message.newerRemote', 'The remote file is newer than your local copy. Upload anyway and overwrite the newer remote file?'),
            t('sftp.button.uploadAnyway', 'Upload anyway'),
            t('sftp.button.skip', 'Skip'),
            { modal: true, severity: 'warn' }
          );
            if (!ok) {
              return; // skip this file
            }
          }
        }
      } catch {
        // Ignore check errors and continue upload
      }
    }
    const {
      perserveTargetMode,
      useTempFile,
      openSsh,
      fallbackMode,
      dryRun,
      atime,
      mtime,
      filePerm
    } = this._TransferOption;
    // Set the mode if it's specified in the config, otherwise get mode from server.
    let mode = filePerm ? parseInt(String(filePerm), 8) : this._TransferOption.mode;
    let targetFd; // Destination file
    let uploadFd; // Temp file or destination file when no temp file is used
    const uploadTarget = target + (useTempFile ? ".new" : "");

    if (!dryRun) {
      // Use mode first.
      // Then check perserveTargetMode and fallback to fallbackMode if fail to get mode of target
      if (mode === undefined && perserveTargetMode) {
        if (useTempFile) {
          [targetFd, uploadFd] = await Promise.all([
            targetFs.open(target, 'r')  // Get handle for reading the target mode
              .catch(() => null), // Return null if target file doesn't exist
            targetFs.open(uploadTarget, 'w')  // Get handle for the file upload
          ]);
        } else {
          targetFd = uploadFd = await targetFs.open(uploadTarget, 'w');
        }

        if (targetFd) {
          [this._handle, mode] = await Promise.all([
            srcFs.get(src),
            targetFs
              .fstat(targetFd)
              .then(stat => stat.mode)
              .catch(() => fallbackMode),
          ]);

          if (useTempFile) {
            targetFs.close(targetFd);
          }

        } else {
          this._handle = await srcFs.get(src);
          mode = fallbackMode;
        }

      } else {
        [this._handle, uploadFd] = await Promise.all([
          srcFs.get(src),
          targetFs.open(uploadTarget, 'w'),
        ]);
      }
    }

    try {
      if (useTempFile) {
        logger.info((dryRun ? "would upload" : "uploading") + " temp file: " + uploadTarget);
      }
      dryRun || await targetFs.put(this._handle, uploadTarget, {
        mode,
        fd: uploadFd,
        autoClose: false,
      });
      if (!dryRun && atime && mtime) {
        try {
          await targetFs.futimes(
            uploadFd,
            Math.floor(atime / 1000),
            Math.floor(mtime / 1000)
          );
        } catch (error) {
          if (!hasWarnedModifedTimePermission) {
            hasWarnedModifedTimePermission = true;
            logger.warn(
              `Can't set modified time to the file because ${error.message}`
            );
          }
        }
      }

      if (useTempFile) {
        if (dryRun) {
          logger.info("would move from: " + target + ".new" + " to: " + target);
        } else {
          logger.info("moving from: " + target + ".new" + " to: " + target);
          if (openSsh) {
            await targetFs.renameAtomic(uploadTarget, target);
          } else {
            try {
              await targetFs.unlink(target);
            } catch (error) {
              // Just ignore
            }
            await targetFs.rename(uploadTarget, target);
          }
        }
      }

    } finally {
      dryRun || await targetFs.close(uploadFd);
    }
  }
}
