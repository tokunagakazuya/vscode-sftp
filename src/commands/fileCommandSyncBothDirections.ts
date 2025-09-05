import { COMMAND_SYNC_BOTH_DIRECTIONS } from '../constants';
import { sync2Remote } from '../fileHandlers';
import { checkFileCommand } from './abstract/createCommand';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';
import { selectFolderFallbackToConfigContext, uriFromfspath, applySelector } from './shared';

export default checkFileCommand({
  id: COMMAND_SYNC_BOTH_DIRECTIONS,
  getFileTarget: applySelector(uriFromfspath, selectFolderFallbackToConfigContext),

  async handleFile(ctx) {
    const ok = await showConfirmMessage(
      t('sftp.message.syncBothConfirm', 'Sync both directions?'),
      t('sftp.button.ok', 'OK'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true }
    );
    if (!ok) return;
    return sync2Remote(ctx, { bothDiretions: true });
  },
});
