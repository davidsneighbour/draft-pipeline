import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import {
  assertSpawnSuccess,
  getPdfFiles,
  runScpCopy,
  runSshCommand,
  sshAvailable,
} from "./upload-utils.mjs";

function resolveParentId(config) {
  if (config.remarkableParentFolderUuid) {
    return config.remarkableParentFolderUuid;
  }

  throw new Error(
    "Upload needs REMARKABLE_PARENT_FOLDER_UUID. Set it in .env or disable uploads with REMARKABLE_UPLOAD_ENABLED=false.",
  );
}

function purgeFolder(config, parentId) {
  const script = `
cd ${config.remarkableXochitlDir}
for f in *.metadata; do
  if grep -q '"parent": "${parentId}"' "$f"; then
    uuid="\${f%.metadata}"
    rm -rf "\${uuid}"*
  fi
done
`;

  const result = runSshCommand(config.remarkableHost, [script], {
    stdio: "inherit",
  });
  assertSpawnSuccess(result, "Purging reMarkable folder");
}

function uploadPdf(config, parentId, file) {
  const uuid = randomUUID();
  const name = basename(file, ".pdf");

  const metadata = JSON.stringify(
    {
      deleted: false,
      lastModified: String(Date.now()),
      metadatamodified: false,
      modified: false,
      parent: parentId,
      pinned: false,
      synced: false,
      type: "DocumentType",
      version: 1,
      visibleName: name,
    },
    null,
    1,
  );

  const content = JSON.stringify({ fileType: "pdf", pageCount: 0 }, null, 1);

  const tmpMeta = `/tmp/${uuid}.metadata`;
  const tmpContent = `/tmp/${uuid}.content`;

  assertSpawnSuccess(
    spawnSync("bash", ["-lc", `cat > ${tmpMeta} <<'JSON'\n${metadata}\nJSON`]),
    "Creating metadata file",
  );
  assertSpawnSuccess(
    spawnSync("bash", [
      "-lc",
      `cat > ${tmpContent} <<'JSON'\n${content}\nJSON`,
    ]),
    "Creating content file",
  );

  assertSpawnSuccess(
    runScpCopy(
      config.remarkableHost,
      file,
      `${config.remarkableXochitlDir}/${uuid}.pdf`,
    ),
    "Uploading PDF",
  );
  assertSpawnSuccess(
    runScpCopy(
      config.remarkableHost,
      tmpMeta,
      `${config.remarkableXochitlDir}/${uuid}.metadata`,
    ),
    "Uploading metadata",
  );
  assertSpawnSuccess(
    runScpCopy(
      config.remarkableHost,
      tmpContent,
      `${config.remarkableXochitlDir}/${uuid}.content`,
    ),
    "Uploading content",
  );
}

export async function uploadToRemarkable(config, { purge = true } = {}) {
  if (!config.remarkableUploadEnabled) {
    console.log("reMarkable upload skipped: REMARKABLE_UPLOAD_ENABLED=false");
    return;
  }

  if (!sshAvailable(config.remarkableHost)) {
    throw new Error(
      `Cannot reach reMarkable host \`${config.remarkableHost}\` over SSH.`,
    );
  }

  const files = await getPdfFiles(config.outputDir);
  if (files.length === 0) {
    throw new Error(
      `No PDF files found in ${config.outputDir}. Run build first.`,
    );
  }

  const parentId = resolveParentId(config);
  if (purge) {
    console.log(`Purging existing documents in folder UUID ${parentId}...`);
    purgeFolder(config, parentId);
  }

  for (const file of files) {
    console.log(`Uploading to reMarkable: ${file}`);
    uploadPdf(config, parentId, file);
  }

  console.log("Restarting xochitl...");
  const restartResult = runSshCommand(
    config.remarkableHost,
    ["systemctl restart xochitl"],
    { stdio: "inherit" },
  );
  assertSpawnSuccess(restartResult, "Restarting xochitl");
}
