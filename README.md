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
cp .env.example .env
```

Use Node.js `--env-file` support to load `.env`, for example:

```bash
node --env-file=.env src/cli.mjs build
```

Or export variables in your shell before running `npm run ...`.

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

Override individual template assets for a run:

```bash
node src/cli.mjs pdf \
  --header-template ./custom/header.html \
  --footer-template ./custom/footer.html \
  --document-template ./custom/document.html \
  --book-layout-css ./custom/book-layout.css
```

Enable print-ready output with bleed:

```bash
node src/cli.mjs pdf --printready --bleed 3mm
```

- `--printready` forces print-ready page sizing with bleed margins.
- `--bleed <length>` overrides `PDF_BLEED` for that run (supports CSS units like `mm`, `cm`, `in`, `px`).

## Configuration defaults

Defaults are designed for a repository that mirrors this package structure.

- Templates (override via env `*_TEMPLATE_PATH` or CLI flags):
  - `./templates/header.html` (`HEADER_TEMPLATE_PATH`, `--header-template`)
  - `./templates/footer.html` (`FOOTER_TEMPLATE_PATH`, `--footer-template`)
  - `./templates/document.html` (`DOCUMENT_TEMPLATE_PATH`, `--document-template`)
- Book layout CSS: `./styles/pdf-book-layout.css` (`BOOK_LAYOUT_CSS_PATH`, `--book-layout-css`)
- Print-ready PDF mode: disabled (`PDF_PRINT_READY=false`)
- Print-ready bleed size: `3mm` (`PDF_BLEED`, override via `--bleed` when using `--printready`)
- Tailwind CSS:
  - input `./styles/pdf.css`
  - output `./dist/output.css`
- Markdown input: `./book`
- PDF output: `./dist`
- Upload integrations disabled by default.
- reMarkable host default: `remarkable`.
- Generic SSH defaults: `SSH_UPLOAD_METHOD=scp`, no target configured.

## Graceful errors

The package intentionally fails with direct explanations when:

- input/template/css files are not readable,
- no markdown files are found,
- an upload integration is enabled but its host is unreachable,
- reMarkable upload is enabled but folder UUID is missing,
- generic SSH upload is enabled but target settings are missing,
- no PDFs are available for upload,
- Tailwind build command fails.
