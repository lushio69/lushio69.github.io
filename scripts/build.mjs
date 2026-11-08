import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderMarkdown } from './lib/markdown.mjs';
import { renderMath } from './lib/math.mjs';
import * as templates from './lib/templates.mjs';
import {
  absoluteUrl,
  applyBaseToHtml,
  copyDir,
  formatDate,
  markdownToPlainText,
  normalizeBase,
  readingTime,
  slugify,
  truncate,
  withBase,
  writeFile,
  xmlEscape,
} from './lib/utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const PAGES_DIR = path.join(ROOT, 'content', 'pages');
const SERIES_DIR = path.join(ROOT, 'content', 'series');
const ASSETS_DIR = path.join(ROOT, 'src', 'assets');
const KATEX_DIR = path.join(ROOT, 'vendor', 'katex');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const base = normalizeBase(config.basePath);
const buildDate = new Date().toISOString();
const buildDay = buildDate.slice(0, 10);

main();

function main() {
  validateConfig();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  if (fs.existsSync(ASSETS_DIR)) copyDir(ASSETS_DIR, path.join(DIST, 'assets'));
  installKatex();

  const series = loadSeries();
  const seriesBySlug = new Map(series.map((item) => [item.slug, item]));
  const posts = loadPosts(seriesBySlug);
  const pages = loadPages();
  const categories = buildCategories(posts);
  const tags = buildTags(posts);
  attachSeries(series, posts);

  if (posts.length === 0) {
    console.warn('  ! No published posts found.');
  }

  writeAll(posts, pages, series, categories, tags);
  writeSearchIndex(posts);
  writeSitemap(posts, pages, series, categories, tags);
  writeRobots();
  write404();
  writeLinks();
  if (config.customDomain) writeFile(path.join(DIST, 'CNAME'), `${config.customDomain}\n`);
  writeFile(path.join(DIST, '.nojekyll'), '');

  console.log(`\n  Built ${posts.length} posts, ${pages.length} pages, ${series.length} series, ${categories.length} categories, ${tags.length} tags.`);
  console.log(`  Output: ${path.relative(ROOT, DIST)}\\`);
  console.log(`  Local:  http://localhost:4173${base}\n`);
}

function installKatex() {
  const css = path.join(KATEX_DIR, 'katex.min.css');
  const fonts = path.join(KATEX_DIR, 'fonts');
  if (!fs.existsSync(css) || !fs.existsSync(fonts)) {
    throw new Error('KaTeX vendor files are missing. Restore vendor/katex/ before building.');
  }
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.copyFileSync(css, path.join(DIST, 'assets', 'katex.min.css'));
  copyDir(fonts, path.join(DIST, 'assets', 'fonts'));
}

function validateConfig() {
  for (const key of ['title', 'author', 'url', 'description']) {
    if (!config[key]) throw new Error(`site.config.json is missing "${key}".`);
  }
  if (!config.hero || !config.hero.title) throw new Error('site.config.json is missing the hero section.');
  if (!Array.isArray(config.nav)) throw new Error('site.config.json "nav" must be an array.');
  if (!Array.isArray(config.social)) config.social = [];
}

function parseFrontMatter(source, filePath) {
  const normalized = source.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    throw new Error(`Missing front matter in ${path.relative(ROOT, filePath)}. Start the file with ---.`);
  }
  const data = parseSimpleYaml(match[1], filePath);
  const body = normalized.slice(match[0].length).trim();
  return { data, body };
}

function parseSimpleYaml(source, filePath) {
  const data = {};
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const match = raw.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!match) {
      throw new Error(`Unsupported front matter line in ${path.relative(ROOT, filePath)}: ${raw}`);
    }
    const key = match[1];
    let value = (match[2] || '').trim();

    if (value === '|' || value === '>') {
      const block = [];
      while (i + 1 < lines.length && (/^\s{2,}/.test(lines[i + 1]) || !lines[i + 1].trim())) {
        i += 1;
        block.push(lines[i].replace(/^\s{2}/, ''));
      }
      value = value === '|' ? block.join('\n').trim() : block.join(' ').replace(/\s+/g, ' ').trim();
      data[key] = value;
      continue;
    }

    if (!value) {
      const items = [];
      while (i + 1 < lines.length) {
        const item = lines[i + 1].match(/^\s{2,}-\s+(.*)$/);
        if (!item) break;
        items.push(parseScalar(item[1]));
        i += 1;
      }
      data[key] = items;
      continue;
    }

    if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner ? splitInlineList(inner).map(parseScalar) : [];
      continue;
    }

    data[key] = parseScalar(value);
  }

  return data;
}

