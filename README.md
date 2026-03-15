# draft-pipeline

A standalone package extracted from the `bookofhugo.dev` toolchain for:

1. Markdown → print-style PDF generation.
2. Tailwind CSS compilation for PDF styling.
3. Optional upload of built PDFs to reMarkable and/or any SSH destination.

## Extracted requirements and procedures

### Markdown to PDF requirements

- Input is a directory tree containing Markdown (`.md`, `.markdown`).
- Front matter is read with `gray-matter`.
- Files with `b/pdf/ignore: true` are skipped.
- Markdown content is rendered via `marked`.
- PDF generation runs through headless Playwright Chromium.
- Header/footer/document HTML templates are applied with token replacement.
- Output PDF names are flattened/sanitized from source path segments.

### Upload integrations

The upload stage is split into isolated integrations that run in parallel as part of the same `upload` command:

- **reMarkable integration** (`REMARKABLE_UPLOAD_ENABLED=true|false`)
- **Generic SSH integration** (`SSH_UPLOAD_ENABLED=true|false`)

Each integration must be explicitly enabled (`true`) or disabled (`false`).

### reMarkable integration internals

reMarkable does not ingest plain PDF uploads directly into the library. The integration creates companion `.metadata` and `.content` JSON files on the fly for each uploaded PDF, assigns a UUID, copies all files into the xochitl data directory, and finally restarts `xochitl` so the documents appear in the UI.

Practical SSH setup references:

- reMarkable support article for USB web interface / SSH access:
  https://support.remarkable.com/s/article/USB-web-interface
- Community SSH setup explanation (host/IP setup, common caveats):
  https://remarkable.guide/guide/access/ssh.html

Notes:

- USB cable access is often the easiest path for first-time setup.
- You typically connect by hostname (`remarkable`) via `/etc/hosts` or directly by IP.

### Generic SSH integration

Upload built PDFs to any SSH target and directory.

- `scp` mode uploads one PDF at a time.
- `rsync` mode uses include/exclude patterns so only `*.pdf` files are transferred.
- Both modes are available through `SSH_UPLOAD_METHOD=scp|rsync`.

### Procedure flow

1. Build Tailwind CSS from `TAILWIND_INPUT_CSS` to `OUTPUT_CSS_FILE`.
2. Convert Markdown files from `MARKDOWN_INPUT_DIR` into PDFs in `OUTPUT_DIR`.
3. Run enabled upload integrations.

## Setup

```bash
npm install
node src/cli.mjs setup-env
```

By default, the CLI loads `./.pipeline.env` and optionally `./.pipeline.config.json`.

Create a demo env file from `.env.example`:

```bash
node src/cli.mjs setup-env
```

Load a different env file and config file:

```bash
node src/cli.mjs build --pipeline-env ./.env.local --pipeline-config ./.pipeline.config.json
```

A full config example is available as `.pipeline.config.example.json`.

## Commands

```bash
npm run css      # compile tailwind css
npm run pdf      # generate PDFs only
npm run upload   # run all enabled upload integrations
npm run build    # css + pdf + upload
npm run release  # create a stable release (git tag + npm + GitHub)
npm run release:pre # create an rc pre-release
```

Or with the CLI:

```bash
node src/cli.mjs build
```

## Configuration

Configuration is resolved in this strict order:

1. Environment variables (`.pipeline.env` by default)
2. JSON config file (`.pipeline.config.json` by default)
3. CLI flags

Later sources override earlier ones.

### Debug resolved configuration

Print the final resolved configuration and where each value came from:

```bash
node src/cli.mjs build --print-config
node src/cli.mjs build --print-config=json
```

### CLI options

- `--pipeline-env <path>`: env file path (default: `.pipeline.env`)
- `--pipeline-config <path>`: JSON config file path (default: `.pipeline.config.json`)
- `--header-template <path>`: override header template path
- `--footer-template <path>`: override footer template path
- `--document-template <path>`: override document template path
- `--book-layout-css <path>`: override book layout CSS path
- `--printready`: force print-ready output
- `--bleed <length>`: override bleed size (e.g. `3mm`, `0.125in`)
- `--print-config[=table|json]`: show resolved config and source mapping, then exit

### Parameter reference (CLI / env / config)

| Purpose | CLI | Env | Config key | Default |
| --- | --- | --- | --- | --- |
| Markdown input dir | — | `MARKDOWN_INPUT_DIR` | `markdownInputDir` | `./book` |
| Output dir | — | `OUTPUT_DIR` | `outputDir` | `./dist` |
| Output CSS file | — | `OUTPUT_CSS_FILE` | `outputCssFile` | `./dist/output.css` |
| Tailwind input CSS | — | `TAILWIND_INPUT_CSS` | `tailwindInputCss` | `./styles/pdf.css` |
| Header template | `--header-template` | `HEADER_TEMPLATE_PATH` | `headerTemplatePath` | `./templates/header.html` |
| Footer template | `--footer-template` | `FOOTER_TEMPLATE_PATH` | `footerTemplatePath` | `./templates/footer.html` |
| Document template | `--document-template` | `DOCUMENT_TEMPLATE_PATH` | `documentTemplatePath` | `./templates/document.html` |
| Book layout CSS | `--book-layout-css` | `BOOK_LAYOUT_CSS_PATH` | `bookLayoutCssPath` | `./styles/pdf-book-layout.css` |
| Print ready mode | `--printready` | `PDF_PRINT_READY` | `pdfPrintReady` | `false` |
| PDF bleed | `--bleed` | `PDF_BLEED` | `pdfBleed` | `3mm` |
| Enable reMarkable upload | — | `REMARKABLE_UPLOAD_ENABLED` | `remarkableUploadEnabled` | `false` |
| reMarkable host | — | `REMARKABLE_HOST` | `remarkableHost` | `remarkable` |
| reMarkable xochitl dir | — | `REMARKABLE_XOCHITL_DIR` | `remarkableXochitlDir` | `.local/share/remarkable/xochitl` |
| reMarkable parent folder UUID | — | `REMARKABLE_PARENT_FOLDER_UUID` | `remarkableParentFolderUuid` | empty |
| reMarkable parent folder display name | — | `REMARKABLE_PARENT_FOLDER_NAME` | `remarkableParentFolderName` | `Book of Hugo` |
| Enable SSH upload | — | `SSH_UPLOAD_ENABLED` | `sshUploadEnabled` | `false` |
| SSH target (`user@host`) | — | `SSH_TARGET` | `sshTarget` | empty |
| SSH target dir | — | `SSH_TARGET_DIR` | `sshTargetDir` | empty |
| SSH upload method | — | `SSH_UPLOAD_METHOD` | `sshUploadMethod` | `scp` |
| SSH port | — | `SSH_PORT` | `sshPort` | unset |

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
