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

export function setRemoteClipboard(serviceId: number, action: ClipAction, paths: string[]) {
  state = {
    serviceId,
    action,
    entries: paths.map(p => ({ path: p })),
  };
}

export function getRemoteClipboard(): RemoteClipboardState | null {
  return state;
}

export function clearRemoteClipboard() {
  state = null;
}

