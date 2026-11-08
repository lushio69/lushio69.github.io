import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

import { slugify } from './lib/utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseArgs(argv) {
  const args = [...argv];
  let slug = '';
  const slugIndex = args.indexOf('--slug');
  if (slugIndex >= 0) {
    slug = args[slugIndex + 1] || '';
    args.splice(slugIndex, 2);
  }
  return { title: args.join(' ').trim(), slug };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  let title = parsed.title;

  if (!title) {
    const rl = readline.createInterface({ input, output });
    title = (await rl.question('文章标题：')).trim();
    rl.close();
  }
  if (!title) {
    console.error('没有标题，已取消。');
    process.exit(1);
  }

  const date = today();
  let slug = slugify(parsed.slug || title, `post-${date.replaceAll('-', '')}`);
  if (parsed.slug) slug = slugify(parsed.slug, slug);

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  let filePath = path.join(POSTS_DIR, `${slug}.md`);
  let counter = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(POSTS_DIR, `${slug}-${counter}.md`);
    counter += 1;
  }

  const safeTitle = title.replace(/"/g, '\\"');
  const content = `---
title: "${safeTitle}"
date: ${date}
category: 随笔
tags: [数学]
summary: ""
draft: true
---

在这里开始写正文。

## 一个小标题

行内公式可以写成 $E = mc^2$。

$$
\\int_0^1 x^2 \\,\\dd x = \\frac{1}{3}
$$

> 一句想留下的话。
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n  已创建：${path.relative(ROOT, filePath)}`);
  console.log('  文章目前是草稿（draft: true），完成后把它改成 false。');
  console.log('  运行 npm run dev 可以在浏览器里实时预览。\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
