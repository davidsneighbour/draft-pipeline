import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { constants, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

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
  PDF_PRINT_READY: 'false',
  PDF_BLEED: '3mm',
};

const CONFIG_DEFAULT_PATH = '.pipeline.config.json';

const CONFIG_FIELDS = [
  { key: 'markdownInputDir', envKey: 'MARKDOWN_INPUT_DIR', configKey: 'markdownInputDir', path: true },
  { key: 'outputDir', envKey: 'OUTPUT_DIR', configKey: 'outputDir', path: true },
  { key: 'outputCssFile', envKey: 'OUTPUT_CSS_FILE', configKey: 'outputCssFile', path: true },
  { key: 'tailwindInputCss', envKey: 'TAILWIND_INPUT_CSS', configKey: 'tailwindInputCss', path: true },
  { key: 'headerTemplatePath', envKey: 'HEADER_TEMPLATE_PATH', configKey: 'headerTemplatePath', path: true, cliKey: 'headerTemplatePath' },
  { key: 'footerTemplatePath', envKey: 'FOOTER_TEMPLATE_PATH', configKey: 'footerTemplatePath', path: true, cliKey: 'footerTemplatePath' },
  { key: 'documentTemplatePath', envKey: 'DOCUMENT_TEMPLATE_PATH', configKey: 'documentTemplatePath', path: true, cliKey: 'documentTemplatePath' },
  { key: 'bookLayoutCssPath', envKey: 'BOOK_LAYOUT_CSS_PATH', configKey: 'bookLayoutCssPath', path: true, cliKey: 'bookLayoutCssPath' },
  { key: 'remarkableUploadEnabled', envKey: 'REMARKABLE_UPLOAD_ENABLED', configKey: 'remarkableUploadEnabled', parser: (value) => parseBoolean(value, 'REMARKABLE_UPLOAD_ENABLED') },
  { key: 'remarkableHost', envKey: 'REMARKABLE_HOST', configKey: 'remarkableHost' },
  { key: 'remarkableXochitlDir', envKey: 'REMARKABLE_XOCHITL_DIR', configKey: 'remarkableXochitlDir' },
  { key: 'remarkableParentFolderUuid', envKey: 'REMARKABLE_PARENT_FOLDER_UUID', configKey: 'remarkableParentFolderUuid' },
  { key: 'remarkableParentFolderName', envKey: 'REMARKABLE_PARENT_FOLDER_NAME', configKey: 'remarkableParentFolderName' },
  { key: 'sshUploadEnabled', envKey: 'SSH_UPLOAD_ENABLED', configKey: 'sshUploadEnabled', parser: (value) => parseBoolean(value, 'SSH_UPLOAD_ENABLED') },
  { key: 'sshTarget', envKey: 'SSH_TARGET', configKey: 'sshTarget' },
  { key: 'sshTargetDir', envKey: 'SSH_TARGET_DIR', configKey: 'sshTargetDir' },
  { key: 'sshUploadMethod', envKey: 'SSH_UPLOAD_METHOD', configKey: 'sshUploadMethod', parser: (value) => String(value).toLowerCase() },
  { key: 'sshPort', envKey: 'SSH_PORT', configKey: 'sshPort', parser: (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)) },
  { key: 'pdfPrintReady', envKey: 'PDF_PRINT_READY', configKey: 'pdfPrintReady', cliKey: 'printReady', parser: (value) => parseBoolean(value, 'PDF_PRINT_READY') },
  { key: 'pdfBleed', envKey: 'PDF_BLEED', configKey: 'pdfBleed', cliKey: 'pdfBleed' },
];

async function readConfigFile(configPath) {
  if (!existsSync(configPath)) {
    return { data: {}, loaded: false };
  }

  const raw = await readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${configPath}`);
  }

  return { data: parsed, loaded: true };
}

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

export async function loadConfig(cwd = process.cwd(), overrides = {}, options = {}) {
  const envFilePath = options.envFilePath ?? '.pipeline.env';
  const configFilePath = options.configFilePath ?? CONFIG_DEFAULT_PATH;
  const envPath = path.resolve(cwd, envFilePath);
  const configPath = path.resolve(cwd, configFilePath);

  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const env = { ...DEFAULTS, ...process.env };
  const { data: configFile, loaded: configFileLoaded } = await readConfigFile(configPath);

  const config = {
    cwd,
  };

  const configSources = {
    cwd: 'runtime',
  };

  for (const field of CONFIG_FIELDS) {
    let value = env[field.envKey];
    let source = 'env';

    if (Object.hasOwn(configFile, field.configKey)) {
      value = configFile[field.configKey];
      source = 'config';
    }

    if (Object.hasOwn(overrides, field.cliKey ?? field.key)) {
      value = overrides[field.cliKey ?? field.key];
      source = 'cli';
    }

    const parsedValue = field.parser ? field.parser(value) : value;
    config[field.key] = field.path ? path.resolve(cwd, parsedValue) : parsedValue;
    configSources[field.key] = source;
  }

  config.__meta = {
    envFilePath: envPath,
    envFileLoaded: existsSync(envPath),
    configFilePath: configPath,
    configFileLoaded,
    configSources,
  };

  if (config.sshPort !== undefined && Number.isNaN(config.sshPort)) {
    throw new Error('SSH_PORT must be a valid integer.');
  }

  if (!/^\d+(?:\.\d+)?(?:mm|cm|in|px)$/.test(String(config.pdfBleed).trim())) {
    throw new Error('PDF_BLEED must be a CSS length like 3mm, 0.125in, 10px, or 0cm.');
  }

  return config;
}

export function getConfigWithSources(config) {
  const { __meta, ...values } = config;
  return {
    values,
    sources: __meta?.configSources ?? {},
    files: {
      envFilePath: __meta?.envFilePath,
      envFileLoaded: __meta?.envFileLoaded,
      configFilePath: __meta?.configFilePath,
      configFileLoaded: __meta?.configFileLoaded,
    },
  };
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
