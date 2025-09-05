import * as vscode from 'vscode';
import { getRemoteClipboard, onDidChangeRemoteClipboard } from './remoteClipboard';

export default class CutDecorationProvider /* implements vscode.FileDecorationProvider (older @types don't have it) */ {
  private _onDidChangeFileDecorations = new (vscode as any).EventEmitter();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor() {
    onDidChangeRemoteClipboard(() => this._onDidChangeFileDecorations.fire(undefined));
  }

  // Older @types don't include FileDecoration, so return `any`
  provideFileDecoration(uri: vscode.Uri): any {
    const clip = getRemoteClipboard();
    if (!clip || clip.action !== 'cut') return;
    if (uri.scheme !== 'remote') return;
    const cutSet = new Set(clip.entries.map(e => e.path));
    const fspath: string = (uri as any).fsPath || uri.path;
    if (!cutSet.has(fspath)) return;
    const color = new vscode.ThemeColor('disabledForeground');
    return { tooltip: 'Cut (pending paste)', color };
  }
}
