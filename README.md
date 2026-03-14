# draft-pipeline

A standalone package extracted from the `bookofhugo.dev` toolchain for:

1. Markdown → print-style PDF generation.
2. Tailwind CSS compilation for PDF styling.
3. Optional upload of built PDFs to a reMarkable tablet over SSH.

## Extracted requirements and procedures

### Markdown to PDF requirements

- Input is a directory tree containing Markdown (`.md`, `.markdown`).
- Front matter is read with `gray-matter`.
- Files with `b/pdf/ignore: true` are skipped.
- Markdown content is rendered via `marked`.
- PDF generation runs through headless Playwright Chromium.
- Header/footer/document HTML templates are applied with token replacement.
- Output PDF names are flattened/sanitized from source path segments.

### Upload to reMarkable requirements

- SSH access to a configured reMarkable host (`REMARKABLE_HOST`).
- Target xochitl data directory (`REMARKABLE_XOCHITL_DIR`).
- Folder UUID where documents should be attached (`REMARKABLE_PARENT_FOLDER_UUID`).
- Upload is explicitly toggleable with `REMARKABLE_UPLOAD_ENABLED=true|false`.

### Procedure flow

1. Build Tailwind CSS from `TAILWIND_INPUT_CSS` to `OUTPUT_CSS_FILE`.
2. Convert Markdown files from `MARKDOWN_INPUT_DIR` into PDFs in `OUTPUT_DIR`.
3. If upload is enabled, upload generated PDFs to reMarkable and restart xochitl.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` as needed.

## Commands

```bash
npm run css      # compile tailwind css
npm run pdf      # generate PDFs only
npm run upload   # upload only (if enabled)
npm run build    # css + pdf + upload
```

Or with the CLI:

```bash
node src/cli.mjs build
```

## Configuration defaults

Defaults are designed for a repository that mirrors this package structure.

- Templates:
  - `./templates/header.html`
  - `./templates/footer.html`
  - `./templates/document.html`
- Tailwind CSS:
  - input `./styles/pdf.css`
  - output `./dist/output.css`
- Markdown input: `./book`
- PDF output: `./dist`
- Upload disabled by default.
- reMarkable host default: `remarkable`.

## Graceful errors

The package intentionally fails with direct explanations when:

- input/template/css files are not readable,
- no markdown files are found,
- upload is enabled but host is unreachable,
- upload is enabled but folder UUID is missing,
- no PDFs are available for upload,
- Tailwind build command fails.
