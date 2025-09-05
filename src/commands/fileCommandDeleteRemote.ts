import { COMMAND_DELETE_REMOTE } from '../constants';
import { upath } from '../core';
import { removeRemote } from '../fileHandlers';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';
import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';

export default checkFileCommand({
  id: COMMAND_DELETE_REMOTE,
  async getFileTarget(item, items) {
    const targets = await uriFromExplorerContextOrEditorContext(item, items);

    if (!targets) {
      return;
    }

    const filename = Array.isArray(targets)
      ? targets.map(t => upath.basename(t.fsPath)).join(',')
      : upath.basename(targets.fsPath);
    const result = await showConfirmMessage(
      (t('sftp.message.deleteConfirm', 'Are you sure you want to delete') + ` '${filename}'?`),
      t('sftp.button.delete', 'Delete'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true, severity: 'warn' }
    );

    return result ? targets : undefined;
  },

  handleFile: removeRemote,
});