function splitInlineList(value) {
  const items = [];
  let current = '';
  let quote = '';
  for (const char of value) {
    if ((char === '"' || char === "'") && !quote) quote = char;
    else if (char === quote) quote = '';
    if (char === ',' && !quote) {
      items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function parseScalar(value) {
  const text = String(value).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text;
}

function assertDate(value, filePath) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error(`Invalid date "${value}" in ${path.relative(ROOT, filePath)}. Use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date "${value}" in ${path.relative(ROOT, filePath)}.`);
  }
  return String(value);
}

function loadSeries() {
  if (!fs.existsSync(SERIES_DIR)) return [];
  const series = [];
  const slugs = new Set();
  for (const file of fs.readdirSync(SERIES_DIR).filter((name) => name.endsWith('.md')).sort()) {
    const filePath = path.join(SERIES_DIR, file);
    const source = fs.readFileSync(filePath, 'utf8');
    const { data, body } = parseFrontMatter(source, filePath);
    if (data.draft === true) continue;
    if (!data.title) throw new Error(`Missing title in ${path.relative(ROOT, filePath)}.`);
    const slug = slugify(data.slug || file.replace(/\.md$/, ''), 'series');
    if (slugs.has(slug)) throw new Error(`Duplicate series slug: ${slug}`);
    slugs.add(slug);
    const { html: rawHtml } = renderMarkdown(body);
    series.push({
      type: 'series',
      slug,
      title: String(data.title),
      description: data.description ? String(data.description) : '',
      status: data.status ? String(data.status) : '连载中',
      target: Number(data.target) || 0,
      order: Number(data.order) || 0,
      cover: data.cover ? String(data.cover) : '',
      html: applyBaseToHtml(rawHtml, base),
      url: `/series/${encodeURIComponent(slug)}/`,
      outputPath: path.join('series', slug, 'index.html'),
      posts: [],
      count: 0,
    });
  }
  return series.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
}

function loadPosts(seriesBySlug) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const posts = [];
  const slugs = new Set();

  for (const file of fs.readdirSync(POSTS_DIR).filter((name) => name.endsWith('.md')).sort()) {
    const filePath = path.join(POSTS_DIR, file);
    const source = fs.readFileSync(filePath, 'utf8');
    const { data, body } = parseFrontMatter(source, filePath);
    if (data.draft === true) continue;
    if (!data.title) throw new Error(`Missing title in ${path.relative(ROOT, filePath)}.`);

    const date = assertDate(data.date, filePath);
    const slug = slugify(data.slug || file.replace(/\.md$/, ''), 'post');
    if (slugs.has(slug)) throw new Error(`Duplicate post slug: ${slug}`);
    slugs.add(slug);

    const rawTags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
    const tagNames = [...new Set(rawTags.map(String).map((tag) => tag.trim()).filter(Boolean))];
    const categoryName = data.category ? String(data.category).trim() : '未分类';
    const categorySlug = slugify(categoryName, 'category');
    const seriesSlug = data.series ? slugify(String(data.series), 'series') : '';
    const seriesDef = seriesSlug ? seriesBySlug.get(seriesSlug) : null;
    if (seriesSlug && !seriesDef) {
      throw new Error(`Unknown series "${data.series}" in ${path.relative(ROOT, filePath)}.`);
    }
    const seriesOrder = Number(data.seriesOrder) || 0;
    const { html: rawHtml, headings } = renderMarkdown(body);
    const html = applyBaseToHtml(rawHtml, base);
    const plainText = markdownToPlainText(body);
    const summary = data.summary ? String(data.summary) : truncate(plainText, 150);

    posts.push({
      type: 'post',
      slug,
      file: path.relative(ROOT, filePath),
      title: String(data.title),
      date,
      summary,
      cover: data.cover ? String(data.cover) : '',
      featured: data.featured === true,
      category: {
        name: categoryName,
        slug: categorySlug,
        url: `/categories/${encodeURIComponent(categorySlug)}/`,
      },
      series: seriesDef
        ? {
            slug: seriesDef.slug,
            title: seriesDef.title,
            url: seriesDef.url,
            order: seriesOrder,
            label: data.seriesLabel ? String(data.seriesLabel) : '',
          }
        : null,
      tags: tagNames.map((name) => ({ name, slug: slugify(name, 'tag'), url: `/tags/${encodeURIComponent(slugify(name, 'tag'))}/` })),
      url: `/posts/${encodeURIComponent(slug)}/`,
      outputPath: path.join('posts', slug, 'index.html'),
      html,
      headings,
      plainText,
      readingTime: readingTime(body),
    });
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'));
}

function attachSeries(series, posts) {
  for (const item of series) {
    item.posts = posts
      .filter((post) => post.series?.slug === item.slug)
      .sort((a, b) => (a.series.order || 9999) - (b.series.order || 9999) || a.date.localeCompare(b.date));
    item.posts.forEach((post, index) => {
      if (!post.series.label) post.series.label = `第 ${index + 1} 篇`;
    });
    item.count = item.posts.length;
    item.latest = item.posts[item.posts.length - 1] || null;
  }
}

function loadPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  const pages = [];
  const slugs = new Set();
  for (const file of fs.readdirSync(PAGES_DIR).filter((name) => name.endsWith('.md')).sort()) {
    const filePath = path.join(PAGES_DIR, file);
    const source = fs.readFileSync(filePath, 'utf8');
    const { data, body } = parseFrontMatter(source, filePath);
    if (data.draft === true) continue;
    if (!data.title) throw new Error(`Missing title in ${path.relative(ROOT, filePath)}.`);
    const slug = slugify(data.slug || file.replace(/\.md$/, ''), 'page');
    if (slugs.has(slug)) throw new Error(`Duplicate page slug: ${slug}`);
    slugs.add(slug);
    const { html: rawHtml } = renderMarkdown(body);
    const html = applyBaseToHtml(rawHtml, base);
    pages.push({
      type: 'page',
      slug,
      title: String(data.title),
      summary: data.summary ? String(data.summary) : '',
      eyebrow: data.eyebrow ? String(data.eyebrow) : '',
      html,
      url: `/${encodeURIComponent(slug)}/`,
      outputPath: path.join(slug, 'index.html'),
    });
  }
  return pages;
}

