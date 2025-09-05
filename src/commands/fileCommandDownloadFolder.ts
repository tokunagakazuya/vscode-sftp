import { COMMAND_DOWNLOAD_FOLDER } from '../constants';
import { downloadFolder } from '../fileHandlers';
import { showConfirmMessage } from '../host';
import { t } from '../i18n';
import { checkFileCommand } from './abstract/createCommand';
import { uriFromExplorerContextOrEditorContext } from './shared';

export default checkFileCommand({
  id: COMMAND_DOWNLOAD_FOLDER,
  getFileTarget: uriFromExplorerContextOrEditorContext,

  async handleFile(ctx) {
    const name = ctx.target ? ctx.target.remoteFsPath.split('/').pop() : '';
    const ok = await showConfirmMessage(
      t('sftp.message.downloadFolderConfirm', 'Download this folder?') + (name ? ` '${name}'` : ''),
      t('sftp.button.download', 'Download'),
      t('sftp.button.cancel', 'Cancel'),
      { modal: true }
    );
    if (!ok) return;
    await downloadFolder(ctx);
  },
});
