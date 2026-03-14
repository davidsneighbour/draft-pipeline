#!/usr/bin/env node
import process from 'node:process';
import { loadConfig } from './config.mjs';
import { buildCss } from './build-css.mjs';
import { renderMarkdownDirectory } from './md-to-pdf.mjs';
import { uploadToRemarkable } from './upload-remarkable.mjs';

function printHelp() {
  console.log(`draft-pipeline - A tool to convert markdown files to PDFs and upload them to reMarkable.

Commands:
  css     Build Tailwind CSS
  pdf     Convert markdown files to PDFs
  upload  Upload generated PDFs to reMarkable (when enabled)
  build   Run css + pdf + upload

Configuration:
  Configure via .env file (see .env.example).
`);
}

async function main() {
  const command = process.argv[2] ?? 'build';

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  const config = loadConfig(process.cwd());

  if (command === 'css') {
    await buildCss(config);
    return;
  }

  if (command === 'pdf') {
    await renderMarkdownDirectory(config, { verbose: true });
    return;
  }

  if (command === 'upload') {
    await uploadToRemarkable(config);
    return;
  }

  if (command === 'build') {
    await buildCss(config);
    await renderMarkdownDirectory(config, { verbose: true });
    await uploadToRemarkable(config);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run with --help.`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
