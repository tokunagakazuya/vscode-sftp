import * as path from 'path';
import { Uri, window } from 'vscode';
import { checkCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { handleCtxFromUri } from '../fileHandlers';
import { getRemoteClipboard, clearRemoteClipboard } from '../modules/remoteClipboard';
import { FileType } from '../core';

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
      window.showInformationMessage('Clipboard is empty');
      return;
    }
    const target = uriFromExplorerContextOrEditorContext(item, undefined);
    if (!target) return;
    const ctx = handleCtxFromUri(Array.isArray(target) ? target[0] : target);
    const serviceId = ctx.fileService.id;
    if (serviceId !== clip.serviceId) {
      window.showWarningMessage('Cannot paste across different remotes');
      return;
    }
    const remotefs = await ctx.fileService.getRemoteFileSystem(ctx.config);
    const destDir = ctx.target.remoteFsPath; // paste into this folder
    for (const entry of clip.entries) {
      const base = path.posix.basename(entry.path);
      const destPath = path.posix.join(destDir, base);
      if (clip.action === 'cut') {
        // move
        try {
          if (typeof remotefs.renameAtomic === 'function') await remotefs.renameAtomic(entry.path, destPath);
          else await remotefs.rename(entry.path, destPath);
        } catch (err) {
          // if rename fails (e.g., moving across filesystems), fallback to copy+delete
          await copyRecursive(remotefs, entry.path, destPath);
          await remotefs.unlink(entry.path).catch(async () => {
            try { await remotefs.rmdir(entry.path, true); } catch { /* ignore */ }
          });
        }
      } else {
        await copyRecursive(remotefs, entry.path, destPath);
      }
    }
    clearRemoteClipboard();
  },
});

