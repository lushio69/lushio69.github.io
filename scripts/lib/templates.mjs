import { escapeAttr, escapeHtml, formatDate, truncate, withBase } from './utils.mjs';

const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function activeNav(currentPath, url) {
  if (url === '/') return currentPath === '/';
  return currentPath === url || currentPath.startsWith(url);
}

function navLinks(config, currentPath, base, className = '') {
  return config.nav
    .map((item) => {
      const active = activeNav(currentPath, item.url);
      return `<a class="${className}${active ? ' is-active' : ''}" href="${withBase(item.url, base)}"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
}

function socialLinks(config, base, className = '') {
  return config.social
    .map((item) => {
      const external = /^https?:\/\//i.test(item.url);
      const href = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(item.url) ? item.url : withBase(item.url, base);
      return `<a class="${className}" href="${escapeAttr(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(item.label)}${external ? '<span aria-hidden="true"> ↗</span>' : ''}</a>`;
    })
    .join('');
}

function postTags(post, base) {
  return post.tags
    .map(
      (tag) =>
        `<a class="tag" href="${withBase(tag.url, base)}">${escapeHtml(tag.name)}</a>`,
    )
    .join('');
}

function coverFor(post, base) {
  if (!post.cover) return '';
  return `<img src="${escapeAttr(withBase(post.cover, base))}" alt="" loading="${post.coverLoading || 'lazy'}" decoding="async">`;
}

