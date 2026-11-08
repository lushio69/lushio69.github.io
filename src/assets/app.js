(() => {
  'use strict';

  const root = document.documentElement;
  const baseMeta = document.querySelector('meta[name="site-base"]');
  const base = baseMeta ? baseMeta.content : '/';
  const withBase = (url) => (url.startsWith('/') ? `${base}${url.slice(1)}` : `${base}${url}`);

  /* ---------------------------------------------------------------------
     Theme
     --------------------------------------------------------------------- */

  const themeColor = document.querySelector('#theme-color');
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (themeColor) themeColor.content = theme === 'dark' ? '#0e1512' : '#f1f4ee';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
      themeToggle.setAttribute('title', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    }
    syncCommentsTheme();
  }

  if (!root.dataset.theme || root.dataset.theme === 'auto') {
    let saved = null;
    try {
      saved = localStorage.getItem('lushio-theme');
    } catch (error) {}
    applyTheme(saved || (media.matches ? 'dark' : 'light'));
  } else {
    applyTheme(root.dataset.theme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('lushio-theme', next);
      } catch (error) {}
    });
  }

  media.addEventListener('change', (event) => {
    let saved = null;
    try {
      saved = localStorage.getItem('lushio-theme');
    } catch (error) {}
    if (!saved) applyTheme(event.matches ? 'dark' : 'light');
  });

  function syncCommentsTheme() {
    const comments = document.querySelector('[data-comments]');
    if (!comments) return;
    comments.querySelectorAll('iframe').forEach((frame) => {
      if (!frame.dataset.themeBound) {
        frame.dataset.themeBound = '1';
        frame.addEventListener('load', syncCommentsTheme);
      }
    });
    const dark = root.dataset.theme === 'dark';
    const utterances = comments.querySelector('iframe.utterances-frame');
    if (utterances?.contentWindow) {
      utterances.contentWindow.postMessage(
        { type: 'set-theme', theme: dark ? 'github-dark' : 'github-light' },
        'https://utteranc.es',
      );
    }
    const giscus = comments.querySelector('iframe.giscus-frame');
    if (giscus?.contentWindow) {
      giscus.contentWindow.postMessage(
        { giscus: { setConfig: { theme: dark ? 'dark' : 'light' } } },
        'https://giscus.app',
      );
    }
  }

  const commentsRoot = document.querySelector('[data-comments]');
  if (commentsRoot) {
    new MutationObserver(syncCommentsTheme).observe(commentsRoot, { childList: true, subtree: true });
    commentsRoot.querySelectorAll('iframe').forEach((frame) => frame.addEventListener('load', syncCommentsTheme));
    window.addEventListener('load', () => window.setTimeout(syncCommentsTheme, 500));
  }

  /* ---------------------------------------------------------------------
     Header and mobile navigation
     --------------------------------------------------------------------- */

  const header = document.querySelector('#site-header');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#site-nav');

  function updateHeader() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开菜单');
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (header && !header.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  /* ---------------------------------------------------------------------
     Search
     --------------------------------------------------------------------- */

  const dialog = document.querySelector('#search-dialog');
  const dialogInput = document.querySelector('#search-input');
  const dialogResults = document.querySelector('[data-search-results]');
  const dialogCount = document.querySelector('[data-search-count]');
  const searchOpeners = document.querySelectorAll('[data-search-open]');
  const searchClosers = document.querySelectorAll('[data-search-close]');
  const pageInput = document.querySelector('#page-search-input');
  const pageResults = document.querySelector('[data-page-search-results]');

  let indexPromise = null;
  let searchIndex = null;
  let selectedIndex = -1;
  let query = '';

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(withBase('/search-index.json'))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          searchIndex = Array.isArray(data)
            ? { posts: data, categories: [], tags: [] }
            : { posts: data.posts || [], categories: data.categories || [], tags: data.tags || [] };
          return searchIndex;
        })
        .catch(() => {
          indexPromise = null;
          return { posts: [], categories: [], tags: [] };
        });
    }
    return indexPromise;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function tokensFor(value) {
    return [...new Set(value.toLowerCase().split(/\s+/).map((token) => token.trim()).filter(Boolean))];
  }

  function highlight(value, tokens) {
    let html = escapeHtml(value);
    for (const token of tokens) {
      if (!token) continue;
      const escaped = escapeHtml(token);
      try {
        html = html.replace(new RegExp(`(${escapeRegex(escaped)})`, 'gi'), '<mark>$1</mark>');
      } catch (error) {}
    }
    return html;
  }

  function snippet(doc, tokens) {
    if (doc.summary) return doc.summary;
    const source = doc.content || '';
    const lower = source.toLowerCase();
    const position = tokens.map((token) => lower.indexOf(token)).filter((pos) => pos >= 0).sort((a, b) => a - b)[0];
    if (position === undefined) return source.slice(0, 130);
    const start = Math.max(0, position - 46);
    const end = Math.min(source.length, position + 110);
    return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
  }

  function searchAll(value) {
    const tokens = tokensFor(value);
    const empty = { posts: [], categories: [], tags: [] };
    if (!tokens.length || !searchIndex) return empty;

    const matchesName = (name) => {
      const lower = String(name).toLowerCase();
      return tokens.every((token) => lower.includes(token));
    };

    const posts = searchIndex.posts
      .map((doc) => {
        const title = doc.title.toLowerCase();
        const category = (doc.category || '').toLowerCase();
        const series = (doc.series || '').toLowerCase();
        const tags = (doc.tags || []).join(' ').toLowerCase();
        const summary = (doc.summary || '').toLowerCase();
        const content = (doc.content || '').toLowerCase();
        let score = 0;
        for (const token of tokens) {
          const inTitle = title.includes(token);
          const inCategory = category.includes(token);
          const inSeries = series.includes(token);
          const inTags = tags.includes(token);
          const inSummary = summary.includes(token);
          const inContent = content.includes(token);
          if (!inTitle && !inCategory && !inSeries && !inTags && !inSummary && !inContent) return null;
          if (inTitle) score += 80;
          if (inCategory) score += 26;
          if (inSeries) score += 24;
          if (inTags) score += 32;
          if (inSummary) score += 18;
          if (inContent) score += 4;
          if (title === token) score += 100;
          if (title.startsWith(token)) score += 35;
        }
        return { doc, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.doc.date.localeCompare(a.doc.date))
      .map((entry) => entry.doc);

    return {
      posts,
      categories: searchIndex.categories.filter((item) => matchesName(item.name)),
      tags: searchIndex.tags.filter((item) => matchesName(item.name)),
    };
  }

  function taxonomyMarkup(item, tokens, type) {
    return `<a class="search-result tax-result" href="${escapeHtml(item.url)}">
      <span class="tax-result-name">${highlight(item.name, tokens)}</span>
      <span class="tax-result-meta">${item.count} 篇文章 · ${type === 'category' ? '分类' : '标签'}</span>
    </a>`;
  }

  function postResultMarkup(doc, tokens) {
    return `<a class="search-result" href="${escapeHtml(doc.url)}">
      <h3>${highlight(doc.title, tokens)}</h3>
      <div class="search-result-meta"><span>${escapeHtml(doc.category || '未分类')}</span>${doc.series ? `<span>专栏 · ${escapeHtml(doc.series)}</span>` : ''}<span>${escapeHtml(doc.dateLabel || doc.date)}</span>${(doc.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
      <p>${highlight(snippet(doc, tokens), tokens)}</p>
    </a>`;
  }

  function renderResults(target, countTarget, data, tokens, options = {}) {
    const limitPosts = Number.isFinite(options.limitPosts) ? options.limitPosts : 5;
    const showMore = options.showMore === true;
    selectedIndex = -1;
    const total = data.categories.length + data.tags.length + data.posts.length;

    if (!total) {
      target.innerHTML = `<p class="search-hint">${options.emptyMessage || '没有找到匹配的内容，换个关键词试试。'}</p>`;
      if (countTarget) countTarget.textContent = '';
      return;
    }

    const columns = [
      { title: '分类', en: 'Category', items: data.categories.slice(0, 5), total: data.categories.length, type: 'category' },
      { title: '标签', en: 'Tag', items: data.tags.slice(0, 5), total: data.tags.length, type: 'tag' },
      { title: '文章', en: 'Keyword', items: data.posts.slice(0, limitPosts), total: data.posts.length, type: 'post' },
    ];

    target.innerHTML = `<div class="search-columns">${columns
      .map((column) => {
        const body = column.items.length
          ? column.items
              .map((item) => (column.type === 'post' ? postResultMarkup(item, tokens) : taxonomyMarkup(item, tokens, column.type)))
              .join('')
          : `<p class="search-empty">没有匹配的${column.title}。</p>`;
        const more =
          column.type === 'post' && showMore && column.total > column.items.length
            ? `<a class="search-more" href="${withBase(`/search/?q=${encodeURIComponent(query)}`)}">查看全部 ${column.total} 篇 ${'→'}</a>`
            : '';
        return `<section class="search-column">
          <div class="search-column-head">
            <span class="search-column-title">${column.title}<small>${column.en}</small></span>
            <span class="search-column-count">共 ${column.total} ${column.type === 'post' ? '篇' : '个'}</span>
          </div>
          <div class="search-column-body">${body}${more}</div>
        </section>`;
      })
      .join('')}</div>`;

    if (countTarget) {
      countTarget.textContent = `${data.categories.length} 分类 · ${data.tags.length} 标签 · ${data.posts.length} 文章`;
    }
  }

  function setSelected(nextIndex, target) {
    const items = [...target.querySelectorAll('.search-result')];
    if (!items.length) return;
    selectedIndex = (nextIndex + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle('is-selected', index === selectedIndex));
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }

  async function runDialogSearch(value) {
    query = value;
    if (!dialogResults) return;
    if (!value.trim()) {
      dialogResults.innerHTML = '<p class="search-hint">输入关键词，寻找散落在这里的句子。</p>';
      if (dialogCount) dialogCount.textContent = '';
      return;
    }
    if (!searchIndex) {
      dialogResults.innerHTML = '<p class="search-hint">正在翻找…</p>';
    }
    await loadIndex();
    if (query !== value) return;
    const tokens = tokensFor(value);
    const data = searchAll(value);
    renderResults(dialogResults, dialogCount, data, tokens, {
      limitPosts: 5,
      showMore: true,
      emptyMessage: '没有找到匹配的分类、标签或文章。',
    });
  }

  function openSearch() {
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (dialogInput) {
        dialogInput.focus();
        dialogInput.select();
      }
      loadIndex().then(() => {
        if (dialogInput && dialogInput.value.trim()) runDialogSearch(dialogInput.value);
      });
    } else if (dialogInput) {
      dialogInput.focus();
    }
  }

  searchOpeners.forEach((button) => button.addEventListener('click', openSearch));
  searchClosers.forEach((button) => button.addEventListener('click', () => dialog && dialog.close()));

  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  if (dialogInput) {
    let timer = 0;
    dialogInput.addEventListener('input', () => {
      window.clearTimeout(timer);
      const value = dialogInput.value;
      timer = window.setTimeout(() => runDialogSearch(value), 90);
    });
    dialogInput.addEventListener('keydown', (event) => {
      if (!dialogResults) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected(selectedIndex + 1, dialogResults);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected(selectedIndex - 1, dialogResults);
      } else if (event.key === 'Enter' && selectedIndex >= 0) {
        const selected = dialogResults.querySelectorAll('.search-result')[selectedIndex];
        if (selected) window.location.href = selected.getAttribute('href');
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      openSearch();
    }
  });

  if (dialogResults) dialogResults.setAttribute('aria-live', 'polite');

  /* Page-level search ---------------------------------------------------- */

  if (pageInput && pageResults) {
    loadIndex();
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('q') || '';
    pageInput.value = initial;

    const updatePage = async (value) => {
      if (!value.trim()) {
        pageResults.innerHTML = '<p class="search-hint">输入关键词开始搜索。</p>';
        return;
      }
      pageResults.innerHTML = '<p class="search-hint">正在翻找…</p>';
      await loadIndex();
      const tokens = tokensFor(value);
      const data = searchAll(value);
      renderResults(pageResults, null, data, tokens, {
        limitPosts: data.posts.length,
        emptyMessage: '没有找到匹配的分类、标签或文章。',
      });
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set('q', value.trim());
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    };

    if (initial) updatePage(initial);
    let pageTimer = 0;
    pageInput.addEventListener('input', () => {
      window.clearTimeout(pageTimer);
      pageTimer = window.setTimeout(() => updatePage(pageInput.value), 120);
    });
  }

  /* Tag page filter ----------------------------------------------------- */

  const tagFilterInput = document.querySelector('#tag-filter-input');
  const tagGrid = document.querySelector('[data-tag-grid]');
  if (tagFilterInput && tagGrid) {
    const cards = [...tagGrid.querySelectorAll('[data-tag-name]')];
    const count = document.querySelector('[data-tag-count]');
    const empty = document.querySelector('[data-tag-empty]');

    const filterTags = () => {
      const query = tagFilterInput.value.trim().toLowerCase();
      let visible = 0;
      for (const card of cards) {
        const match = !query || card.dataset.tagName.includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      }
      if (count) {
        count.textContent = query ? `找到 ${visible} 个标签` : `${cards.length} 个标签`;
      }
      if (empty) empty.hidden = visible !== 0;
    };

    tagFilterInput.addEventListener('input', filterTags);
  }

  /* ---------------------------------------------------------------------
     Copy buttons
     --------------------------------------------------------------------- */

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.code-copy');
    if (!button) return;
    const block = button.closest('.code-block');
    const code = block?.querySelector('pre code');
    if (!code) return;
    try {
      await copyText(code.textContent);
      const original = button.textContent;
      button.textContent = '已复制';
      button.classList.add('is-copied');
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('is-copied');
      }, 1600);
    } catch (error) {
      button.textContent = '复制失败';
    }
  });

  /* ---------------------------------------------------------------------
     Reading progress and table of contents
     --------------------------------------------------------------------- */

  const progress = document.querySelector('[data-reading-progress] span');
  const article = document.querySelector('.template-post');
  const tocLinks = [...document.querySelectorAll('.toc-link')];
  const tocHeadings = tocLinks
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      return { link, heading: document.getElementById(id) };
    })
    .filter((item) => item.heading);

  let frame = 0;
  function updateReadingState() {
    frame = 0;
    if (progress && article) {
      const start = article.offsetTop;
      const end = start + article.offsetHeight - window.innerHeight;
      const ratio = end > start ? (window.scrollY - start) / (end - start) : 0;
      progress.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
    }
    if (tocHeadings.length) {
      let active = 0;
      tocHeadings.forEach((item, index) => {
        if (item.heading.getBoundingClientRect().top < 150) active = index;
      });
      tocHeadings.forEach((item, index) => item.link.classList.toggle('is-active', index === active));
    }
  }

  function requestReadingUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateReadingState);
  }

  if (progress || tocHeadings.length) {
    updateReadingState();
    window.addEventListener('scroll', requestReadingUpdate, { passive: true });
    window.addEventListener('resize', requestReadingUpdate);
  }

  /* Keyboard: close mobile menu on Escape -------------------------------- */

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
})();
