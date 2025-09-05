import { COMMAND_DOWNLOAD_FILE } from '../constants';
import { downloadFile } from '../fileHandlers';
import { uriFromExplorerContextOrEditorContext } from './shared';
import { checkFileCommand } from './abstract/createCommand';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';

export default checkFileCommand({
  id: COMMAND_DOWNLOAD_FILE,
  getFileTarget: uriFromExplorerContextOrEditorContext,

  async handleFile(ctx) {
    const name = ctx.target ? ctx.target.remoteFsPath.split('/').pop() : '';
    const ok = await showConfirmMessage(
      t('sftp.message.downloadFileConfirm', 'Download this file?') + (name ? ` '${name}'` : ''),
      t('sftp.button.download', 'Download'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true }
    );
    if (!ok) return;
    await downloadFile(ctx, { ignore: null });
  },
});