function buildCategories(posts) {
  const map = new Map();
  for (const post of posts) {
    const key = post.category.slug;
    if (!map.has(key)) {
      map.set(key, { ...post.category, posts: [], count: 0 });
    }
    const entry = map.get(key);
    entry.posts.push(post);
    entry.count += 1;
  }
  const order = Array.isArray(config.categoryOrder) ? config.categoryOrder.map((name) => slugify(name, 'category')) : [];
  return [...map.values()].sort((a, b) => {
    const ai = order.indexOf(a.slug);
    const bi = order.indexOf(b.slug);
    if (ai >= 0 || bi >= 0) {
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    }
    return b.count - a.count || a.name.localeCompare(b.name, 'zh-CN');
  });
}

function buildTags(posts) {
  const map = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!map.has(tag.slug)) map.set(tag.slug, { ...tag, posts: [], count: 0 });
      const entry = map.get(tag.slug);
      entry.posts.push(post);
      entry.count += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

function writeAll(posts, pages, series, categories, tags) {
  const latest = posts[0] || null;

  const home = renderHomePage(posts, series, categories, tags, latest);
  writeFile(path.join(DIST, 'index.html'), home);

  const postsIndex = renderLayoutFor({
    title: '文章',
    description: `所有文章，共 ${posts.length} 篇。`,
    currentPath: '/posts/',
    content: templates.renderPostsIndex({ config, base, posts }),
    canonical: absoluteUrl('/posts/', config),
  });
  writeFile(path.join(DIST, 'posts', 'index.html'), postsIndex);

  const archives = renderLayoutFor({
    title: '归档',
    description: '按年份排列的全部文章。',
    currentPath: '/archives/',
    content: templates.renderArchives({ config, base, posts }),
    canonical: absoluteUrl('/archives/', config),
  });
  writeFile(path.join(DIST, 'archives', 'index.html'), archives);

  const tagIndex = renderLayoutFor({
    title: '标签',
    description: '按主题浏览所有文章。',
    currentPath: '/tags/',
    content: templates.renderTags({ config, base, tags }),
    canonical: absoluteUrl('/tags/', config),
  });
  writeFile(path.join(DIST, 'tags', 'index.html'), tagIndex);

  const categoryIndex = renderLayoutFor({
    title: '分类',
    description: '按稳定的领域分类浏览文章。',
    currentPath: '/categories/',
    content: templates.renderCategories({ config, base, categories }),
    canonical: absoluteUrl('/categories/', config),
  });
  writeFile(path.join(DIST, 'categories', 'index.html'), categoryIndex);

  const seriesIndex = renderLayoutFor({
    title: '专栏',
    description: '长期更新的文章集。',
    currentPath: '/series/',
    content: templates.renderSeriesIndex({ config, base, series }),
    canonical: absoluteUrl('/series/', config),
  });
  writeFile(path.join(DIST, 'series', 'index.html'), seriesIndex);

  for (const item of series) {
    const seriesPage = renderLayoutFor({
      title: item.title,
      description: item.description || `专栏：${item.title}`,
      currentPath: item.url,
      content: templates.renderSeries({ config, base, series: item }),
      canonical: absoluteUrl(item.url, config),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: item.title,
        description: item.description,
        url: absoluteUrl(item.url, config),
      },
    });
    writeFile(path.join(DIST, item.outputPath), seriesPage);
  }

  const search = renderLayoutFor({
    title: '搜索',
    description: '搜索这个博客里的文章。',
    currentPath: '/search/',
    content: templates.renderSearchPage({ config, base, posts }),
    canonical: absoluteUrl('/search/', config),
    noindex: true,
  });
  writeFile(path.join(DIST, 'search', 'index.html'), search);

  for (const post of posts) {
    const index = posts.indexOf(post);
    const prev = posts[index + 1] || null;
    const next = posts[index - 1] || null;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.summary,
      datePublished: post.date,
      dateModified: post.date,
      author: { '@type': 'Person', name: config.author },
      publisher: { '@type': 'Person', name: config.author },
      mainEntityOfPage: absoluteUrl(post.url, config),
      url: absoluteUrl(post.url, config),
      image: post.cover ? absoluteUrl(post.cover, config) : undefined,
      articleSection: post.category.name,
      keywords: post.tags.map((tag) => tag.name).join(', '),
      inLanguage: config.lang || 'zh-CN',
    };
    const html = renderLayoutFor({
      title: post.title,
      description: post.summary,
      currentPath: post.url,
      content: templates.renderPost({ config, base, post, prev, next }),
      canonical: absoluteUrl(post.url, config),
      ogType: 'article',
      ogImage: post.cover ? absoluteUrl(post.cover, config) : undefined,
      bodyClass: 'is-post',
      jsonLd,
    });
    writeFile(path.join(DIST, post.outputPath), html);
  }

  for (const tag of tags) {
    const html = renderLayoutFor({
      title: `标签：${tag.name}`,
      description: `所有标记为「${tag.name}」的文章。`,
      currentPath: tag.url,
      content: templates.renderTag({ config, base, tag, posts: tag.posts }),
      canonical: absoluteUrl(tag.url, config),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `标签：${tag.name}`,
        url: absoluteUrl(tag.url, config),
      },
    });
    writeFile(path.join(DIST, 'tags', tag.slug, 'index.html'), html);
  }

  for (const category of categories) {
    const html = renderLayoutFor({
      title: `分类：${category.name}`,
      description: `${category.name} 分类下的全部文章。`,
      currentPath: category.url,
      content: templates.renderCategory({ config, base, category, posts: category.posts }),
      canonical: absoluteUrl(category.url, config),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `分类：${category.name}`,
        url: absoluteUrl(category.url, config),
      },
    });
    writeFile(path.join(DIST, 'categories', category.slug, 'index.html'), html);
  }

  for (const page of pages) {
    const html = renderLayoutFor({
      title: page.title,
      description: page.summary || config.description,
      currentPath: page.url,
      content: templates.renderPage({ config, base, page }),
      canonical: absoluteUrl(page.url, config),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: page.title,
        url: absoluteUrl(page.url, config),
        description: page.summary || config.description,
      },
    });
    writeFile(path.join(DIST, page.outputPath), html);
  }
}

