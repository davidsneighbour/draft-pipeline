import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function ssh(host, args, options = {}) {
  return spawnSync('ssh', [host, ...args], { encoding: 'utf8', ...options });
}

function scp(host, localPath, remotePath) {
  return spawnSync('scp', [localPath, `${host}:${remotePath}`], { stdio: 'inherit' });
}

function remarkableAvailable(host) {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', host, 'exit'], { stdio: 'ignore' });
  return result.status === 0;
}

async function getPdfFiles(outputDir) {
  const entries = await readdir(outputDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.pdf')).map((entry) => join(outputDir, entry.name)).sort();
}

function resolveParentId(config) {
  if (config.remarkableParentFolderUuid) {
    return config.remarkableParentFolderUuid;
  }

  throw new Error(
    'Upload needs REMARKABLE_PARENT_FOLDER_UUID. Set it in .env or disable uploads with REMARKABLE_UPLOAD_ENABLED=false.',
  );
}

function purgeFolder(config, parentId) {
  const script = `
cd ${config.remarkableXochitlDir}
for f in *.metadata; do
  if grep -q '\"parent\": \"${parentId}\"' "$f"; then
    uuid="\${f%.metadata}"
    rm -rf "\${uuid}"*
  fi
done
`;

  ssh(config.remarkableHost, [script], { stdio: 'inherit' });
}

function uploadPdf(config, parentId, file) {
  const uuid = randomUUID();
  const name = basename(file, '.pdf');

  const metadata = JSON.stringify(
    {
      deleted: false,
      lastModified: String(Date.now()),
      metadatamodified: false,
      modified: false,
      parent: parentId,
      pinned: false,
      synced: false,
      type: 'DocumentType',
      version: 1,
      visibleName: name,
    },
    null,
    1,
  );

  const content = JSON.stringify({ fileType: 'pdf', pageCount: 0 }, null, 1);

  const tmpMeta = `/tmp/${uuid}.metadata`;
  const tmpContent = `/tmp/${uuid}.content`;

  spawnSync('bash', ['-lc', `cat > ${tmpMeta} <<'JSON'\n${metadata}\nJSON`]);
  spawnSync('bash', ['-lc', `cat > ${tmpContent} <<'JSON'\n${content}\nJSON`]);

  scp(config.remarkableHost, file, `${config.remarkableXochitlDir}/${uuid}.pdf`);
  scp(config.remarkableHost, tmpMeta, `${config.remarkableXochitlDir}/${uuid}.metadata`);
  scp(config.remarkableHost, tmpContent, `${config.remarkableXochitlDir}/${uuid}.content`);
}

export async function uploadToRemarkable(config, { purge = true } = {}) {
  if (!config.remarkableUploadEnabled) {
    console.log('Upload skipped: REMARKABLE_UPLOAD_ENABLED=false');
    return;
  }

  if (!remarkableAvailable(config.remarkableHost)) {
    throw new Error(`Cannot reach reMarkable host \`${config.remarkableHost}\` over SSH.`);
  }

  const files = await getPdfFiles(config.outputDir);
  if (files.length === 0) {
    throw new Error(`No PDF files found in ${config.outputDir}. Run build first.`);
  }

  const parentId = resolveParentId(config);
  if (purge) {
    console.log(`Purging existing documents in folder UUID ${parentId}...`);
    purgeFolder(config, parentId);
  }

  for (const file of files) {
    console.log(`Uploading ${file}`);
    uploadPdf(config, parentId, file);
  }

  console.log('Restarting xochitl...');
  ssh(config.remarkableHost, ['systemctl restart xochitl'], { stdio: 'inherit' });
}
