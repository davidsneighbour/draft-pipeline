import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { marked } from 'marked';
import { chromium } from 'playwright';
import { assertReadableDir, assertReadableFile } from './config.mjs';

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shouldIgnorePdf(data) {
  return data?.['b/pdf/ignore'] === true || data?.['b/pdf/ignore'] === 'true';
}

function sanitiseSegment(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildFlatPdfFileName(relativePath) {
  const parsed = path.parse(relativePath);
  const segments = [...(parsed.dir ? parsed.dir.split(path.sep) : []), parsed.name]
    .map(sanitiseSegment)
    .filter(Boolean);

  return `${segments.join('-') || 'document'}.pdf`;
}

function applyTemplate(template, replacements) {
  return template.replaceAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key) => replacements[key] ?? token);
}

function getPdfRenderSettings(config) {
  if (!config.pdfPrintReady) {
    return {
      width: '7in',
      height: '10in',
      marginTop: '20mm',
      marginBottom: '20mm',
      marginInner: '1.5cm',
      marginOuter: '1cm',
      bleed: '0mm',
      browserMargin: { top: '20mm', right: '0mm', bottom: '20mm', left: '0mm' },
    };
  }

  const bleed = String(config.pdfBleed).trim();

  return {
    width: '7.25in',
    height: '10.25in',
    marginTop: '20mm',
    marginBottom: '20mm',
    marginInner: '1.5cm',
    marginOuter: '1cm',
    bleed,
    browserMargin: { top: bleed, right: bleed, bottom: bleed, left: bleed },
  };
}

function uniqueOutputName(outputName, used) {
  if (!used.has(outputName)) {
    used.add(outputName);
    return outputName;
  }

  const parsed = path.parse(outputName);
  let index = 2;

  while (used.has(`${parsed.name}-${index}${parsed.ext}`)) {
    index += 1;
  }

  const uniqueName = `${parsed.name}-${index}${parsed.ext}`;
  used.add(uniqueName);
  return uniqueName;
}

async function buildJobs(inputDir, outputDir) {
  const files = await fg(['**/*.md', '**/*.markdown'], {
    cwd: inputDir,
    onlyFiles: true,
    absolute: true,
  });

  return buildJobsForFiles(files.sort(), outputDir, (absolutePath) => path.relative(inputDir, absolutePath));
}

async function buildJobsForFiles(files, outputDir, getRelativePath = (file) => path.basename(file)) {
  const used = new Set();
  const jobs = [];

  for (const absolutePath of files) {
    const relativePath = getRelativePath(absolutePath);
    const parsed = matter(await readFile(absolutePath, 'utf8'));

    if (shouldIgnorePdf(parsed.data)) {
      continue;
    }

    const sourceName = path.basename(relativePath, path.extname(relativePath));
    const title = typeof parsed.data?.title === 'string' ? parsed.data.title.trim() || sourceName : sourceName;
    const outputName = uniqueOutputName(buildFlatPdfFileName(relativePath), used);

    jobs.push({
      absolutePath,
      title,
      outputPdfPath: path.join(outputDir, outputName),
      fileName: path.basename(relativePath),
    });
  }

  return jobs;
}

async function readOptionalThemeCss(config) {
  if (!config.themeCssPath) {
    return '';
  }

  await assertReadableFile(config.themeCssPath, 'Theme CSS file');
  return readFile(config.themeCssPath, 'utf8');
}

async function renderJobs(config, jobs, { verbose = false } = {}) {
  await assertReadableFile(config.outputCssFile, 'Compiled CSS file');
  await assertReadableFile(config.bookLayoutCssPath, 'Book layout CSS file');
  await assertReadableFile(config.documentTemplatePath, 'Document template');
  await assertReadableFile(config.headerTemplatePath, 'Header template');
  await assertReadableFile(config.footerTemplatePath, 'Footer template');

  await mkdir(config.outputDir, { recursive: true });

  const [css, bookCss, themeCss, htmlTemplate, headerTemplate, footerTemplate] = await Promise.all([
    readFile(config.outputCssFile, 'utf8'),
    readFile(config.bookLayoutCssPath, 'utf8'),
    readOptionalThemeCss(config),
    readFile(config.documentTemplatePath, 'utf8'),
    readFile(config.headerTemplatePath, 'utf8'),
    readFile(config.footerTemplatePath, 'utf8'),
  ]);

  const renderSettings = getPdfRenderSettings(config);

  if (jobs.length === 0) {
    throw new Error('No renderable markdown files found. Files with b/pdf/ignore: true are skipped.');
  }

  if (verbose) {
    console.log(`Rendering ${jobs.length} markdown file(s).`);
  }

  const createdPdfPaths = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const job of jobs) {
      const parsed = matter(await readFile(job.absolutePath, 'utf8'));
      const htmlBody = marked.parse(parsed.content, { gfm: true, breaks: false });
      const html = applyTemplate(htmlTemplate, {
        documentTitle: escapeHtml(job.title),
        css: `${css}\n${bookCss}\n${themeCss}`,
        htmlBody,
        marginTop: renderSettings.marginTop,
        marginBottom: renderSettings.marginBottom,
        marginInner: renderSettings.marginInner,
        marginOuter: renderSettings.marginOuter,
        bleed: renderSettings.bleed,
      });

      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.pdf({
          path: job.outputPdfPath,
          width: renderSettings.width,
          height: renderSettings.height,
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: applyTemplate(headerTemplate, {
            fileName: escapeHtml(job.fileName),
            flatPdfName: escapeHtml(path.basename(job.outputPdfPath)),
            title: escapeHtml(job.title),
          }),
          footerTemplate: applyTemplate(footerTemplate, {
            fileName: escapeHtml(job.fileName),
            flatPdfName: escapeHtml(path.basename(job.outputPdfPath)),
            title: escapeHtml(job.title),
          }),
          margin: renderSettings.browserMargin,
        });
      } finally {
        await page.close();
      }

      createdPdfPaths.push(job.outputPdfPath);
      console.log(`Created PDF: ${job.outputPdfPath}`);
    }
  } finally {
    await browser.close();
  }

  return createdPdfPaths;
}

export async function renderMarkdownFiles(config, files, { verbose = false } = {}) {
  const absoluteFiles = files.map((file) => path.resolve(config.cwd, file));

  for (const file of absoluteFiles) {
    await assertReadableFile(file, 'Markdown file');
  }

  await mkdir(config.outputDir, { recursive: true });
  const jobs = await buildJobsForFiles(absoluteFiles, config.outputDir);

  return renderJobs(config, jobs, { verbose });
}

export async function renderMarkdownDirectory(config, { verbose = false } = {}) {
  await assertReadableDir(config.markdownInputDir, 'Markdown input directory');

  const jobs = await buildJobs(config.markdownInputDir, config.outputDir);
  if (jobs.length === 0) {
    throw new Error(`No markdown files found in ${config.markdownInputDir}. Add *.md files or change MARKDOWN_INPUT_DIR.`);
  }

  if (verbose) {
    console.log(`Rendering markdown files from ${config.markdownInputDir}`);
  }

  return renderJobs(config, jobs, { verbose });
}
