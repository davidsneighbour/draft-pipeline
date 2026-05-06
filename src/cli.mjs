#!/usr/bin/env node
import { constants } from "node:fs";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildCss } from "./build-css.mjs";
import { getConfigWithSources, loadConfig } from "./config.mjs";
import { renderMarkdownDirectory, renderMarkdownFiles } from "./md-to-pdf.mjs";
import { runUploads } from "./upload.mjs";
import { uploadToRemarkable } from "./upload-remarkable.mjs";

const cliDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(cliDirectory, "..");
const knownCommands = new Set(["css", "pdf", "upload", "build", "setup-env", "draft"]);

function printHelp() {
  console.log(`draft-pipeline - A tool to convert markdown files to PDFs and upload them to reMarkable.

Commands:
  draft <file>  Convert one markdown file to PDF and optionally upload it to reMarkable
  css           Build Tailwind CSS
  pdf           Convert markdown files to PDFs
  upload        Upload generated PDFs via enabled integrations (reMarkable and/or SSH)
  build         Run css + pdf + upload
  setup-env     Create a demo .pipeline.env file

Options:
  --pipeline-env <path>        Path to env file (default: .pipeline.env)
  --pipeline-config <path>     Path to config JSON file (default: .pipeline.config.json)
  --header-template <path>     Override HEADER_TEMPLATE_PATH
  --footer-template <path>     Override FOOTER_TEMPLATE_PATH
  --document-template <path>   Override DOCUMENT_TEMPLATE_PATH
  --book-layout-css <path>     Override BOOK_LAYOUT_CSS_PATH
  --theme-css <path>           Add a theme CSS layer after the base and layout CSS
  --theme <name>               Use a bundled theme (initial value: remarkable-edit)
  --output-dir <path>          Override OUTPUT_DIR
  --printready                 Enable print-ready PDF output with bleed area
  --bleed <length>             Override PDF_BLEED (used with --printready)
  --print-config[=<format>]    Print resolved config and exit (format: json|table, default: table)

Draft command options:
  --upload                     Upload the generated PDF to reMarkable
  --no-upload                  Do not upload the generated PDF (default)
  --purge                      Purge the target reMarkable folder before uploading
  --no-purge                   Do not purge the target reMarkable folder before uploading (default)

Examples:
  draft markdown.md
  draft markdown.md --upload
  draft markdown.md --theme remarkable-edit --upload
  draft-pipeline draft markdown.md --upload

Configuration:
  Resolution order: env -> config file -> CLI (later sources override earlier).
`);
}

function readOptionValue(args, i, optionName) {
  const value = args[i + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}

function getBundledThemePath(themeName) {
  const themes = new Map([
    ["remarkable-edit", path.resolve(packageRoot, "themes/remarkable-edit.css")],
  ]);

  const themePath = themes.get(themeName);
  if (!themePath) {
    throw new Error(`Unknown theme: ${themeName}. Available themes: ${[...themes.keys()].join(", ")}.`);
  }

  return themePath;
}

function looksLikeMarkdownFile(value) {
  return /\.m(?:d|arkdown)$/i.test(value);
}

function normaliseCommand(argv) {
  const [commandArg, ...rest] = argv;

  if (commandArg === "--help" || commandArg === "-h" || commandArg === "help") {
    return { command: "help", optionArgs: [] };
  }

  if (!commandArg || commandArg.startsWith("--")) {
    return { command: "build", optionArgs: commandArg ? [commandArg, ...rest] : rest };
  }

  if (knownCommands.has(commandArg)) {
    return { command: commandArg, optionArgs: rest };
  }

  if (looksLikeMarkdownFile(commandArg)) {
    return { command: "draft", optionArgs: [commandArg, ...rest] };
  }

  return { command: commandArg, optionArgs: rest };
}

function parseCliArgs(argv) {
  const { command, optionArgs } = normaliseCommand(argv);
  const overrides = {};
  const files = [];

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];

    if (arg === "--pipeline-env") {
      overrides.envFilePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--pipeline-config") {
      overrides.configFilePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--print-config" || arg.startsWith("--print-config=")) {
      overrides.printConfig = true;
      const format = arg.includes("=") ? arg.split("=")[1] : "table";
      overrides.printConfigFormat = format || "table";
      continue;
    }

    if (arg === "--header-template") {
      overrides.headerTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--footer-template") {
      overrides.footerTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--document-template") {
      overrides.documentTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--book-layout-css") {
      overrides.bookLayoutCssPath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--theme-css") {
      overrides.themeCssPath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--theme") {
      overrides.themeCssPath = getBundledThemePath(readOptionValue(optionArgs, i, arg));
      i += 1;
      continue;
    }

    if (arg === "--output-dir") {
      overrides.outputDir = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--printready") {
      overrides.printReady = true;
      continue;
    }

    if (arg === "--bleed") {
      overrides.pdfBleed = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === "--upload") {
      overrides.draftUpload = true;
      continue;
    }

    if (arg === "--no-upload") {
      overrides.draftUpload = false;
      continue;
    }

    if (arg === "--purge") {
      overrides.draftPurge = true;
      continue;
    }

    if (arg === "--no-purge") {
      overrides.draftPurge = false;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    files.push(arg);
  }

  return { command, overrides, files };
}

