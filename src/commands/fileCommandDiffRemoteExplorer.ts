import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { diff } from '../fileHandlers';

export default checkFileCommand({
  id: 'sftp.diff.remoteExplorer',
  getFileTarget: uriFromExplorerContextOrEditorContext,
  handleFile: diff,
});