export function renderLayout({
  config,
  base,
  title,
  description,
  content,
  currentPath,
  bodyClass = '',
  ogType = 'website',
  ogImage,
  canonical,
  jsonLd,
  noindex = false,
  isHome = false,
}) {
  const fullTitle = title ? `${title} — ${config.title}` : `${config.title} — ${config.tagline}`;
  const pageDescription = description || config.description;
  const canonicalUrl = canonical || config.url;
  const image = ogImage || `${config.url.replace(/\/$/, '')}${withBase('/assets/og-default.png', base)}`;
  const nav = navLinks(config, currentPath, base);
  const year = new Date().getFullYear();
  const startYear = Number(config.startYear) || year;
  const copyright = startYear < year ? `${startYear}–${year}` : `${year}`;

  return `<!doctype html>
<html lang="${escapeAttr(config.lang || 'zh-CN')}" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeAttr(pageDescription)}">
  <meta name="author" content="${escapeAttr(config.author)}">
  <meta name="site-base" content="${escapeAttr(base)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f1f4ee" id="theme-color">
  ${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow">'}
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="icon" href="${withBase('/assets/favicon.svg', base)}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${withBase('/assets/apple-touch-icon.png', base)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeAttr(config.title)} · RSS" href="${withBase('/feed.xml', base)}">
  <link rel="stylesheet" href="${withBase('/assets/styles.css', base)}">
  <link rel="stylesheet" href="${withBase('/assets/katex.min.css', base)}">
  <meta property="og:type" content="${escapeAttr(ogType)}">
  <meta property="og:site_name" content="${escapeAttr(config.title)}">
  <meta property="og:title" content="${escapeAttr(title || config.title)}">
  <meta property="og:description" content="${escapeAttr(pageDescription)}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta property="og:image" content="${escapeAttr(image)}">
  <meta property="og:locale" content="${escapeAttr(config.locale || 'zh_CN')}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title || config.title)}">
  <meta name="twitter:description" content="${escapeAttr(pageDescription)}">
  <meta name="twitter:image" content="${escapeAttr(image)}">
  <script>
    (function () {
      try {
        var saved = localStorage.getItem('lushio-theme');
        var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
      } catch (error) {}
    })();
  </script>
  ${jsonLd ? `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>` : ''}
</head>
<body class="${escapeAttr(bodyClass)}" id="top">
  <a class="skip-link" href="#main">跳到正文</a>
  <header class="site-header" id="site-header">
    <div class="header-inner">
      <a class="brand" href="${withBase('/', base)}" aria-label="${escapeAttr(config.title)} 首页">
        <span class="brand-mark" aria-hidden="true">${escapeHtml(config.mark || 'L')}</span>
        <span class="brand-text">
          <span class="brand-name">${escapeHtml(config.wordmark || config.title)}</span>
          <span class="brand-sub">math notes</span>
        </span>
      </a>
      <nav class="site-nav" id="site-nav" aria-label="主导航">
        ${nav}
      </nav>
      <div class="header-actions">
        <button class="icon-btn" type="button" data-search-open aria-label="搜索文章" title="搜索 (Ctrl+K)">
          ${ICONS.search}
        </button>
        <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="切换明暗主题" title="切换主题">
          ${ICONS.sun}${ICONS.moon}
        </button>
        <button class="icon-btn menu-toggle" type="button" data-menu-toggle aria-label="打开菜单" aria-controls="site-nav" aria-expanded="false">
          <span class="menu-open">${ICONS.menu}</span><span class="menu-close">${ICONS.close}</span>
        </button>
      </div>
    </div>
    ${bodyClass.includes('is-post') ? '<div class="reading-progress" data-reading-progress aria-hidden="true"><span></span></div>' : ''}
  </header>

  <main id="main">
    ${content}
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a class="brand brand-footer" href="${withBase('/', base)}">
          <span class="brand-mark" aria-hidden="true">${escapeHtml(config.mark || 'L')}</span>
          <span class="brand-name">${escapeHtml(config.wordmark || config.title)}</span>
        </a>
        <p>${escapeHtml(config.tagline)}</p>
        <p class="footer-note">把每一步写清楚。</p>
      </div>
      <div class="footer-column">
        <p class="footer-label">浏览</p>
        ${navLinks(config, currentPath, base, 'footer-link')}
        <a class="footer-link" href="${withBase('/search/', base)}">搜索</a>
      </div>
      <div class="footer-column">
        <p class="footer-label">连接</p>
        ${socialLinks(config, base, 'footer-link')}
        <a class="footer-link" href="${withBase('/subscribe/', base)}">订阅指南</a>
        <a class="footer-link" href="${withBase('/feed.xml', base)}">RSS 订阅</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>© ${copyright} ${escapeHtml(config.author)}</p>
      <p class="footer-motto">Defined carefully, proved slowly.</p>
      <a href="#top" class="back-top">回到顶部 <span aria-hidden="true">↑</span></a>
    </div>
  </footer>

  <dialog class="search-dialog" id="search-dialog" aria-labelledby="search-title">
    <div class="search-shell">
      <div class="search-head">
        <span class="search-icon">${ICONS.search}</span>
        <label class="sr-only" for="search-input" id="search-title">搜索文章</label>
        <input id="search-input" type="search" placeholder="搜索文章、标签或关键词…" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
        <button class="icon-btn search-close" type="button" data-search-close aria-label="关闭搜索">${ICONS.close}</button>
      </div>
      <div class="search-results" data-search-results>
        <p class="search-hint">输入关键词，寻找散落在这里的句子。</p>
      </div>
      <div class="search-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开</span>
        <span class="search-count" data-search-count></span>
      </div>
    </div>
  </dialog>

  <script src="${withBase('/assets/app.js', base)}" defer></script>
</body>
</html>`;
}

