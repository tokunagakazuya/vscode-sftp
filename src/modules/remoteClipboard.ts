import * as vscode from 'vscode';

type ClipAction = 'copy' | 'cut';

interface ClipEntry {
  path: string;
}

interface RemoteClipboardState {
  serviceId: number;
  action: ClipAction;
  entries: ClipEntry[];
}

let state: RemoteClipboardState | null = null;
const _onDidChange = new vscode.EventEmitter<void>();
export const onDidChangeRemoteClipboard = _onDidChange.event;

export function setRemoteClipboard(serviceId: number, action: ClipAction, paths: string[]) {
  // de-duplicate and normalize
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  state = {
    serviceId,
    action,
    entries: uniq.map(p => ({ path: p })),
  };
  _onDidChange.fire();
}

export function getRemoteClipboard(): RemoteClipboardState | null {
  return state;
}

export function clearRemoteClipboard() {
  state = null;
  _onDidChange.fire();
}
