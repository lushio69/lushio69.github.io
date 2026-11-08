import { renderMath } from './math.mjs';
import { escapeAttr, escapeHtml, slugify, stripHtml } from './utils.mjs';

/**
 * A deliberately small Markdown renderer for trusted local content.
 * Supports the syntax a personal blog needs: headings, emphasis, links,
 * images, lists, blockquotes, tables, fenced code, rules and inline code.
 */
export function renderMarkdown(markdown = '', options = {}) {
  const ctx = {
    headings: [],
    headingIds: new Map(),
    headingNumber: 0,
    ...options,
  };
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const html = renderBlocks(lines, ctx);
  return { html, headings: ctx.headings };
}

function renderBlocks(lines, ctx) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const displayMath = line.match(/^ {0,3}(\$\$|\\\[)\s*(.*)$/);
    if (displayMath) {
      const closing = displayMath[1] === '$$' ? '$$' : '\\]';
      let tex = displayMath[2];
      i += 1;
      if (tex.includes(closing)) {
        tex = tex.slice(0, tex.indexOf(closing));
      } else {
        while (i < lines.length) {
          const current = lines[i];
          if (current.includes(closing)) {
            tex += `\n${current.slice(0, current.indexOf(closing))}`;
            i += 1;
            break;
          }
          tex += `\n${current}`;
          i += 1;
        }
      }
      out.push(`<div class="math-display">${renderMath(tex, true)}</div>`);
      continue;
    }

    const fence = line.match(/^ {0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/);
    if (fence) {
      const marker = fence[1];
      const language = fence[2] || '';
      const code = [];
      i += 1;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const languageClass = language ? ` class="language-${escapeAttr(language)}"` : '';
      out.push(
        `<div class="code-block"><div class="code-bar"><span>${escapeHtml(language || 'text')}</span><button class="code-copy" type="button" aria-label="复制代码">复制</button></div><pre><code${languageClass}>${escapeHtml(code.join('\n'))}</code></pre></div>`,
      );
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = Math.min(6, Math.max(2, heading[1].length));
      out.push(renderHeading(heading[2], level, ctx));
      i += 1;
      continue;
    }

    if (i + 1 < lines.length && line.trim() && /^ {0,3}(=+|-+)\s*$/.test(lines[i + 1])) {
      const level = lines[i + 1].trim().startsWith('=') ? 2 : 3;
      out.push(renderHeading(line.trim(), level, ctx));
      i += 2;
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quote = [];
      while (i < lines.length && (/^ {0,3}>/.test(lines[i]) || !lines[i].trim())) {
        if (!lines[i].trim()) {
          if (i + 1 < lines.length && /^ {0,3}>/.test(lines[i + 1])) quote.push('');
          else break;
        } else {
          quote.push(lines[i].replace(/^ {0,3}> ?/, ''));
        }
        i += 1;
      }
      out.push(`<blockquote>${renderBlocks(quote, ctx)}</blockquote>`);
      continue;
    }

    if (/^ {0,3}<([a-z][\w-]*)(?:\s|>)/i.test(line)) {
      const raw = [];
      while (i < lines.length && lines[i].trim()) {
        raw.push(lines[i]);
        i += 1;
      }
      out.push(raw.join('\n'));
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = renderTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    if (matchListMarker(line)) {
      const list = renderList(lines, i, ctx);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    const text = paragraph.join('\n').replace(/ {2,}\n/g, '<br>\n');
    out.push(`<p>${renderInline(text)}</p>`);
  }

  return out.join('\n');
}

function renderHeading(text, level, ctx) {
  const plain = stripInline(text);
  let id = slugify(plain, `section-${ctx.headingNumber + 1}`);
  if (ctx.headingIds.has(id)) {
    let suffix = 2;
    while (ctx.headingIds.has(`${id}-${suffix}`)) suffix += 1;
    id = `${id}-${suffix}`;
  }
  ctx.headingIds.set(id, true);
  ctx.headingNumber += 1;
  ctx.headings.push({ level, text: plain, id });
  return `<h${level} id="${escapeAttr(id)}"><a class="heading-anchor" href="#${escapeAttr(id)}" aria-hidden="true" tabindex="-1">#</a>${renderInline(text)}</h${level}>`;
}

function isTableStart(lines, i) {
  if (i + 1 >= lines.length) return false;
  if (!lines[i].includes('|') || !lines[i + 1].includes('|')) return false;
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1]);
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function renderTable(lines, start) {
  const headers = splitTableRow(lines[start]);
  const aligns = splitTableRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    rows.push(splitTableRow(lines[i]));
    i += 1;
  }
  const cell = (tag, value, index) => {
    const align = aligns[index] ? ` style="text-align:${aligns[index]}"` : '';
    return `<${tag}${align}>${renderInline(value || '')}</${tag}>`;
  };
  const head = headers.map((header, index) => cell('th', header, index)).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((_, index) => cell('td', row[index], index)).join('')}</tr>`)
    .join('');
  return {
    html: `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
    next: i,
  };
}

function matchListMarker(line) {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
  if (!match) return null;
  return {
    indent: match[1].replace(/\t/g, '  ').length,
    ordered: /^\d+\.$/.test(match[2]),
    marker: match[2],
    text: match[3],
  };
}

