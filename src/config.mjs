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
  SSH_UPLOAD_ENABLED: 'false',
  SSH_TARGET: '',
  SSH_TARGET_DIR: '',
  SSH_UPLOAD_METHOD: 'scp',
  SSH_PORT: '',
};

function parseBoolean(value, name) {
  const normalizedValue = String(value).toLowerCase();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false".`);
}

export function loadConfig(cwd = process.cwd(), overrides = {}) {
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
    headerTemplatePath: path.resolve(cwd, overrides.headerTemplatePath ?? env.HEADER_TEMPLATE_PATH),
    footerTemplatePath: path.resolve(cwd, overrides.footerTemplatePath ?? env.FOOTER_TEMPLATE_PATH),
    documentTemplatePath: path.resolve(cwd, overrides.documentTemplatePath ?? env.DOCUMENT_TEMPLATE_PATH),
    bookLayoutCssPath: path.resolve(cwd, overrides.bookLayoutCssPath ?? env.BOOK_LAYOUT_CSS_PATH),
    remarkableUploadEnabled: parseBoolean(env.REMARKABLE_UPLOAD_ENABLED, 'REMARKABLE_UPLOAD_ENABLED'),
    remarkableHost: env.REMARKABLE_HOST,
    remarkableXochitlDir: env.REMARKABLE_XOCHITL_DIR,
    remarkableParentFolderUuid: env.REMARKABLE_PARENT_FOLDER_UUID,
    remarkableParentFolderName: env.REMARKABLE_PARENT_FOLDER_NAME,
    sshUploadEnabled: parseBoolean(env.SSH_UPLOAD_ENABLED, 'SSH_UPLOAD_ENABLED'),
    sshTarget: env.SSH_TARGET,
    sshTargetDir: env.SSH_TARGET_DIR,
    sshUploadMethod: String(env.SSH_UPLOAD_METHOD).toLowerCase(),
    sshPort: env.SSH_PORT ? Number(env.SSH_PORT) : undefined,
  };

  if (config.sshPort !== undefined && Number.isNaN(config.sshPort)) {
    throw new Error('SSH_PORT must be a valid integer.');
  }

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
