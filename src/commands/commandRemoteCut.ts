import { Uri } from 'vscode';
import { checkCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { handleCtxFromUri } from '../fileHandlers';
import { setRemoteClipboard } from '../modules/remoteClipboard';

export default checkCommand({
  id: 'sftp.remote.cut',
  async handleCommand(item?: Uri, items?: Uri[]) {
    const target = uriFromExplorerContextOrEditorContext(item, items);
    if (!target) return;
    const list: Uri[] = Array.isArray(target) ? target : [target];
    const first = handleCtxFromUri(list[0]);
    const serviceId = first.fileService.id;
    const paths = list.map(u => handleCtxFromUri(u).target.remoteFsPath);
    setRemoteClipboard(serviceId, 'cut', paths);
  },
});