function renderHomePage(posts, series, categories, tags, latest) {
  const heroFormula = config.hero.formula ? renderMath(config.hero.formula, true) : '';
  return templates.renderLayout({
    config,
    base,
    title: '',
    description: config.description,
    content: templates.renderHome({ config, base, posts, series, categories, tags, latest, heroFormula }),
    currentPath: '/',
    canonical: absoluteUrl('/', config),
    isHome: true,
    bodyClass: 'template-home',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.title,
      url: absoluteUrl('/', config),
      description: config.description,
      inLanguage: config.lang || 'zh-CN',
      author: { '@type': 'Person', name: config.author },
    },
  });
}

function renderLayoutFor(options) {
  return templates.renderLayout({ config, base, ...options });
}

function writeSearchIndex(posts) {
  const index = posts.map((post) => ({
    title: post.title,
    url: withBase(post.url, base),
    date: post.date,
    dateLabel: formatDate(post.date, 'short'),
    category: post.category.name,
    series: post.series?.title || '',
    tags: post.tags.map((tag) => tag.name),
    summary: post.summary,
    content: truncate(post.plainText, 5000),
  }));
  writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(index));
}

function writeSitemap(posts, pages, series, categories, tags) {
  const urls = [
    { loc: absoluteUrl('/', config), lastmod: posts[0]?.date || buildDay, priority: '1.0' },
    { loc: absoluteUrl('/posts/', config), lastmod: posts[0]?.date || buildDay, priority: '0.9' },
    { loc: absoluteUrl('/series/', config), lastmod: posts[0]?.date || buildDay, priority: '0.7' },
    { loc: absoluteUrl('/archives/', config), lastmod: posts[0]?.date || buildDay, priority: '0.7' },
    { loc: absoluteUrl('/categories/', config), lastmod: posts[0]?.date || buildDay, priority: '0.7' },
    { loc: absoluteUrl('/tags/', config), lastmod: posts[0]?.date || buildDay, priority: '0.6' },
    { loc: absoluteUrl('/links/', config), lastmod: buildDay, priority: '0.5' },
    ...posts.map((post) => ({ loc: absoluteUrl(post.url, config), lastmod: post.date, priority: '0.8' })),
    ...series.map((item) => ({ loc: absoluteUrl(item.url, config), lastmod: item.posts[0]?.date || buildDay, priority: '0.6' })),
    ...categories.map((category) => ({ loc: absoluteUrl(category.url, config), lastmod: category.posts[0]?.date || buildDay, priority: '0.6' })),
    ...tags.map((tag) => ({ loc: absoluteUrl(tag.url, config), lastmod: tag.posts[0]?.date || buildDay, priority: '0.5' })),
    ...pages.map((page) => ({ loc: absoluteUrl(page.url, config), lastmod: buildDay, priority: '0.6' })),
  ];
  const body = urls
    .map(
      (url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.priority === '1.0' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
    )
    .join('\n');
  writeFile(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  );
}

function writeRobots() {
  const sitemap = absoluteUrl('/sitemap.xml', config);
  writeFile(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`,
  );
}

function write404() {
  const html = renderLayoutFor({
    title: '页面走丢了',
    description: '404 — 页面不存在。',
    currentPath: '/404.html',
    content: templates.render404({ config, base }),
    canonical: absoluteUrl('/404.html', config),
    noindex: true,
  });
  writeFile(path.join(DIST, '404.html'), html);
}

function writeLinks() {
  const html = renderLayoutFor({
    title: '友情链接',
    description: '朋友的站点，以及值得绕路去看看的地方。',
    currentPath: '/links/',
    content: templates.renderLinks({ config, base }),
    canonical: absoluteUrl('/links/', config),
  });
  writeFile(path.join(DIST, 'links', 'index.html'), html);
}
