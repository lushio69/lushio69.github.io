import fs from 'node:fs';
import path from 'node:path';

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(value = '') {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

export function stripHtml(html = '') {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract readable text from Markdown for search and fallback summaries.
 * Working from the source avoids KaTeX's MathML/HTML duplicate text.
 */
export function markdownToPlainText(markdown = '') {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\\\[([\s\S]*?)\\\]/g, ' $1 ')
    .replace(/\\\(([\s\S]*?)\\\)/g, ' $1 ')
    .replace(/\$([^$\n]+?)\$/g, ' $1 ')
    .replace(/[`*_~]/g, '')
    .replace(/<[a-zA-Z/][^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBase(basePath = '/') {
  if (!basePath || basePath === '/') return '/';
  return `/${String(basePath).replace(/^\/+|\/+$/g, '')}/`;
}

export function withBase(route = '/', basePath = '/') {
  if (!route) return basePath;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(route)) return route;
  return `${basePath}${String(route).replace(/^\/+/, '')}`;
}

/**
 * Prefix root-relative links inside trusted Markdown-rendered HTML.
 * This keeps imported inline HTML and images working on project Pages
 * deployed under a sub-path such as /my-blog/.
 */
export function applyBaseToHtml(html = '', basePath = '/') {
  if (basePath === '/') return html;
  return String(html).replace(/\b(href|src)="\/(?!\/)/g, (_, attribute) => `${attribute}="${basePath}`);
}

export function absoluteUrl(route = '/', config) {
  const site = String(config.url || '').replace(/\/+$/, '');
  const base = normalizeBase(config.basePath);
  if (route === '/') return `${site}${base}`;
  if (/^https?:\/\//i.test(route)) return route;
  return `${site}${withBase(route, base)}`;
}

export function slugify(value = '', fallback = 'section') {
  const slug = String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['"’“”]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function formatDate(isoDate, style = 'long') {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  if (style === 'short') return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
  if (style === 'machine') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (style === 'month-day') return `${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}`;
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function readingTime(markdown = '') {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ');
  const cjk = (withoutCode.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = withoutCode
    .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 300 + latin / 200));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

export function copyDir(source, target) {
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function truncate(value = '', length = 160) {
  const text = String(value).trim();
  if ([...text].length <= length) return text;
  return `${[...text].slice(0, length).join('').trim()}…`;
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
