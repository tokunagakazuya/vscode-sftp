import * as vscode from 'vscode';
import { ExplorerItem } from './treeDataProvider';
import { setRemoteClipboard } from '../remoteClipboard';
import { handleCtxFromUri } from '../../fileHandlers';

// Use loose typings to remain compatible with older @types/vscode
export default class RemoteExplorerDnD /* implements vscode.TreeDragAndDropController<ExplorerItem> */ {
  readonly dragMimeTypes = ['text/uri-list'];
  readonly dropMimeTypes = ['text/uri-list'];
  // dropContext?: any;

  dispose() {}

  async handleDrag(source: readonly ExplorerItem[], dataTransfer: any): Promise<void> {
    const uris: string[] = [];
    for (const item of source as any[]) {
      if ((item as any).resource) {
        uris.push((item as any).resource.uri.toString());
      }
    }
    const DataTransferItemCtor = (vscode as any).DataTransferItem;
    if (DataTransferItemCtor) {
      dataTransfer.set('text/uri-list', new DataTransferItemCtor(uris.join('\n')));
    } else {
      // Fallback: plain string
      dataTransfer.set('text/uri-list', uris.join('\n'));
    }
  }

  async handleDrop(target: ExplorerItem | undefined, dataTransfer: any): Promise<void> {
    const data = dataTransfer.get('text/uri-list');
    if (!data) return;
    const value = typeof data.asString === 'function' ? await data.asString() : String(data);
    const uris = value.split(/\r?\n/).filter(Boolean).map((s: string) => vscode.Uri.parse(s));
    if (!uris.length) return;

    const tgt = target as any;
    if (!tgt || !tgt.resource) return;

    const first = handleCtxFromUri(uris[0]);
    setRemoteClipboard(first.fileService.id, 'cut', uris.map(u => handleCtxFromUri(u).target.remoteFsPath));
    await vscode.commands.executeCommand('sftp.remote.paste', tgt);
  }
}
