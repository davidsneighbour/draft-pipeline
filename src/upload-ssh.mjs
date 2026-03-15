import { basename, join } from 'node:path';
import {
  assertSpawnSuccess,
  getPdfFiles,
  runRsyncCopy,
  runScpCopy,
  sshAvailable,
} from './upload-utils.mjs';

function validateSshConfig(config) {
  if (!config.sshTarget) {
    throw new Error('SSH upload needs SSH_TARGET (for example user@example.com).');
  }

  if (!config.sshTargetDir) {
    throw new Error('SSH upload needs SSH_TARGET_DIR.');
  }

  if (!['scp', 'rsync'].includes(config.sshUploadMethod)) {
    throw new Error('SSH_UPLOAD_METHOD must be either "scp" or "rsync".');
  }
}

function uploadViaScp(config, files) {
  for (const file of files) {
    const remotePath = join(config.sshTargetDir, basename(file));
    console.log(`Uploading via SCP: ${file} -> ${config.sshTarget}:${remotePath}`);
    assertSpawnSuccess(runScpCopy(config.sshTarget, file, remotePath, { port: config.sshPort }), 'SCP upload');
  }
}

function uploadViaRsync(config) {
  const destination = `${config.sshTarget}:${config.sshTargetDir}/`;
  console.log(`Uploading via rsync: ${config.outputDir}/*.pdf -> ${destination}`);
  assertSpawnSuccess(
    runRsyncCopy(['--include=*.pdf', '--exclude=*', `${config.outputDir}/`, destination], { sshPort: config.sshPort }),
    'rsync upload',
  );
}

export async function uploadViaSsh(config) {
  if (!config.sshUploadEnabled) {
    console.log('Generic SSH upload skipped: SSH_UPLOAD_ENABLED=false');
    return;
  }

  validateSshConfig(config);

  if (!sshAvailable(config.sshTarget, { port: config.sshPort })) {
    throw new Error(`Cannot reach SSH target \`${config.sshTarget}\`.`);
  }

  const files = await getPdfFiles(config.outputDir);
  if (files.length === 0) {
    throw new Error(`No PDF files found in ${config.outputDir}. Run build first.`);
  }

  if (config.sshUploadMethod === 'rsync') {
    uploadViaRsync(config);
    return;
  }

  uploadViaScp(config, files);
}
