import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export function runSshCommand(host, args, options = {}) {
  return spawnSync("ssh", [host, ...args], { encoding: "utf8", ...options });
}

export function runScpCopy(host, localPath, remotePath, { port } = {}) {
  const portArgs = port ? ["-P", String(port)] : [];
  return spawnSync("scp", [...portArgs, localPath, `${host}:${remotePath}`], {
    stdio: "inherit",
  });
}

export function runRsyncCopy(args, { sshPort } = {}) {
  const sshCommand = sshPort ? `ssh -p ${sshPort}` : "ssh";
  return spawnSync("rsync", ["-avz", "-e", sshCommand, ...args], {
    stdio: "inherit",
  });
}

export function sshAvailable(host, { port } = {}) {
  const portArgs = port ? ["-p", String(port)] : [];
  const result = spawnSync(
    "ssh",
    [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=3",
      ...portArgs,
      host,
      "exit",
    ],
    { stdio: "ignore" },
  );

  return result.status === 0;
}

export function assertSpawnSuccess(result, action) {
  if (result.status !== 0) {
    throw new Error(
      `${action} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

export async function getPdfFiles(outputDir) {
  const entries = await readdir(outputDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".pdf"))
    .map((entry) => join(outputDir, entry.name))
    .sort();
}
