# @davidsneighbour/draft-pipeline

A standalone package extracted from the `bookofhugo.dev` toolchain for:

1. Markdown to print-style PDF generation.
2. With Tailwind CSS integration for PDF styling.
3. Optional upload of built PDFs to a reMarkable tablet and/or any SSH/rsyncable destination.

- [How it works](#how-it-works)
  - [Markdown to PDF notes](#markdown-to-pdf-notes)
  - [Upload integrations](#upload-integrations)
    - [reMarkable integration internals](#remarkable-integration-internals)
    - [Generic SSH integration](#generic-ssh-integration)
- [Installation](#installation)
- [Commands](#commands)
  - [`draft-pipeline css`](#draft-pipeline-css)
  - [`draft-pipeline pdf`](#draft-pipeline-pdf)
  - [`draft-pipeline upload`](#draft-pipeline-upload)
  - [`draft-piepline build`](#draft-piepline-build)
- [Configuration](#configuration)
  - [CLI-only options](#cli-only-options)
  - [Parameter reference (CLI / env / config)](#parameter-reference-cli--env--config)
  - [Sensible defaults](#sensible-defaults)
- [Graceful errors](#graceful-errors)

## How it works

- __Step 1:__ Build Tailwind CSS from `TAILWIND_INPUT_CSS` to `OUTPUT_CSS_FILE`.
- __Step 2:__ Convert Markdown files from `MARKDOWN_INPUT_DIR` into PDFs in `OUTPUT_DIR` (either n-to-1 or n-to-n generation).
- __Step 3:__ Run enabled upload integrations.

### Markdown to PDF notes

- The input is a directory tree containing Markdown files (`.md`, `.markdown`).
- It's front matter is read with [`gray-matter`](https://www.npmjs.com/package/gray-matter).
- Files with `b/pdf/ignore: true` in the front matter are skipped.
- Markdown content is rendered via [`marked`](https://www.npmjs.com/package/marked).
- PDF generation runs through headless [Playwright Chromium](https://www.npmjs.com/package/playwright).
- Header, footer, and document HTML can be configured using templates.
- Output PDF names are flattened/sanitized from source path segments and can be in parts configured via front matter.

### Upload integrations

The upload stage offers integrations to upload (synchronize) the created PDF files to various locations.

- Generic SSH/Rsync integration - (`SSH_UPLOAD_ENABLED=true|false`)
- reMarkable integration - (`REMARKABLE_UPLOAD_ENABLED=true|false`)

Each integration must be explicitly enabled (`true`).

#### reMarkable integration internals

This part of the project exists because I, [@davidsneighbour](https://github.com/davidsneighbour) use a reMarkable 2. [reMarkable](https://remarkable.com/) does not ingest plain PDF uploads directly into the library. It requires companion `.metadata` and `.content` JSON files, a UUID for each file, and a folder that the file is copied to. This integration creates those files on the fly, copies all files into the configured xochitl data directory, and finally restarts `xochitl` so the documents appear in the UI. This is relatively slow per file and, depending on the amount of files already on the tablet, the restart takes very long. It's not optimal, but it works. I suggest to create two configurations, one to create the PDF files and one that creates and uploads those files when you want to update the tablet. Or you disconnect your tablet while uploading. The script will fail gracefully when no remarkable is connected.

This README.md assumes you have your reMarkable tablet set up for SSH access and I call it `remarkable` in my SSH configuration instead of a dynamically assigned IP address. Read the [reMarkable support article for the USB to SSH access](https://remarkable.guide/guide/access/ssh.html) for details on how to set this up. I might write up a guide one day.

#### Generic SSH integration

Uploads built PDFs to any SSH target and directory.

- `scp` mode uploads one PDF at a time.
- `rsync` mode uses include/exclude patterns so only `*.pdf` files are transferred.
- Both modes are configurable through `SSH_UPLOAD_METHOD=scp|rsync`.

## Installation

```bash
npm install @davidsneighbour/draft-pipeline
```

## Commands

### `draft-pipeline css`

To be written... creates the css file.

### `draft-pipeline pdf`

To be written... creates the PDF files.

### `draft-pipeline upload`

To be written... uploads to configured targets.

### `draft-piepline build`

To be written... a successive pipeline of `css` > `pdf` > `upload`.

## Configuration

The pipeline configuration can be changed using .env-variables, a config file, or directly via CLI parameters when you call the tool. To create the env file run the following command:

```bash
npx draft-pipeline setup-env --pipeline-env sample.env
```

Leaving `--pipeline-env` out will save the example to `sample.env`

All configuration is resolved in this order:

1. Sensible defaults
1. Environment variables (`.pipeline.env` by default)
1. JSON config file (`.pipeline.config.json` by default)
1. CLI flags

Later sources override earlier ones.

Print the final resolved configuration and where each value came from:

```bash
draft-pipeline build --print-config
draft-pipeline build --print-config=json
```

### CLI-only options

- `--pipeline-env <path>`: env file path (default: `.pipeline.env`, will be loaded automatically)
- `--pipeline-config <path>`: JSON config file path (default: `.pipeline.config.json`)
- `--print-config[=table|json]`: show resolved config and source mapping, then exit

### Parameter reference (CLI / env / config)

| Purpose                               | CLI                   | Env                             | Config key                   | Default                           |
| ------------------------------------- | --------------------- | ------------------------------- | ---------------------------- | --------------------------------- |
| Markdown input dir                    | —                     | `MARKDOWN_INPUT_DIR`            | `markdownInputDir`           | `./book`                          |
| Output dir                            | —                     | `OUTPUT_DIR`                    | `outputDir`                  | `./dist`                          |
| Output CSS file                       | —                     | `OUTPUT_CSS_FILE`               | `outputCssFile`              | `./dist/output.css`               |
| Tailwind input CSS                    | —                     | `TAILWIND_INPUT_CSS`            | `tailwindInputCss`           | `./styles/pdf.css`                |
| Header template                       | `--header-template`   | `HEADER_TEMPLATE_PATH`          | `headerTemplatePath`         | `./templates/header.html`         |
| Footer template                       | `--footer-template`   | `FOOTER_TEMPLATE_PATH`          | `footerTemplatePath`         | `./templates/footer.html`         |
| Document template                     | `--document-template` | `DOCUMENT_TEMPLATE_PATH`        | `documentTemplatePath`       | `./templates/document.html`       |
| Book layout CSS                       | `--book-layout-css`   | `BOOK_LAYOUT_CSS_PATH`          | `bookLayoutCssPath`          | `./styles/pdf-book-layout.css`    |
| Print ready mode                      | `--printready`        | `PDF_PRINT_READY`               | `pdfPrintReady`              | `false`                           |
| PDF bleed                             | `--bleed`             | `PDF_BLEED`                     | `pdfBleed`                   | `3mm`                             |
| Enable reMarkable upload              | —                     | `REMARKABLE_UPLOAD_ENABLED`     | `remarkableUploadEnabled`    | `false`                           |
| reMarkable host                       | —                     | `REMARKABLE_HOST`               | `remarkableHost`             | `remarkable`                      |
| reMarkable xochitl dir                | —                     | `REMARKABLE_XOCHITL_DIR`        | `remarkableXochitlDir`       | `.local/share/remarkable/xochitl` |
| reMarkable parent folder UUID         | —                     | `REMARKABLE_PARENT_FOLDER_UUID` | `remarkableParentFolderUuid` | empty                             |
| reMarkable parent folder display name | —                     | `REMARKABLE_PARENT_FOLDER_NAME` | `remarkableParentFolderName` | `Book of Hugo`                    |
| Enable SSH upload                     | —                     | `SSH_UPLOAD_ENABLED`            | `sshUploadEnabled`           | `false`                           |
| SSH target (`user@host`)              | —                     | `SSH_TARGET`                    | `sshTarget`                  | empty                             |
| SSH target dir                        | —                     | `SSH_TARGET_DIR`                | `sshTargetDir`               | empty                             |
| SSH upload method                     | —                     | `SSH_UPLOAD_METHOD`             | `sshUploadMethod`            | `scp`                             |
| SSH port                              | —                     | `SSH_PORT`                      | `sshPort`                    | unset                             |

### Sensible defaults

Defaults are chosen to make local development work out-of-the-box with this repository layout:

- source markdown from `./book`
- write build artifacts to `./dist`
- use repository-provided templates and CSS
- disable all uploads by default for safe local runs
- use `scp` for SSH uploads unless explicitly changed
- keep print-ready mode disabled unless explicitly enabled

## Graceful errors

The package intentionally fails with direct explanations when:

- input/template/css files are not readable,
- no markdown files are found,
- an upload integration is enabled but its host is unreachable,
- reMarkable upload is enabled but folder UUID is missing,
- generic SSH upload is enabled but target settings are missing,
- no PDFs are available for upload,
- Tailwind build command fails.