export function renderHome({ config, base, posts, tags, categories, latest, heroFormula }) {
  const gridPosts = posts.filter((post) => post.slug !== latest?.slug).slice(0, 6);
  const feature = latest
    ? `<a class="hero-feature" href="${withBase(latest.url, base)}" aria-label="阅读最新文章：${escapeAttr(latest.title)}">
        <div class="feature-art">
          ${coverFor({ ...latest, coverLoading: 'eager' }, base)}
          <span class="feature-stamp">NO. ${String(posts.length).padStart(2, '0')}</span>
        </div>
        <div class="feature-copy">
          <div class="feature-meta"><span>${escapeHtml(latest.category.name)} · 最新</span><time datetime="${latest.date}">${formatDate(latest.date, 'short')}</time></div>
          <h2>${escapeHtml(latest.title)}</h2>
          <p>${escapeHtml(truncate(latest.summary, 76))}</p>
          <span class="text-link">阅读全文 ${ICONS.arrow}</span>
        </div>
      </a>`
    : `<div class="hero-feature is-empty"><p>第一篇文章，正在路上。</p></div>`;

  const cards = gridPosts.map((post, index) => renderPostCard(post, base, index + 1)).join('');

  const categoryCards = categories
    .map(
      (category, index) => `<a class="category-card" href="${withBase(category.url, base)}">
        <span class="category-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="category-card-body">
          <strong>${escapeHtml(category.name)}</strong>
          <small>${category.count} 篇文章</small>
        </span>
        <span class="category-card-arrow" aria-hidden="true">${ICONS.arrowUpRight}</span>
      </a>`,
    )
    .join('');

  const tagCloud = tags
    .slice(0, 12)
    .map(
      (tag) =>
        `<a class="tag-pill" href="${withBase(tag.url, base)}"><span>${escapeHtml(tag.name)}</span><sup>${tag.count}</sup></a>`,
    )
    .join('');

  const now = config.now
    ? `<div class="now-card">
        <div class="now-head"><span class="live-dot" aria-hidden="true"></span><span>${escapeHtml(config.now.title || '此刻')}</span><span class="now-line"></span></div>
        <dl>${config.now.items.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl>
      </div>`
    : '';

  return `  <section class="hero container">
      <div class="hero-copy">
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>${escapeHtml(config.hero.eyebrow)}</p>
        <h1>${escapeHtml(config.hero.title)}<br><em>${escapeHtml(config.hero.titleAccent)}</em></h1>
        <p class="hero-intro">${escapeHtml(config.hero.intro)}</p>
        <div class="hero-actions">
          <a class="button" href="${withBase('/posts/', base)}">开始阅读 ${ICONS.arrow}</a>
          <a class="text-link" href="${withBase('/about/', base)}">关于这个博客 ${ICONS.arrowUpRight}</a>
        </div>
        ${heroFormula ? `<div class="hero-formula"><span class="formula-label">a quiet identity</span>${heroFormula}</div>` : ''}
        <div class="hero-foot">
          <span>${posts.length} 篇文章</span>
          <span>${categories.length} 个分类</span>
          <span>${tags.length} 个标签</span>
        </div>
      </div>
      <div class="hero-side">
        ${feature}
        ${now}
      </div>
    </section>

    <section class="section container">
      <div class="section-head">
        <div>
          <p class="section-kicker">01 / Recent notes</p>
          <h2>最近写下的</h2>
        </div>
        <a class="section-more" href="${withBase('/posts/', base)}">全部文章 <span aria-hidden="true">→</span></a>
      </div>
      <div class="post-grid">
        ${cards || '<p class="empty-state">还没有更多文章。去写下一篇吧。</p>'}
      </div>
    </section>

    <section class="section container">
      <div class="section-head">
        <div>
          <p class="section-kicker">02 / Categories</p>
          <h2>按分类阅读</h2>
        </div>
        <a class="section-more" href="${withBase('/categories/', base)}">全部分类 <span aria-hidden="true">→</span></a>
      </div>
      <div class="category-grid">${categoryCards || '<p class="empty-state">还没有分类。</p>'}</div>
    </section>

    <section class="section container">
      <div class="tag-panel">
        <div class="tag-panel-copy">
          <p class="section-kicker">03 / Tags</p>
          <h2>标签索引</h2>
          <p>分类是固定的书架；标签是可以同时出现在很多书架上的关键词。</p>
          <a class="text-link" href="${withBase('/tags/', base)}">查看全部标签 ${ICONS.arrow}</a>
        </div>
        <div class="tag-cloud">${tagCloud}</div>
      </div>
    </section>

    <section class="section container">
      <div class="about-strip">
        <p class="about-quote">“证明不是装饰，<br>而是让直觉接受检查。”</p>
        <div class="about-strip-body">
          <p>${escapeHtml(config.bio)}</p>
          <a class="text-link" href="${withBase('/about/', base)}">继续了解我 ${ICONS.arrow}</a>
        </div>
      </div>
    </section>`;
}

export function renderPostCard(post, base, index) {
  return `<article class="post-card" style="--i:${index}">
    <a class="card-media" href="${withBase(post.url, base)}" aria-label="阅读：${escapeAttr(post.title)}">
      ${coverFor(post, base)}
      <span class="card-category">${escapeHtml(post.category.name)}</span>
      <span class="card-number">${String(index).padStart(2, '0')}</span>
    </a>
    <div class="card-body">
      <div class="card-meta">
        <time datetime="${post.date}">${formatDate(post.date, 'short')}</time>
        <span class="dot" aria-hidden="true">·</span>
        <span>${post.readingTime} 分钟</span>
      </div>
      <h3><a class="card-title-link" href="${withBase(post.url, base)}">${escapeHtml(post.title)}</a></h3>
      <p>${escapeHtml(truncate(post.summary, 88))}</p>
      <div class="card-foot">
        <div class="tag-row">${postTags(post, base)}</div>
        <a class="card-arrow" href="${withBase(post.url, base)}" aria-label="阅读全文：${escapeAttr(post.title)}">${ICONS.arrowUpRight}</a>
      </div>
    </div>
  </article>`;
}

