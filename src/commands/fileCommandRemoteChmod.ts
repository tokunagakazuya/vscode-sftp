import * as vscode from 'vscode';
import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { UResource } from '../core';
import { getFileService } from '../modules/serviceManager';

export default checkFileCommand({
  id: 'sftp.remote.chmod',
  getFileTarget: uriFromExplorerContextOrEditorContext,
  async handleFile(ctx) {
    const uri = ctx.target.remoteUri;
    const res = UResource.makeResource(uri);
    const fsService = getFileService(uri);
    if (!fsService) return;
    const remotefs = await fsService.getRemoteFileSystem(ctx.config);
    let current = '644';
    try {
      const st = await remotefs.lstat(res.fsPath);
      current = (st.mode & parseInt('777', 8)).toString(8); // ensure 3-4 digit octal
    } catch { /* ignore */ }
    const modeStr = await vscode.window.showInputBox({ prompt: 'パーミッション (例: 644)', value: current });
    if (!modeStr) return;
    const mode = parseInt(modeStr, 8);
    if (isNaN(mode)) return;
    await remotefs.chmod(res.fsPath, mode);
  },
});
