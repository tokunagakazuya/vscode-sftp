import * as vscode from 'vscode';
import { registerCommand } from '../../host';
import {
  COMMAND_REMOTEEXPLORER_REFRESH,
  COMMAND_REMOTEEXPLORER_VIEW_CONTENT,
} from '../../constants';
import { UResource } from '../../core';
import { toRemotePath } from '../../helper';
import { getFileService } from '../serviceManager';
import RemoteTreeDataProvider, { ExplorerItem } from './treeDataProvider';
import RemoteExplorerDnD from './dragAndDrop';

export default class RemoteExplorer {
  private _explorerView: vscode.TreeView<ExplorerItem>;
  private _treeDataProvider: RemoteTreeDataProvider;

  constructor(context: vscode.ExtensionContext) {
    this._treeDataProvider = new RemoteTreeDataProvider();

    this._explorerView = vscode.window.createTreeView('remoteExplorer', {
      showCollapseAll: true,
      treeDataProvider: this._treeDataProvider,
      canSelectMany: true,
    } as any);
    // Attach DnD controller dynamically to support older typings
    (this._explorerView as any).dragAndDropController = new RemoteExplorerDnD();

    registerCommand(context, COMMAND_REMOTEEXPLORER_REFRESH, () => this._refreshSelection());
    registerCommand(context, COMMAND_REMOTEEXPLORER_VIEW_CONTENT, (item: ExplorerItem) =>
      this._treeDataProvider.showItem(item)
    );
    // Grouping commands: host/context/default
    vscode.commands.registerCommand('sftp.groupByHost', () => this.setGrouping('host'));
    vscode.commands.registerCommand('sftp.groupByContext', () => this.setGrouping('context'));
    vscode.commands.registerCommand('sftp.groupByDefault', () => this.setGrouping('default'));
  }

  refresh(item?: ExplorerItem) {
    if (item && (item as any).resource && !UResource.isRemote((item as any).resource.uri)) {
      const uri = (item as any).resource.uri;
      const fileService = getFileService(uri);
      if (!fileService) {
        if (uri.toString(true) == "file:///${command:sftp.sync.remoteToLocal}") {
          throw '';
        } else {
          throw new Error(`Config Not Found. (${uri.toString(true)})`);
        }
      }
      const config = fileService.getConfig();
      const localPath = (item as any).resource.fsPath;
      const remotePath = toRemotePath(localPath, config.context, config.remotePath);
      (item as any).resource = UResource.makeResource({
        remote: {
          host: config.host,
          port: config.port,
        },
        fsPath: remotePath,
        remoteId: fileService.id,
      });
    }

    this._treeDataProvider.refresh(item);
  }

  reveal(item: ExplorerItem): Thenable<void> {
    return item ? this._explorerView.reveal(item) : Promise.resolve();
  }

  findRoot(remoteUri: vscode.Uri) {
    return this._treeDataProvider.findRoot(remoteUri);
  }

  setGrouping(mode: 'default' | 'host' | 'context') {
    const { setContextValue } = require('../../host');
    setContextValue('grouped-by-host', mode === 'host');
    setContextValue('grouped-by-context', mode === 'context');
    this._treeDataProvider.setGrouping(mode);
  }

  private _refreshSelection() {
    if (this._explorerView.selection.length) {
      this._explorerView.selection.forEach(item => this.refresh(item));
    } else {
      this.refresh();
    }
  }
}
