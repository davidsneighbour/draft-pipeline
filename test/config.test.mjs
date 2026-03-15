import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { getConfigWithSources, loadConfig } from "../src/config.mjs";

const CONFIG_ENV_KEYS = [
  "MARKDOWN_INPUT_DIR",
  "OUTPUT_DIR",
  "OUTPUT_CSS_FILE",
  "TAILWIND_INPUT_CSS",
  "HEADER_TEMPLATE_PATH",
  "FOOTER_TEMPLATE_PATH",
  "DOCUMENT_TEMPLATE_PATH",
  "BOOK_LAYOUT_CSS_PATH",
  "REMARKABLE_UPLOAD_ENABLED",
  "REMARKABLE_HOST",
  "REMARKABLE_XOCHITL_DIR",
  "REMARKABLE_PARENT_FOLDER_UUID",
  "REMARKABLE_PARENT_FOLDER_NAME",
  "SSH_UPLOAD_ENABLED",
  "SSH_TARGET",
  "SSH_TARGET_DIR",
  "SSH_UPLOAD_METHOD",
  "SSH_PORT",
  "PDF_PRINT_READY",
  "PDF_BLEED",
];

const ENV_SNAPSHOT = new Map(
  CONFIG_ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreConfigEnv() {
  for (const key of CONFIG_ENV_KEYS) {
    const original = ENV_SNAPSHOT.get(key);
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

async function makeTempDir() {
  return mkdtemp(path.join(tmpdir(), "draft-pipeline-test-"));
}

async function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(process.cwd(), "src/cli.mjs");
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test.afterEach(() => {
  restoreConfigEnv();
});

test("loadConfig uses defaults when no env/config/overrides are set", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  const config = await loadConfig(cwd);

  assert.equal(config.markdownInputDir, path.resolve(cwd, "./book"));
  assert.equal(config.outputDir, path.resolve(cwd, "./dist"));
  assert.equal(config.outputCssFile, path.resolve(cwd, "./dist/output.css"));
  assert.equal(config.tailwindInputCss, path.resolve(cwd, "./styles/pdf.css"));
  assert.equal(
    config.headerTemplatePath,
    path.resolve(cwd, "./templates/header.html"),
  );
  assert.equal(
    config.footerTemplatePath,
    path.resolve(cwd, "./templates/footer.html"),
  );
  assert.equal(
    config.documentTemplatePath,
    path.resolve(cwd, "./templates/document.html"),
  );
  assert.equal(
    config.bookLayoutCssPath,
    path.resolve(cwd, "./styles/pdf-book-layout.css"),
  );
  assert.equal(config.remarkableUploadEnabled, false);
  assert.equal(config.remarkableHost, "remarkable");
  assert.equal(config.remarkableXochitlDir, ".local/share/remarkable/xochitl");
  assert.equal(config.remarkableParentFolderUuid, "");
  assert.equal(config.remarkableParentFolderName, "Book of Hugo");
  assert.equal(config.sshUploadEnabled, false);
  assert.equal(config.sshTarget, "");
  assert.equal(config.sshTargetDir, "");
  assert.equal(config.sshUploadMethod, "scp");
  assert.equal(config.sshPort, undefined);
  assert.equal(config.pdfPrintReady, false);
  assert.equal(config.pdfBleed, "3mm");
  assert.equal(config.__meta.envFileLoaded, false);
  assert.equal(config.__meta.configFileLoaded, false);
});

test("env file values are loaded and parsed", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await writeFile(
    path.join(cwd, ".pipeline.env"),
    [
      "MARKDOWN_INPUT_DIR=./chapters",
      "REMARKABLE_UPLOAD_ENABLED=true",
      "SSH_UPLOAD_ENABLED=true",
      "SSH_UPLOAD_METHOD=RSYNC",
      "SSH_PORT=2222",
      "PDF_PRINT_READY=true",
      "PDF_BLEED=0.125in",
    ].join("\n"),
    "utf8",
  );

  const config = await loadConfig(cwd);

  assert.equal(config.markdownInputDir, path.resolve(cwd, "./chapters"));
  assert.equal(config.remarkableUploadEnabled, true);
  assert.equal(config.sshUploadEnabled, true);
  assert.equal(config.sshUploadMethod, "rsync");
  assert.equal(config.sshPort, 2222);
  assert.equal(config.pdfPrintReady, true);
  assert.equal(config.pdfBleed, "0.125in");
  assert.equal(config.__meta.envFileLoaded, true);
});

test("config file values override env values and missing properties keep defaults", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await writeFile(
    path.join(cwd, ".pipeline.env"),
    ["OUTPUT_DIR=./env-dist", "PDF_BLEED=5mm", "SSH_UPLOAD_METHOD=scp"].join(
      "\n",
    ),
    "utf8",
  );

  await writeFile(
    path.join(cwd, ".pipeline.config.json"),
    JSON.stringify(
      {
        outputDir: "./config-dist",
        sshUploadMethod: "RSYNC",
      },
      null,
      2,
    ),
    "utf8",
  );

  const config = await loadConfig(cwd);

  assert.equal(config.outputDir, path.resolve(cwd, "./config-dist"));
  assert.equal(config.sshUploadMethod, "rsync");
  assert.equal(config.pdfBleed, "5mm");
  assert.equal(config.remarkableHost, "remarkable");

  const withSources = getConfigWithSources(config);
  assert.equal(withSources.sources.outputDir, "config");
  assert.equal(withSources.sources.pdfBleed, "env");
  assert.equal(withSources.sources.remarkableHost, "env");
  assert.equal(withSources.files.configFileLoaded, true);
});

