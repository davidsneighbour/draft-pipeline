# @davidsneighbour/draft-pipeline

A standalone package extracted from the `bookofhugo.dev` toolchain for:

1. Markdown to print-style PDF generation.
2. Tailwind CSS integration for PDF styling.
3. Optional upload of built PDFs to a reMarkable tablet and/or any SSH/rsyncable destination.
4. A portable single-file `draft` command for sending one Markdown draft to a reMarkable.

- [How it works](#how-it-works)
  - [Single-file draft workflow](#single-file-draft-workflow)
  - [Markdown to PDF notes](#markdown-to-pdf-notes)
  - [Themes](#themes)
  - [Upload integrations](#upload-integrations)
    - [reMarkable integration internals](#remarkable-integration-internals)
    - [Generic SSH integration](#generic-ssh-integration)
- [Installation](#installation)
- [Commands](#commands)
  - [`draft <file>`](#draft-file)
  - [`draft-pipeline css`](#draft-pipeline-css)
  - [`draft-pipeline pdf`](#draft-pipeline-pdf)
  - [`draft-pipeline upload`](#draft-pipeline-upload)
  - [`draft-pipeline build`](#draft-pipeline-build)
- [Configuration](#configuration)
  - [CLI-only options](#cli-only-options)
  - [Parameter reference (CLI / env / config)](#parameter-reference-cli--env--config)
  - [Sensible defaults](#sensible-defaults)
- [Graceful errors](#graceful-errors)

## How it works

- __Step 1:__ Build Tailwind CSS from `TAILWIND_INPUT_CSS` to `OUTPUT_CSS_FILE`.
- __Step 2:__ Convert Markdown files from `MARKDOWN_INPUT_DIR` into PDFs in `OUTPUT_DIR`.
- __Step 3:__ Run enabled upload integrations.

The `draft <file>` shortcut is different: it renders one Markdown file with bundled templates and CSS, writes the PDF to `.draft-pipeline/` by default, then uploads that one PDF to the configured reMarkable folder.

### Single-file draft workflow

After global installation, run this from any directory:

```bash
npm install -g @davidsneighbour/draft-pipeline
draft markdown.md
```

That command:

1. Reads `markdown.md`.
2. Creates a PDF in `.draft-pipeline/`.
3. Uses the bundled `remarkable-edit` theme by default.
4. Uploads only that generated PDF to the configured reMarkable folder.
5. Does not purge the target folder unless `--purge` is passed.

For a PDF-only run:

```bash
draft markdown.md --no-upload
```

For a custom output folder:

```bash
draft markdown.md --output-dir ~/Documents/drafts --no-upload
```

For an explicit bundled theme:

```bash
draft markdown.md --theme remarkable-edit
```

For a custom theme CSS file:

```bash
draft markdown.md --theme-css ./themes/my-editing-theme.css
```

The shortcut can also be called through the package name:

```bash
draft-pipeline draft markdown.md
```

### Markdown to PDF notes

- The directory pipeline input is a directory tree containing Markdown files (`.md`, `.markdown`).
- The `draft <file>` shortcut accepts exactly one Markdown file.
- Front matter is read with [`gray-matter`](https://www.npmjs.com/package/gray-matter).
- Files with `b/pdf/ignore: true` in the front matter are skipped.
- Markdown content is rendered via [`marked`](https://www.npmjs.com/package/marked).
- PDF generation runs through headless [Playwright Chromium](https://www.npmjs.com/package/playwright).
- Header, footer, and document HTML can be configured using templates.
- Output PDF names are flattened/sanitized from source path segments.

### Themes

Themes are plain CSS files loaded after the base CSS and the book layout CSS. This makes typography overrides easy without changing templates or the renderer.

The initial bundled theme is `remarkable-edit` at `themes/remarkable-edit.css`. It uses a line height of `2` for comfortable handwritten editing on the reMarkable.

Theme configuration options:

```bash
# Use a bundled theme.
draft markdown.md --theme remarkable-edit

# Use a custom theme CSS file.
draft markdown.md --theme-css ./themes/my-theme.css

# Configure the directory pipeline through env/config.
THEME_CSS_PATH=./themes/my-theme.css
```

In JSON config:

```json
{
  "themeCssPath": "./themes/my-theme.css"
}
```

### Upload integrations

The upload stage offers integrations to upload or synchronise the created PDF files to various locations.

- Generic SSH/Rsync integration - (`SSH_UPLOAD_ENABLED=true|false`)
- reMarkable integration - (`REMARKABLE_UPLOAD_ENABLED=true|false`)

Each directory-pipeline integration must be explicitly enabled (`true`). The single-file `draft <file>` command enables the reMarkable upload path for that one generated PDF unless `--no-upload` is used.

#### reMarkable integration internals

This part of the project exists because I, [@davidsneighbour](https://github.com/davidsneighbour) use a reMarkable 2. [reMarkable](https://remarkable.com/) does not ingest plain PDF uploads directly into the library. It requires companion `.metadata` and `.content` JSON files, a UUID for each file, and a folder that the file is copied to. This integration creates those files on the fly, copies all files into the configured xochitl data directory, and finally restarts `xochitl` so the documents appear in the UI. This is relatively slow per file and, depending on the amount of files already on the tablet, the restart takes very long. It's not optimal, but it works. I suggest creating two configurations, one to create the PDF files and one that creates and uploads those files when you want to update the tablet. Or you disconnect your tablet while uploading. The script will fail gracefully when no remarkable is connected.

This README.md assumes you have your reMarkable tablet set up for SSH access and I call it `remarkable` in my SSH configuration instead of a dynamically assigned IP address. Read the [reMarkable support article for the USB to SSH access](https://remarkable.guide/guide/access/ssh.html) for details on how to set this up. I might write up a guide one day.

#### Generic SSH integration

Uploads built PDFs to any SSH target and directory.

- `scp` mode uploads one PDF at a time.
- `rsync` mode uses include/exclude patterns so only `*.pdf` files are transferred.
- Both modes are configurable through `SSH_UPLOAD_METHOD=scp|rsync`.

## Installation

```bash
npm install -g @davidsneighbour/draft-pipeline
```

For local project use:

```bash
npm install @davidsneighbour/draft-pipeline
```

## Commands

### `draft <file>`

Create a PDF from one Markdown file and upload it to the configured reMarkable folder:

```bash
draft markdown.md
```

Useful options:

```bash
draft markdown.md --no-upload
draft markdown.md --output-dir ./pdf
draft markdown.md --theme remarkable-edit
draft markdown.md --theme-css ./themes/my-theme.css
draft markdown.md --purge
```

### `draft-pipeline css`

Builds the configured Tailwind CSS entry file into the configured output CSS file.

```bash
draft-pipeline css
```

### `draft-pipeline pdf`

Creates PDF files from all Markdown files in the configured input directory.

```bash
draft-pipeline pdf
```

### `draft-pipeline upload`

Uploads generated PDFs to configured targets.

```bash
draft-pipeline upload
```

### `draft-pipeline build`

Runs the full directory pipeline: `css` > `pdf` > `upload`.

```bash
draft-pipeline build
```

## Configuration

The pipeline configuration can be changed using .env variables, a config file, or directly via CLI parameters when you call the tool. To create the env file run the following command:

```bash
npx draft-pipeline setup-env --pipeline-env sample.env
```

Leaving `--pipeline-env` out will save the example to `.pipeline.env`.

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
draft markdown.md --print-config=json
```

### CLI-only options

- `--pipeline-env <path>`: env file path (default: `.pipeline.env`, will be loaded automatically)
- `--pipeline-config <path>`: JSON config file path (default: `.pipeline.config.json`)
- `--print-config[=table|json]`: show resolved config and source mapping, then exit
- `--theme <name>`: use a bundled theme by name
- `--theme-css <path>`: use a custom theme CSS file
- `--output-dir <path>`: override output directory
- `--upload` / `--no-upload`: control draft-command reMarkable upload
- `--purge` / `--no-purge`: control whether the draft command purges the reMarkable target folder before uploading

### Parameter reference (CLI / env / config)

| Purpose                               | CLI                   | Env                             | Config key                   | Default                           |
| ------------------------------------- | --------------------- | ------------------------------- | ---------------------------- | --------------------------------- |
| Markdown input dir                    | -                     | `MARKDOWN_INPUT_DIR`            | `markdownInputDir`           | `./book`                          |
| Output dir                            | `--output-dir`        | `OUTPUT_DIR`                    | `outputDir`                  | `./dist`                          |
| Output CSS file                       | -                     | `OUTPUT_CSS_FILE`               | `outputCssFile`              | `./dist/output.css`               |
| Tailwind input CSS                    | -                     | `TAILWIND_INPUT_CSS`            | `tailwindInputCss`           | `./styles/pdf.css`                |
| Header template                       | `--header-template`   | `HEADER_TEMPLATE_PATH`          | `headerTemplatePath`         | `./templates/header.html`         |
| Footer template                       | `--footer-template`   | `FOOTER_TEMPLATE_PATH`          | `footerTemplatePath`         | `./templates/footer.html`         |
| Document template                     | `--document-template` | `DOCUMENT_TEMPLATE_PATH`        | `documentTemplatePath`       | `./templates/document.html`       |
| Book layout CSS                       | `--book-layout-css`   | `BOOK_LAYOUT_CSS_PATH`          | `bookLayoutCssPath`          | `./styles/pdf-book-layout.css`    |
| Theme CSS                             | `--theme-css`         | `THEME_CSS_PATH`                | `themeCssPath`               | empty                             |
| Print ready mode                      | `--printready`        | `PDF_PRINT_READY`               | `pdfPrintReady`              | `false`                           |
| PDF bleed                             | `--bleed`             | `PDF_BLEED`                     | `pdfBleed`                   | `3mm`                             |
| Enable reMarkable upload              | -                     | `REMARKABLE_UPLOAD_ENABLED`     | `remarkableUploadEnabled`    | `false`                           |
| reMarkable host                       | -                     | `REMARKABLE_HOST`               | `remarkableHost`             | `remarkable`                      |
| reMarkable xochitl dir                | -                     | `REMARKABLE_XOCHITL_DIR`        | `remarkableXochitlDir`       | `.local/share/remarkable/xochitl` |
| reMarkable parent folder UUID         | -                     | `REMARKABLE_PARENT_FOLDER_UUID` | `remarkableParentFolderUuid` | empty                             |
| reMarkable parent folder display name | -                     | `REMARKABLE_PARENT_FOLDER_NAME` | `remarkableParentFolderName` | `Book of Hugo`                    |
| Enable SSH upload                     | -                     | `SSH_UPLOAD_ENABLED`            | `sshUploadEnabled`           | `false`                           |
| SSH target (`user@host`)              | -                     | `SSH_TARGET`                    | `sshTarget`                  | empty                             |
| SSH target dir                        | -                     | `SSH_TARGET_DIR`                | `sshTargetDir`               | empty                             |
| SSH upload method                     | -                     | `SSH_UPLOAD_METHOD`             | `sshUploadMethod`            | `scp`                             |
| SSH port                              | -                     | `SSH_PORT`                      | `sshPort`                    | unset                             |

### Sensible defaults

Defaults are chosen to make local development work out-of-the-box with this repository layout:

- source markdown from `./book`
- write build artifacts to `./dist`
- use repository-provided templates and CSS
- disable all directory-pipeline uploads by default for safe local runs
- use `scp` for SSH uploads unless explicitly changed
- keep print-ready mode disabled unless explicitly enabled
- make `draft <file>` portable by using bundled templates, bundled base CSS, and the bundled `remarkable-edit` theme

## Graceful errors

The package intentionally fails with direct explanations when:

- input/template/css files are not readable,
- no markdown files are found,
- the draft command receives zero or multiple file paths,
- an upload integration is enabled but its host is unreachable,
- reMarkable upload is enabled but folder UUID is missing,
- generic SSH upload is enabled but target settings are missing,
- no PDFs are available for upload,
- Tailwind build command fails.
