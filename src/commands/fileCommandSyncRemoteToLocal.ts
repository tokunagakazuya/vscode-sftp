import { COMMAND_SYNC_REMOTE_TO_LOCAL } from '../constants';
import { sync2Local } from '../fileHandlers';
import { checkFileCommand } from './abstract/createCommand';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';
import { selectFolderFallbackToConfigContext, uriFromfspath, applySelector } from './shared';

export default checkFileCommand({
  id: COMMAND_SYNC_REMOTE_TO_LOCAL,
  getFileTarget: applySelector(uriFromfspath, selectFolderFallbackToConfigContext),

  async handleFile(ctx) {
    const ok = await showConfirmMessage(
      t('sftp.message.syncRemoteToLocalConfirm', 'Sync remote → local?'),
      t('sftp.button.ok', 'OK'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true }
    );
    if (!ok) return;
    await sync2Local(ctx);
  },
});