export function renderPostsIndex({ config, base, posts }) {
  const cards = posts.map((post, index) => renderPostCard(post, base, index + 1)).join('');
  return `  <section class="page-hero container">
      <p class="eyebrow">All notes · ${posts.length}</p>
      <h1>写过的，<em>都在这里。</em></h1>
      <p class="page-intro">从最近的一篇开始，或者随便挑一个顺眼的标题。写作是线性的，阅读不必是。</p>
    </section>
    <section class="container section section-tight">
      <div class="post-grid post-grid-all">${cards || '<p class="empty-state">还没有文章。</p>'}</div>
    </section>`;
}

export function renderArchives({ config, base, posts }) {
  const years = new Map();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(post);
  }
  const groups = [...years.entries()]
    .map(
      ([year, yearPosts]) => `<section class="archive-year">
        <div class="archive-year-label">
          <h2>${year}</h2>
          <span>${yearPosts.length} 篇</span>
        </div>
        <div class="archive-list">
          ${yearPosts
            .map(
              (post) => `<a class="archive-item" href="${withBase(post.url, base)}">
                <time datetime="${post.date}">${formatDate(post.date, 'month-day')}</time>
                <span class="archive-title">${escapeHtml(post.title)}</span>
                <span class="archive-tags">${escapeHtml(post.category.name)}${post.tags.length ? ` · ${post.tags.map((tag) => escapeHtml(tag.name)).join(' / ')}` : ''}</span>
                <span class="archive-arrow" aria-hidden="true">↗</span>
              </a>`,
            )
            .join('')}
        </div>
      </section>`,
    )
    .join('');

  return `  <section class="page-hero container">
      <p class="eyebrow">Archive · ${posts.length}</p>
      <h1>时间留下的<em>折痕。</em></h1>
      <p class="page-intro">按年份排列的全部文字。有些想法已经改变，有些仍然成立，这大概就是记录的意义。</p>
    </section>
    <section class="container section section-tight archive">${groups || '<p class="empty-state">还没有文章。</p>'}</section>`;
}