test("CLI overrides take highest precedence over config and env", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await writeFile(
    path.join(cwd, ".pipeline.env"),
    ["PDF_PRINT_READY=false", "PDF_BLEED=2mm"].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(cwd, ".pipeline.config.json"),
    JSON.stringify({ pdfPrintReady: false, pdfBleed: "6mm" }),
    "utf8",
  );

  const config = await loadConfig(cwd, {
    printReady: true,
    pdfBleed: "10px",
    headerTemplatePath: "./custom-header.html",
  });

  assert.equal(config.pdfPrintReady, true);
  assert.equal(config.pdfBleed, "10px");
  assert.equal(
    config.headerTemplatePath,
    path.resolve(cwd, "./custom-header.html"),
  );

  const withSources = getConfigWithSources(config);
  assert.equal(withSources.sources.pdfPrintReady, "cli");
  assert.equal(withSources.sources.pdfBleed, "cli");
  assert.equal(withSources.sources.headerTemplatePath, "cli");
});

test("invalid booleans are rejected with clear errors", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await assert.rejects(
    () => loadConfig(cwd, { printReady: "not-a-boolean" }),
    /PDF_PRINT_READY must be either "true" or "false"/,
  );
  await assert.rejects(
    () => loadConfig(cwd, { sshUploadEnabled: "not-a-boolean" }),
    /SSH_UPLOAD_ENABLED must be either "true" or "false"/,
  );
  await assert.rejects(
    () => loadConfig(cwd, { remarkableUploadEnabled: "not-a-boolean" }),
    /REMARKABLE_UPLOAD_ENABLED must be either "true" or "false"/,
  );
});

test("invalid ssh port and invalid bleed are rejected", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await assert.rejects(
    () => loadConfig(cwd, { sshPort: "abc" }),
    /SSH_PORT must be a valid integer/,
  );
  await assert.rejects(
    () => loadConfig(cwd, { pdfBleed: "3" }),
    /PDF_BLEED must be a CSS length/,
  );
});

test("cli --print-config=json shows evaluated values, source map and file state", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await writeFile(
    path.join(cwd, ".pipeline.env"),
    ["OUTPUT_DIR=./env-out", "PDF_BLEED=8mm"].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(cwd, ".pipeline.config.json"),
    JSON.stringify({ outputDir: "./config-out" }),
    "utf8",
  );

  const result = await runCli(
    ["build", "--print-config=json", "--bleed", "12px"],
    cwd,
  );

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.values.outputDir, path.resolve(cwd, "./config-out"));
  assert.equal(payload.values.pdfBleed, "12px");
  assert.equal(payload.values.sshPort, null);
  assert.equal(payload.sources.outputDir, "config");
  assert.equal(payload.sources.pdfBleed, "cli");
  assert.equal(payload.files.envFileLoaded, true);
  assert.equal(payload.files.configFileLoaded, true);
});

test("cli --print-config table output contains diagnostics and source rows", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  await writeFile(
    path.join(cwd, ".pipeline.env"),
    "OUTPUT_DIR=./env-out\n",
    "utf8",
  );

  const result = await runCli(["build", "--print-config"], cwd);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /markdownInputDir/);
  assert.match(result.stdout, /source/);
  assert.match(result.stdout, /env file: .*\(loaded\)/);
  assert.match(result.stdout, /config file: .*\(missing\)/);
});

test("cli fails for invalid print-config format", async () => {
  const cwd = await makeTempDir();
  restoreConfigEnv();

  const result = await runCli(["build", "--print-config=yaml"], cwd);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Invalid --print-config format/);
});
