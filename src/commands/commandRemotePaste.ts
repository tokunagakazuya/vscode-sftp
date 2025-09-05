import * as path from 'path';
import { Uri } from 'vscode';
import { checkCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { handleCtxFromUri } from '../fileHandlers';
import { getRemoteClipboard, clearRemoteClipboard } from '../modules/remoteClipboard';
import { FileType } from '../core';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';

async function copyRecursive(remotefs: any, src: string, dest: string) {
  const stat = await remotefs.lstat(src);
  if (stat.type === FileType.Directory) {
    await remotefs.ensureDir(dest);
    const entries = await remotefs.list(src);
    for (const e of entries) {
      const childSrc = e.fspath;
      const childDest = path.posix.join(dest, e.name);
      await copyRecursive(remotefs, childSrc, childDest);
    }
  } else {
    await remotefs.ensureDir(remotefs.pathResolver.dirname(dest));
    const read = await remotefs.get(src);
    await remotefs.put(read, dest);
  }
}

export default checkCommand({
  id: 'sftp.remote.paste',
  async handleCommand(item?: Uri) {
    const clip = getRemoteClipboard();
    if (!clip) {
      // i18n not strictly necessary, but keep consistent
      // eslint-disable-next-line no-restricted-syntax
      const msg = t('sftp.message.clipboardEmpty', 'Clipboard is empty');
      require('../host').showInformationMessage(msg);
      return;
    }
    const target = uriFromExplorerContextOrEditorContext(item, undefined);
    if (!target) return;
    const ctx = handleCtxFromUri(Array.isArray(target) ? target[0] : target);
    const serviceId = ctx.fileService.id;
    if (serviceId !== clip.serviceId) {
      const msg = t('sftp.message.cannotPasteAcrossRemotes', 'Cannot paste across different remotes');
      require('../host').showWarningMessage(msg);
      return;
    }
    const remotefs = await ctx.fileService.getRemoteFileSystem(ctx.config);
    // Determine destination directory:
    // - If target is a folder, paste into it
    // - If target is a file, paste into its parent folder (for parity with VS Code Explorer)
    let destDir = ctx.target.remoteFsPath;
    try {
      const stat = await remotefs.lstat(destDir);
      if (stat.type !== FileType.Directory) {
        destDir = remotefs.pathResolver.dirname(destDir);
      }
    } catch {
      // If lstat fails (e.g., target disappeared), fallback to parent directory
      destDir = remotefs.pathResolver.dirname(destDir);
    }

    // Confirm action (always):
    const count = clip.entries.length;
    const isMove = clip.action === 'cut';
    const titleKey = isMove ? 'sftp.message.pasteConfirmMove' : 'sftp.message.pasteConfirmCopy';
    const message = `${t(titleKey, isMove ? 'Move items?' : 'Copy items?')}\n${count} item(s) → ${destDir}`;
    const ok = await showConfirmMessage(message, t('sftp.button.ok', 'OK'), t('sftp.button.cancel', 'Cancel'), { modal: true, severity: 'warn' });
    if (!ok) return;
    const errors: Array<{ src: string; error: any }> = [];
    for (const entry of clip.entries) {
      const base = path.posix.basename(entry.path);
      const destPath = path.posix.join(destDir, base);
      try {
        if (clip.action === 'cut') {
          // if destination exists, remove to guarantee overwrite
          try {
            const st = await remotefs.lstat(destPath);
            if (st.type === FileType.Directory) await remotefs.rmdir(destPath, true);
            else await remotefs.unlink(destPath);
          } catch { /* not exists */ }

          try {
            if (typeof remotefs.renameAtomic === 'function') await remotefs.renameAtomic(entry.path, destPath);
            else await remotefs.rename(entry.path, destPath);
          } catch (err) {
            // fallback to copy+delete
            await copyRecursive(remotefs, entry.path, destPath);
            await remotefs.unlink(entry.path).catch(async () => {
              try { await remotefs.rmdir(entry.path, true); } catch { /* ignore */ }
            });
          }
        } else {
          // copy: overwrite files, merge folders
          await copyRecursive(remotefs, entry.path, destPath);
        }
      } catch (error) {
        errors.push({ src: entry.path, error });
      }
    }
    clearRemoteClipboard();
    if (errors.length) {
      const msg = `Failed on ${errors.length}/${clip.entries.length} item(s).`;
      require('../host').showWarningMessage(msg);
    }
  },
});
