import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { constants, existsSync } from 'node:fs';

const DEFAULTS = {
  MARKDOWN_INPUT_DIR: './book',
  OUTPUT_DIR: './dist',
  OUTPUT_CSS_FILE: './dist/output.css',
  TAILWIND_INPUT_CSS: './styles/pdf.css',
  HEADER_TEMPLATE_PATH: './templates/header.html',
  FOOTER_TEMPLATE_PATH: './templates/footer.html',
  DOCUMENT_TEMPLATE_PATH: './templates/document.html',
  BOOK_LAYOUT_CSS_PATH: './styles/pdf-book-layout.css',
  REMARKABLE_UPLOAD_ENABLED: 'false',
  REMARKABLE_HOST: 'remarkable',
  REMARKABLE_XOCHITL_DIR: '.local/share/remarkable/xochitl',
  REMARKABLE_PARENT_FOLDER_UUID: '',
  REMARKABLE_PARENT_FOLDER_NAME: 'Book of Hugo',
};

export function loadConfig(cwd = process.cwd()) {
  const envPath = path.resolve(cwd, '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const env = { ...DEFAULTS, ...process.env };

  const config = {
    cwd,
    markdownInputDir: path.resolve(cwd, env.MARKDOWN_INPUT_DIR),
    outputDir: path.resolve(cwd, env.OUTPUT_DIR),
    outputCssFile: path.resolve(cwd, env.OUTPUT_CSS_FILE),
    tailwindInputCss: path.resolve(cwd, env.TAILWIND_INPUT_CSS),
    headerTemplatePath: path.resolve(cwd, env.HEADER_TEMPLATE_PATH),
    footerTemplatePath: path.resolve(cwd, env.FOOTER_TEMPLATE_PATH),
    documentTemplatePath: path.resolve(cwd, env.DOCUMENT_TEMPLATE_PATH),
    bookLayoutCssPath: path.resolve(cwd, env.BOOK_LAYOUT_CSS_PATH),
    remarkableUploadEnabled: String(env.REMARKABLE_UPLOAD_ENABLED).toLowerCase() === 'true',
    remarkableHost: env.REMARKABLE_HOST,
    remarkableXochitlDir: env.REMARKABLE_XOCHITL_DIR,
    remarkableParentFolderUuid: env.REMARKABLE_PARENT_FOLDER_UUID,
    remarkableParentFolderName: env.REMARKABLE_PARENT_FOLDER_NAME,
  };

  return config;
}

export async function assertReadableFile(filePath, label) {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`${label} is not readable: ${filePath}`);
  }
}

export async function assertReadableDir(dirPath, label) {
  try {
    await access(dirPath, constants.R_OK);
  } catch {
    throw new Error(`${label} is not readable: ${dirPath}`);
  }
}
