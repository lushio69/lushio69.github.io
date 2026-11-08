import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeBase } from './lib/utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const base = normalizeBase(config.basePath);

const errors = [];
let htmlCount = 0;
let linkCount = 0;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function resolveLocal(url) {
  const cleaned = decodeEntities(url).split('#')[0].split('?')[0];
  if (!cleaned || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(cleaned)) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(cleaned);
  } catch (error) {
    errors.push(`Invalid percent-encoding: ${url}`);
    return null;
  }

  if (!pathname.startsWith('/')) {
    errors.push(`Relative URL is not supported in generated pages: ${url}`);
    return null;
  }
  if (base !== '/') {
    if (!pathname.startsWith(base)) {
      errors.push(`URL does not include basePath ${base}: ${url}`);
      return null;
    }
    pathname = pathname.slice(base.length - 1);
  }

  const relative = pathname.replace(/^\/+/, '');
  if (!relative) return path.join(DIST, 'index.html');
  if (relative.endsWith('/')) return path.join(DIST, relative, 'index.html');
  if (path.extname(relative)) return path.join(DIST, relative);
  return path.join(DIST, relative, 'index.html');
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

const files = walk(DIST);

for (const file of files) {
  if (!file.endsWith('.html')) continue;
  htmlCount += 1;
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(DIST, file);

  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${relative}: missing or empty <title>`);
  if (!/<meta name="viewport"/.test(html)) errors.push(`${relative}: missing viewport meta tag`);
  if (!/assets\/styles\.css/.test(html)) errors.push(`${relative}: missing stylesheet`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicates)) errors.push(`${relative}: duplicate id "${id}"`);

  for (const anchor of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    if (/<a\b/.test(anchor[1])) {
      errors.push(`${relative}: nested <a> element (the browser will close the outer link early)`);
      break;
    }
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    linkCount += 1;
    const target = resolveLocal(match[1]);
    if (!target) continue;
    if (!fs.existsSync(target)) {
      errors.push(`${relative}: broken link ${match[1]} → ${path.relative(DIST, target)}`);
    }
  }
}

for (const required of [
  'sitemap.xml',
  'robots.txt',
  'search-index.json',
  '404.html',
  'categories/index.html',
  'assets/katex.min.css',
  'assets/fonts/KaTeX_Main-Regular.woff2',
  '.nojekyll',
]) {
  if (!fs.existsSync(path.join(DIST, required))) errors.push(`Missing required output: ${required}`);
}

// Basic sanity checks for the generated sitemap and search index.
try {
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  if (!sitemap.includes('<urlset')) errors.push('sitemap.xml: missing urlset');
  if (!sitemap.includes('</urlset>')) errors.push('sitemap.xml: unclosed urlset');
} catch (error) {
  errors.push(`sitemap.xml: ${error.message}`);
}

try {
  const index = JSON.parse(fs.readFileSync(path.join(DIST, 'search-index.json'), 'utf8'));
  if (!Array.isArray(index)) errors.push('search-index.json: expected an array');
  else if (index.some((item) => !item.title || !item.url || !item.category)) errors.push('search-index.json: item missing title, url or category');
} catch (error) {
  errors.push(`search-index.json: ${error.message}`);
}

if (errors.length) {
  console.error(`\n  Check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`   × ${error}`);
  console.error('');
  process.exit(1);
}

console.log(`\n  Check passed: ${htmlCount} HTML pages, ${linkCount} internal links, 0 broken.\n`);
