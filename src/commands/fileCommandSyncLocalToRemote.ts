import { COMMAND_SYNC_LOCAL_TO_REMOTE } from '../constants';
import { sync2Remote } from '../fileHandlers';
import { checkFileCommand } from './abstract/createCommand';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';
import { selectFolderFallbackToConfigContext, uriFromfspath, applySelector } from './shared';

export default checkFileCommand({
  id: COMMAND_SYNC_LOCAL_TO_REMOTE,
  getFileTarget: applySelector(uriFromfspath, selectFolderFallbackToConfigContext),

  async handleFile(ctx) {
    const ok = await showConfirmMessage(
      t('sftp.message.syncLocalToRemoteConfirm', 'Sync local → remote?'),
      t('sftp.button.ok', 'OK'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true }
    );
    if (!ok) return;
    await sync2Remote(ctx);
  },
});
