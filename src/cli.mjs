#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { buildCss } from './build-css.mjs';
import { renderMarkdownDirectory } from './md-to-pdf.mjs';
import { runUploads } from './upload.mjs';

function printHelp() {
  console.log(`draft-pipeline - A tool to convert markdown files to PDFs and upload them to reMarkable.

Commands:
  css        Build Tailwind CSS
  pdf        Convert markdown files to PDFs
  upload     Upload generated PDFs via enabled integrations (reMarkable and/or SSH)
  build      Run css + pdf + upload
  setup-env  Create a demo .pipeline.env file

Options:
  --pipeline-env <path>           Path to env file (default: .pipeline.env)
  --header-template <path>    Override HEADER_TEMPLATE_PATH
  --footer-template <path>    Override FOOTER_TEMPLATE_PATH
  --document-template <path>  Override DOCUMENT_TEMPLATE_PATH
  --book-layout-css <path>    Override BOOK_LAYOUT_CSS_PATH
  --printready                Enable print-ready PDF output with bleed area
  --bleed <length>            Override PDF_BLEED (used with --printready)

Configuration:
  Configure via .pipeline.env by default, or pass --pipeline-env <path>.
`);
}

function readOptionValue(args, i, optionName) {
  const value = args[i + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}

function parseCliArgs(argv) {
  const [commandArg, ...rest] = argv;

  if (commandArg === '--help' || commandArg === '-h' || commandArg === 'help') {
    return { command: 'help', overrides: {} };
  }

  const command = !commandArg || commandArg.startsWith('--') ? 'build' : commandArg;
  const optionArgs = commandArg && commandArg.startsWith('--') ? [commandArg, ...rest] : rest;

  const overrides = {};

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];

    if (arg === '--pipeline-env') {
      overrides.envFilePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--header-template') {
      overrides.headerTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--footer-template') {
      overrides.footerTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--document-template') {
      overrides.documentTemplatePath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--book-layout-css') {
      overrides.bookLayoutCssPath = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    if (arg === '--printready') {
      overrides.printReady = true;
      continue;
    }

    if (arg === '--bleed') {
      overrides.pdfBleed = readOptionValue(optionArgs, i, arg);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, overrides };
}

async function setupEnvFile(cwd, envFilePath) {
  const targetPath = path.resolve(cwd, envFilePath);
  const examplePath = path.resolve(cwd, '.env.example');

  await copyFile(examplePath, targetPath, constants.COPYFILE_EXCL);
  console.log(`Created env file: ${targetPath}`);
}

async function main() {
  const { command, overrides } = parseCliArgs(process.argv.slice(2));

  if (command === 'help') {
    printHelp();
    return;
  }

  const envFilePath = overrides.envFilePath ?? '.pipeline.env';

  if (command === 'setup-env') {
    await setupEnvFile(process.cwd(), envFilePath);
    return;
  }

  const config = loadConfig(process.cwd(), overrides, { envFilePath });

  if (command === 'css') {
    await buildCss(config);
    return;
  }

  if (command === 'pdf') {
    await renderMarkdownDirectory(config, { verbose: true });
    return;
  }

  if (command === 'upload') {
    await runUploads(config);
    return;
  }

  if (command === 'build') {
    await buildCss(config);
    await renderMarkdownDirectory(config, { verbose: true });
    await runUploads(config);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run with --help.`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
