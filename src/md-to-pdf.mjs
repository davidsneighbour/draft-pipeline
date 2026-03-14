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

async function buildJobs(inputDir, outputDir) {
  const files = await fg(['**/*.md', '**/*.markdown'], {
    cwd: inputDir,
    onlyFiles: true,
    absolute: true,
  });

  const used = new Set();
  const jobs = [];

  for (const absolutePath of files.sort()) {
    const relativePath = path.relative(inputDir, absolutePath);
    const parsed = matter(await readFile(absolutePath, 'utf8'));

    if (shouldIgnorePdf(parsed.data)) {
      continue;
    }

    const sourceName = path.basename(relativePath, path.extname(relativePath));
    const title = typeof parsed.data?.title === 'string' ? parsed.data.title.trim() || sourceName : sourceName;

    let outputName = buildFlatPdfFileName(relativePath);
    if (used.has(outputName)) {
      const p = path.parse(outputName);
      let i = 2;
      while (used.has(`${p.name}-${i}${p.ext}`)) i += 1;
      outputName = `${p.name}-${i}${p.ext}`;
    }

    used.add(outputName);
    jobs.push({ absolutePath, title, outputPdfPath: path.join(outputDir, outputName), fileName: path.basename(relativePath) });
  }

  return jobs;
}

export async function renderMarkdownDirectory(config, { verbose = false } = {}) {
  await assertReadableDir(config.markdownInputDir, 'Markdown input directory');
  await assertReadableFile(config.outputCssFile, 'Compiled CSS file');
  await assertReadableFile(config.bookLayoutCssPath, 'Book layout CSS file');
  await assertReadableFile(config.documentTemplatePath, 'Document template');
  await assertReadableFile(config.headerTemplatePath, 'Header template');
  await assertReadableFile(config.footerTemplatePath, 'Footer template');

  await mkdir(config.outputDir, { recursive: true });

  const [css, bookCss, htmlTemplate, headerTemplate, footerTemplate] = await Promise.all([
    readFile(config.outputCssFile, 'utf8'),
    readFile(config.bookLayoutCssPath, 'utf8'),
    readFile(config.documentTemplatePath, 'utf8'),
    readFile(config.headerTemplatePath, 'utf8'),
    readFile(config.footerTemplatePath, 'utf8'),
  ]);

  const jobs = await buildJobs(config.markdownInputDir, config.outputDir);
  if (jobs.length === 0) {
    throw new Error(`No markdown files found in ${config.markdownInputDir}. Add *.md files or change MARKDOWN_INPUT_DIR.`);
  }

  if (verbose) {
    console.log(`Rendering ${jobs.length} markdown file(s) from ${config.markdownInputDir}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const job of jobs) {
      const parsed = matter(await readFile(job.absolutePath, 'utf8'));
      const htmlBody = marked.parse(parsed.content, { gfm: true, breaks: false });
      const html = applyTemplate(htmlTemplate, {
        documentTitle: escapeHtml(job.title),
        css: `${css}\n${bookCss}`,
        htmlBody,
        marginTop: '20mm',
        marginBottom: '20mm',
        marginInner: '1.5cm',
        marginOuter: '1cm',
      });

      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await page.pdf({
          path: job.outputPdfPath,
          width: '7in',
          height: '10in',
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
          margin: { top: '20mm', right: '0mm', bottom: '20mm', left: '0mm' },
        });
      } finally {
        await page.close();
      }

      console.log(`Created PDF: ${job.outputPdfPath}`);
    }
  } finally {
    await browser.close();
  }
}