async function setupEnvFile(cwd, envFilePath) {
  const targetPath = path.resolve(cwd, envFilePath);
  const examplePath = path.resolve(packageRoot, ".env.example");

  await copyFile(examplePath, targetPath, constants.COPYFILE_EXCL);
  console.log(`Created env file: ${targetPath}`);
}

function applyDraftDefaults(overrides) {
  return {
    outputDir: path.resolve(process.cwd(), ".draft-pipeline"),
    outputCssFile: path.resolve(packageRoot, "styles/draft-base.css"),
    bookLayoutCssPath: path.resolve(packageRoot, "styles/pdf-book-layout.css"),
    headerTemplatePath: path.resolve(packageRoot, "templates/header.html"),
    footerTemplatePath: path.resolve(packageRoot, "templates/footer.html"),
    documentTemplatePath: path.resolve(packageRoot, "templates/document.html"),
    themeCssPath: path.resolve(packageRoot, "themes/remarkable-edit.css"),
    ...overrides,
  };
}

function printResolvedConfig(config, format) {
  const output = getConfigWithSources(config);

  if (format === "json") {
    console.log(
      JSON.stringify(
        output,
        (key, value) => (value === undefined ? null : value),
        2,
      ),
    );
    return;
  }

  const rows = Object.entries(output.values).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
    source: output.sources[key] ?? "unknown",
  }));
  console.table(rows);
  console.log(
    `env file: ${output.files.envFilePath} (${output.files.envFileLoaded ? "loaded" : "missing"})`,
  );
  console.log(
    `config file: ${output.files.configFilePath} (${output.files.configFileLoaded ? "loaded" : "missing"})`,
  );
}

async function runDraftCommand(files, rawOverrides) {
  if (files.length !== 1) {
    throw new Error("The draft command needs exactly one markdown file path.");
  }

  const { draftUpload, draftPurge, ...configOverrides } = rawOverrides;
  const config = await loadConfig(process.cwd(), applyDraftDefaults(configOverrides), {
    envFilePath: configOverrides.envFilePath ?? ".pipeline.env",
    configFilePath: configOverrides.configFilePath ?? ".pipeline.config.json",
  });

  if (configOverrides.printConfig) {
    printResolvedConfig(config, configOverrides.printConfigFormat);
    return;
  }

  const createdPdfPaths = await renderMarkdownFiles(config, files, { verbose: true });

  if (!draftUpload) {
    console.log("reMarkable upload skipped. Use --upload to transfer the generated PDF.");
    return;
  }

  await uploadToRemarkable(
    { ...config, remarkableUploadEnabled: true },
    { files: createdPdfPaths, purge: draftPurge ?? false },
  );
}

async function main() {
  const { command, overrides, files } = parseCliArgs(process.argv.slice(2));

  if (command === "help") {
    printHelp();
    return;
  }

  if (
    overrides.printConfig &&
    !["json", "table"].includes(overrides.printConfigFormat)
  ) {
    throw new Error(
      `Invalid --print-config format: ${overrides.printConfigFormat}. Use json or table.`,
    );
  }

  if (command === "draft") {
    await runDraftCommand(files, overrides);
    return;
  }

  if (files.length > 0) {
    throw new Error(`Unexpected file argument(s): ${files.join(", ")}`);
  }

  const envFilePath = overrides.envFilePath ?? ".pipeline.env";

  if (command === "setup-env") {
    await setupEnvFile(process.cwd(), envFilePath);
    return;
  }

  const configFilePath = overrides.configFilePath ?? ".pipeline.config.json";
  const config = await loadConfig(process.cwd(), overrides, {
    envFilePath,
    configFilePath,
  });

  if (overrides.printConfig) {
    printResolvedConfig(config, overrides.printConfigFormat);
    return;
  }

  if (command === "css") {
    await buildCss(config);
    return;
  }

  if (command === "pdf") {
    await renderMarkdownDirectory(config, { verbose: true });
    return;
  }

  if (command === "upload") {
    await runUploads(config);
    return;
  }

  if (command === "build") {
    await buildCss(config);
    await renderMarkdownDirectory(config, { verbose: true });
    await runUploads(config);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run with --help.`);
}

main().catch((error) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