function renderList(lines, start, ctx) {
  const first = matchListMarker(lines[start]);
  const indent = first.indent;
  const ordered = first.ordered;
  const tag = ordered ? 'ol' : 'ul';
  const items = [];
  let i = start;

  while (i < lines.length) {
    const marker = matchListMarker(lines[i]);
    if (!marker || marker.indent !== indent || marker.ordered !== ordered) break;

    let body = marker.text;
    i += 1;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) break;
      const nextMarker = matchListMarker(line);
      if (nextMarker && nextMarker.indent <= indent) break;
      if (nextMarker) {
        const relative = Math.max(2, nextMarker.indent - indent);
        body += `\n${' '.repeat(relative)}${nextMarker.marker} ${nextMarker.text}`;
        i += 1;
        continue;
      }
      if (line.match(/^\s{2,}/)) {
        body += `\n${line.trim()}`;
        i += 1;
        continue;
      }
      if (isBlockStart(lines, i)) break;
      body += `\n${line.trim()}`;
      i += 1;
    }

    const nestedLines = body.split('\n');
    const nestedIndex = nestedLines.findIndex((line) => {
      const m = matchListMarker(line);
      return m && m.indent > 0;
    });

    let nestedHtml = '';
    if (nestedIndex >= 0) {
      const nested = renderList(nestedLines, nestedIndex, ctx);
      nestedHtml = nested.html;
      body = nestedLines.slice(0, nestedIndex).join('\n');
    }

    const task = body.match(/^\[([ xX])\]\s+(.*)$/);
    let content;
    if (task) {
      const checked = task[1].toLowerCase() === 'x';
      content = `<label class="task"><input type="checkbox" disabled${checked ? ' checked' : ''}> <span>${renderInline(task[2])}</span></label>`;
    } else {
      const paragraphs = body.split(/\n{2,}/).filter((part) => part.trim());
      content = paragraphs.length > 1
        ? paragraphs.map((part) => `<p>${renderInline(part.replace(/\n/g, ' '))}</p>`).join('')
        : renderInline(body.replace(/\n/g, ' '));
    }
    items.push(`<li>${content}${nestedHtml}</li>`);
  }

  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

function isBlockStart(lines, i) {
  const line = lines[i];
  if (!line || !line.trim()) return true;
  if (/^ {0,3}(\$\$|\\\[)/.test(line)) return true;
  if (/^ {0,3}(```+|~~~+)/.test(line)) return true;
  if (/^ {0,3}#{1,6}\s+/.test(line)) return true;
  if (/^ {0,3}>/.test(line)) return true;
  if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return true;
  if (matchListMarker(line)) return true;
  if (/^ {0,3}<([a-z][\w-]*)(?:\s|>)/i.test(line)) return true;
  if (isTableStart(lines, i)) return true;
  if (i + 1 < lines.length && /^ {0,3}(=+|-+)\s*$/.test(lines[i + 1])) return true;
  return false;
}

function stripInline(text) {
  return stripHtml(
    renderInline(
      String(text)
        .replace(/`[^`]*`/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'),
    ),
  );
}

function safeUrl(url = '') {
  const value = String(url).replace(/&amp;/g, '&').trim();
  if (!value) return '#';
  if (/^(?:javascript|vbscript|data):/i.test(value)) return '#';
  if (/^(?:https?:|mailto:|tel:|\/|#|\.{0,2}\/)/i.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return '#';
  return value;
}

function linkLabel(value = '') {
  return value.replace(/&amp;/g, '&');
}

function renderInline(raw = '') {
  const codeTokens = [];
  const mathTokens = [];
  let text = String(raw).replace(/(`+)([\s\S]*?)\1/g, (_, ticks, code) => {
    const token = `\u0000CODETOKEN${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${escapeHtml(code.replace(/^ | $/g, ''))}</code>`);
    return token;
  });

  const stashMath = (tex, displayMode = false) => {
    const token = `\u0000MATHTOKEN${mathTokens.length}\u0000`;
    mathTokens.push(renderMath(tex, displayMode));
    return token;
  };

  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => stashMath(tex));
  text = text.replace(/(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, tex) => stashMath(tex));

  text = escapeHtml(text);

  text = text.replace(
    /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
    (_, alt, src, title) =>
      `<img src="${escapeAttr(safeUrl(src))}" alt="${escapeAttr(linkLabel(alt))}"${title ? ` title="${escapeAttr(title)}"` : ''} loading="lazy" decoding="async">`,
  );

  text = text.replace(
    /\[([^\]]+)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
    (_, label, href, title) => {
      const url = safeUrl(href);
      const external = /^https?:\/\//i.test(url);
      return `<a href="${escapeAttr(url)}"${title ? ` title="${escapeAttr(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    },
  );

  text = text.replace(
    /&lt;(https?:\/\/[^\s&]+|mailto:[^\s&]+)&gt;/g,
    (_, url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${url.replace(/^mailto:/, '')}</a>`,
  );

  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\w)~~([^~]+)~~(?!\w)/g, '<del>$1</del>');
  text = text.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<em>$1</em>');
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');

  text = text.replace(/\u0000MATHTOKEN(\d+)\u0000/g, (_, index) => mathTokens[Number(index)]);
  text = text.replace(/\u0000CODETOKEN(\d+)\u0000/g, (_, index) => codeTokens[Number(index)]);
  return text;
}
