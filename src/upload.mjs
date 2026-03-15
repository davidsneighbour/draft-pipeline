import { uploadToRemarkable } from './upload-remarkable.mjs';
import { uploadViaSsh } from './upload-ssh.mjs';

export async function runUploads(config) {
  if (!config.remarkableUploadEnabled && !config.sshUploadEnabled) {
    console.log('Upload skipped: all upload integrations are disabled.');
    return;
  }

  await uploadToRemarkable(config);
  await uploadViaSsh(config);
}