export function renderPost({ config, base, post, prev, next }) {
  const toc =
    post.headings.length > 1
      ? `<aside class="post-aside">
          <div class="toc">
            <p class="toc-label">目录</p>
            <nav aria-label="文章目录">
              ${post.headings
                .map(
                  (heading) =>
                    `<a class="toc-link toc-level-${heading.level}" href="#${escapeAttr(heading.id)}">${escapeHtml(heading.text)}</a>`,
                )
                .join('')}
            </nav>
          </div>
        </aside>`
      : '';

  const pager = prev || next
    ? `<nav class="post-pager" aria-label="上一篇和下一篇">
        ${prev ? `<a class="pager-card pager-prev" href="${withBase(prev.url, base)}"><span class="pager-label">← 上一篇</span><strong>${escapeHtml(prev.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="pager-card pager-next" href="${withBase(next.url, base)}"><span class="pager-label">下一篇 →</span><strong>${escapeHtml(next.title)}</strong></a>` : '<span></span>'}
      </nav>`
    : '';

  return `  <article class="post container template-post">
      <header class="post-header">
        <a class="back-link" href="${withBase('/posts/', base)}">← 所有文章</a>
        <div class="post-heading">
          <div class="post-meta">
            <a class="post-category" href="${withBase(post.category.url, base)}">${escapeHtml(post.category.name)}</a>
            <span class="dot" aria-hidden="true">·</span>
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <span class="dot" aria-hidden="true">·</span>
            <span>${post.readingTime} 分钟阅读</span>
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          ${post.summary ? `<p class="post-dek">${escapeHtml(post.summary)}</p>` : ''}
        </div>
      </header>

      ${post.cover ? `<figure class="post-cover">${coverFor({ ...post, coverLoading: 'eager' }, base)}</figure>` : ''}

      <div class="post-layout">
        <div class="prose" data-prose>
          ${post.html}
        </div>
        ${toc}
      </div>

      <footer class="post-footer">
        <div class="post-end-mark" aria-hidden="true">∎</div>
        <p>证毕。谢谢你读到这里。</p>
        <div class="tag-row post-tags">${postTags(post, base)}</div>
        <a class="text-link" href="${withBase('/posts/', base)}">继续翻阅其他文章 ${ICONS.arrow}</a>
      </footer>
      ${pager}
      ${renderComments(config, base)}
    </article>`;
}

export function renderTags({ config, base, tags }) {
  const cards = tags
    .map(
      (tag, index) => `<a class="tag-card" href="${withBase(tag.url, base)}">
        <span class="tag-card-index">${String(index + 1).padStart(2, '0')}</span>
        <h2>${escapeHtml(tag.name)}</h2>
        <p>${tag.count} 篇文章</p>
        <span class="tag-card-arrow" aria-hidden="true">↗</span>
      </a>`,
    )
    .join('');

  return `  <section class="page-hero container">
      <p class="eyebrow">Tags · ${tags.length}</p>
      <h1>散落的<em>关键词。</em></h1>
      <p class="page-intro">标签不隶属于某一个分类：同一个“直觉”可以出现在数学分析、线性代数和概率论里。它们负责把跨书架的文章连在一起。</p>
    </section>
    <section class="container section section-tight">
      <div class="tag-grid">${cards || '<p class="empty-state">还没有标签。</p>'}</div>
    </section>`;
}

export function renderTag({ config, base, tag, posts }) {
  const cards = posts.map((post, index) => renderPostCard(post, base, index + 1)).join('');
  return `  <section class="page-hero container tag-page-hero">
      <a class="back-link" href="${withBase('/tags/', base)}">← 所有标签</a>
      <p class="eyebrow">Topic · ${tag.count} notes</p>
      <h1>关于<em>「${escapeHtml(tag.name)}」</em></h1>
      <p class="page-intro">${escapeHtml(tag.description || `所有标记为「${tag.name}」的文字，按时间从新到旧排列。`)}</p>
    </section>
    <section class="container section section-tight">
      <div class="post-grid post-grid-all">${cards}</div>
    </section>`;
}

export function renderCategories({ config, base, categories }) {
  const cards = categories
    .map(
      (category, index) => `<a class="category-card category-card-large" href="${withBase(category.url, base)}">
        <span class="category-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="category-card-body">
          <strong>${escapeHtml(category.name)}</strong>
          <small>${category.count} 篇文章 · 最近 ${formatDate(category.posts[0].date, 'short')}</small>
        </span>
        <span class="category-card-arrow" aria-hidden="true">${ICONS.arrowUpRight}</span>
      </a>`,
    )
    .join('');

  return `  <section class="page-hero container">
      <p class="eyebrow">Categories · ${categories.length}</p>
      <h1>固定的<em>书架。</em></h1>
      <p class="page-intro">分类是稳定的书架：每篇文章只归入一个分类。标签则是可以同时贴在很多书架上的关键词——两者各管一件事，不必混在一起。</p>
    </section>
    <section class="container section section-tight">
      <div class="category-grid category-grid-page">${cards || '<p class="empty-state">还没有分类。</p>'}</div>
      <div class="category-note">
        <p><strong>分类</strong> 用来回答「这篇文章属于哪个领域」；<strong>标签</strong> 用来回答「它还和什么有关」。</p>
        <a class="text-link" href="${withBase('/tags/', base)}">去看标签索引 ${ICONS.arrow}</a>
      </div>
    </section>`;
}

export function renderCategory({ config, base, category, posts }) {
  const cards = posts.map((post, index) => renderPostCard(post, base, index + 1)).join('');
  return `  <section class="page-hero container category-page-hero">
      <a class="back-link" href="${withBase('/categories/', base)}">← 所有分类</a>
      <p class="eyebrow">Category · ${category.count} notes</p>
      <h1><em>${escapeHtml(category.name)}</em></h1>
      <p class="page-intro">${escapeHtml(category.description || `归在这个分类下的全部文章，按时间从新到旧排列。`)}</p>
    </section>
    <section class="container section section-tight">
      <div class="post-grid post-grid-all">${cards}</div>
    </section>`;
}

function renderComments(config, base) {
  const comments = config.comments || {};
  const provider = String(comments.provider || 'none').toLowerCase();
  if (provider === 'none' || !comments.repo) return '';

  let widget = '';
  if (provider === 'utterances') {
    widget = `<script src="https://utteranc.es/client.js"
        repo="${escapeAttr(comments.repo)}"
        issue-term="${escapeAttr(comments.issueTerm || 'pathname')}"
        ${comments.label ? `label="${escapeAttr(comments.label)}"` : ''}
        theme="github-light"
        crossorigin="anonymous"
        async></script>`;
  } else if (provider === 'giscus') {
    if (!comments.repoId || !comments.categoryId) return '';
    widget = `<script src="https://giscus.app/client.js"
        data-repo="${escapeAttr(comments.repo)}"
        data-repo-id="${escapeAttr(comments.repoId)}"
        data-category="${escapeAttr(comments.category || 'Announcements')}"
        data-category-id="${escapeAttr(comments.categoryId)}"
        data-mapping="${escapeAttr(comments.mapping || 'pathname')}"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="light"
        data-lang="zh-CN"
        crossorigin="anonymous"
        async></script>`;
  } else {
    return '';
  }

  return `<section class="comments" id="comments" data-comments data-provider="${escapeAttr(provider)}">
      <div class="comments-head">
        <div>
          <p class="section-kicker">Discussion</p>
          <h2>讨论</h2>
        </div>
        <p>评论由 GitHub Issues 托管。登录 GitHub 后即可留言，不需要额外注册。</p>
      </div>
      <div class="comments-body">${widget}<noscript><p>评论区需要启用 JavaScript。</p></noscript></div>
    </section>`;
}

export function renderSubscribe({ config, base, feedUrl }) {
  const encoded = encodeURIComponent(feedUrl);
  const readers = [
    { name: 'Feedly', note: '网页 / iOS / Android', url: `https://feedly.com/i/subscription/feed/${encoded}` },
    { name: 'Inoreader', note: '网页 / iOS / Android', url: `https://www.inoreader.com/?add_feed=${encoded}` },
    { name: 'NetNewsWire', note: 'macOS / iOS，开源免费', url: 'https://netnewswire.com/' },
    { name: 'Thunderbird', note: 'Windows / macOS / Linux', url: 'https://www.thunderbird.net/' },
    { name: 'Reeder', note: 'macOS / iOS', url: 'https://reederapp.com/' },
    { name: 'FreshRSS', note: '想自己托管时使用', url: 'https://freshrss.org/' },
  ];

  return `  <section class="page-hero container subscribe-hero">
      <p class="eyebrow">Subscribe · RSS</p>
      <h1>让新文章<em>自己来找你。</em></h1>
      <p class="page-intro">不需要邮箱，不需要账号，也不会被推荐算法打断。把下面这个地址交给任意一个 RSS 阅读器，它就会定期来看看有没有新文章。</p>
      <div class="feed-box">
        <span class="feed-box-label">RSS 地址</span>
        <code>${escapeHtml(feedUrl)}</code>
        <button class="button feed-copy" type="button" data-copy-feed data-copy-value="${escapeAttr(feedUrl)}">复制订阅地址</button>
      </div>
    </section>

    <section class="container section section-tight subscribe-content">
      <div class="subscribe-main">
        <div class="subscribe-block">
          <p class="section-kicker">01 / What is RSS</p>
          <h2>RSS 到底是什么？</h2>
          <p>RSS 是一个固定网址，里面是一份机器可读的文章清单。你把这个网址添加进阅读器，阅读器就会隔一段时间来问一句：“有新文章吗？”有新内容，它就放进你的列表。</p>
          <p>可以把它理解成一种<strong>不依赖平台的订阅方式</strong>：没有邮件地址，没有推送权限，也不会因为某个 App 改变算法而错过更新。订阅关系只发生在你和这个网址之间。</p>
        </div>

        <div class="subscribe-block">
          <p class="section-kicker">02 / How to subscribe</p>
          <h2>三步开始订阅</h2>
          <ol class="subscribe-steps">
            <li><span>1</span><div><strong>复制上面的 RSS 地址</strong><p>也就是 <code>${escapeHtml(feedUrl)}</code>。</p></div></li>
            <li><span>2</span><div><strong>打开一个 RSS 阅读器</strong><p>网页版可以直接用 Feedly 或 Inoreader；桌面端可以选 NetNewsWire、Thunderbird；手机端也有 Reeder 等选择。</p></div></li>
            <li><span>3</span><div><strong>粘贴地址，添加订阅</strong><p>大多数阅读器都有“Add feed / 添加订阅源”按钮，把地址粘贴进去即可。之后新文章会自动出现。</p></div></li>
          </ol>
        </div>

        <div class="subscribe-block">
          <p class="section-kicker">03 / Under the hood</p>
          <h2>这个博客的 RSS 是怎么来的？</h2>
          <p>每次发布时，构建脚本会把所有文章写进 <code>/feed.xml</code>，里面包含标题、日期、分类、标签、摘要和原文链接。GitHub Pages 只是把这个 XML 文件当作静态资源提供出去，没有数据库，也没有订阅服务器。</p>
          <p>阅读器会保存文章的标题和摘要；想读完整正文和公式时，点一下标题就会回到网站上。这样公式排版始终和站内一致，也不会在阅读器里变成一堆乱码。</p>
          <p>读者的阅读器定期请求这个文件；只要文件更新了，订阅者就能看到新文章。就这么简单。</p>
          <p class="subscribe-tip">直接在浏览器里打开 feed 地址时，你看到的是一段 XML 源码，而不是漂亮的网页——这是正常的。把地址交给阅读器就好。</p>
        </div>
      </div>

      <aside class="reader-list">
        <p class="section-kicker">Choose a reader</p>
        <h2>常用阅读器</h2>
        ${readers
          .map(
            (reader) => `<a href="${escapeAttr(reader.url)}" target="_blank" rel="noopener noreferrer">
              <span>${escapeHtml(reader.name)}</span>
              <small>${escapeHtml(reader.note)}</small>
            </a>`,
          )
          .join('')}
        <a class="reader-raw" href="${withBase('/feed.xml', base)}" target="_blank" rel="noopener">直接查看 feed.xml ↗</a>
      </aside>
    </section>`;
}


export function renderSearchPage({ config, base, posts }) {
  return `  <section class="page-hero container search-page-hero">
      <p class="eyebrow">Search · ${posts.length}</p>
      <h1>找一个<em>词。</em></h1>
      <p class="page-intro">标题、分类、标签、正文都可以搜。输入一个你记得的片段，剩下的交给这里。</p>
      <div class="page-search">
        <span class="search-icon">${ICONS.search}</span>
        <label class="sr-only" for="page-search-input">搜索文章</label>
        <input id="page-search-input" type="search" placeholder="例如：极限、特征值、贝叶斯…" autocomplete="off">
      </div>
      <div class="page-search-results" data-page-search-results>
        <p class="search-hint">输入关键词开始搜索。</p>
      </div>
    </section>`;
}

export function renderPage({ config, base, page }) {
  return `  <article class="page container">
      <header class="page-hero page-hero-inner">
        ${page.eyebrow ? `<p class="eyebrow">${escapeHtml(page.eyebrow)}</p>` : ''}
        <h1>${escapeHtml(page.title)}</h1>
        ${page.summary ? `<p class="page-intro">${escapeHtml(page.summary)}</p>` : ''}
      </header>
      <div class="prose page-prose">
        ${page.html}
      </div>
      <div class="page-signoff">
        <span class="brand-mark" aria-hidden="true">${escapeHtml(config.mark || 'L')}</span>
        <p>${escapeHtml(config.author)}<br><span>${escapeHtml(config.tagline)}</span></p>
      </div>
    </article>`;
}

export function render404({ config, base }) {
  return `  <section class="not-found container">
      <p class="eyebrow">404 · Undefined</p>
      <p class="not-found-number" aria-hidden="true">404</p>
      <h1>这一页，<em>不在定义域里。</em></h1>
      <p>可能是链接变了，也可能它从来没有存在过。不如回到首页，重新开始。</p>
      <a class="button" href="${withBase('/', base)}">回到首页 ${ICONS.arrow}</a>
    </section>`;
}
