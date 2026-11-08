# Lushio · 数学、物理与计算机科学博客

一个安静、克制、零前端框架的跨学科博客。纯 Node.js 静态生成，公式在构建时用 KaTeX 排好，托管在 GitHub Pages，本地双击即可发布。

![Lushio 博客预览](docs/preview.webp)

## 特点

- **数学公式**：行内 `$...$`、独立 `$$...$$`，构建时用 KaTeX 渲染成 HTML，不依赖 CDN 或浏览器脚本。
- **跨学科分类**：数学分析、线性代数、概率论、物理学、计算机科学和随笔。
- **分类栏**：每个分类下面直接列出最近更新的三篇文章和摘要。
- **专栏**：支持长期连载的文章集，例如《100 天学会微积分》。
- **三栏搜索**：搜索结果拆成分类、标签和关键字；标签页也有即时筛选框。
- **友情链接**：配置驱动的友链墙，带交换说明和本站信息卡。
- **文章信息**：文章页突出显示分类、标签和所属专栏，全部可点击。
- **评论区**：通过 Utterances 接入 GitHub Issues，自动跟随明暗主题。
- **零构建依赖**：KaTeX 已随仓库内置，不需要 `npm install`。
- **一键发布**：双击 `publish.cmd`，自动构建、检查、提交、同步远程并推送。
- **完整博客功能**：文章、专栏、分类、标签、归档、友链、关于、搜索、站点地图、404。
- **阅读体验**：响应式布局、明暗主题、文章目录、阅读进度、代码复制。

## 快速开始

需要 Node.js 18+ 和 Git。在当前目录打开终端：

```powershell
npm run dev
```

或直接双击 `dev.cmd`，然后访问 [http://localhost:4173](http://localhost:4173)。

生产构建：

```powershell
npm run build
npm run check
```

`npm run check` 会检查页面标题、重复 id、嵌套链接、内部链接、搜索索引和 KaTeX 资源。

## 第一次发布到 GitHub Pages

### 1. 创建仓库

在 GitHub 新建一个 **Public** 空仓库，名称：

```text
lushio69.github.io
```

如果你换用户名，仓库名也要改成 `你的用户名.github.io`，并同步修改 `site.config.json` 里的 `url`。

> 建议不要勾选 “Add a README file”。空仓库最省事。

### 2. 开启 Pages

仓库 **Settings → Pages**：

- **Build and deployment**
- **Source** 选择 **GitHub Actions**

不需要选分支或目录，部署由 `.github/workflows/deploy.yml` 完成。

### 3. 双击发布

双击 `publish.cmd`。第一次运行会：

1. 检查本地 Git 仓库；
2. 提示你粘贴仓库地址；
3. 构建并检查站点；
4. 提交所有文件；
5. 推送代码；
6. GitHub Actions 自动部署，通常 1–2 分钟后上线。

仓库地址示例：

```text
https://github.com/lushio69/lushio69.github.io.git
```

如果弹出 GitHub 登录窗口，登录并授权即可。Windows 上 Git Credential Manager 会记住凭据。

后续每次发布只需要双击 `publish.cmd`。

## 日常写作

```text
new-post.cmd  →  写内容  →  dev.cmd 预览  →  publish.cmd 发布
```

新建文章也可以使用：

```powershell
npm run new -- "文章标题"
```

脚本会生成一篇草稿。把 `draft: true` 删掉或改成 `false`，文章才会进入构建。

### Front matter

```markdown
---
title: "DAY 01：变化率不是除法"
date: 2026-06-01
category: 数学分析
tags: [微积分, 导数, 直觉]
series: 100-days-calculus
seriesOrder: 1
seriesLabel: DAY 01
summary: "一句话摘要，会用在首页和 SEO。"
cover: /assets/covers/calculus-day01.svg
---

正文从这里开始。
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `date` | 是 | `YYYY-MM-DD` |
| `category` | 建议 | 一个分类名，例如 `数学分析`、`物理学`、`计算机科学`；不填会归入「未分类」 |
| `tags` | 否 | 多个关键词，例如 `[极限, 证明]` |
| `series` | 否 | 所属专栏的 slug，例如 `100-days-calculus` |
| `seriesOrder` | 否 | 在专栏里的顺序，数字越小越靠前 |
| `seriesLabel` | 否 | 专栏里的篇目标签，例如 `DAY 01` |
| `summary` | 否 | 首页摘要、SEO 描述；不填自动截取正文 |
| `cover` | 否 | 封面图路径 |
| `draft` | 否 | `true` 时不参与构建 |
| `featured` | 否 | 预留的精选标记 |

文件名会成为 URL，例如 `content/posts/calculus-day01.md` → `/posts/calculus-day01/`。

### 分类和标签的区别

- **分类**：每篇文章只属于一个分类，像书架上的固定分区。用于回答“这篇文章属于哪个领域”。
- **标签**：一篇文章可以有多个标签，可以跨分类重复出现。用于回答“它还和什么有关”。

分类页面在 `/categories/`，标签页面在 `/tags/`。首页会把每个分类最近的三篇文章和摘要直接铺开。分类的展示顺序可以在 `site.config.json` 的 `categoryOrder` 中调整。

## 搜索

点击页头的放大镜，或按 `Ctrl+K`（macOS 用 `Cmd+K`）打开搜索。搜索结果分成三栏：

- **分类**：匹配的分类，大字号显示，点击进入分类页；
- **标签**：匹配的标签，点击进入标签页；
- **关键字**：匹配标题、摘要、标签和正文的文章。

弹窗里每个栏目最多显示 5 条；关键字结果超过 5 条时，会出现“查看全部”链接，跳到 `/search/?q=关键词` 的完整结果页。完整结果页保留同样的三栏结构，关键字栏展示全部匹配文章。

标签页 `/tags/` 标题右侧还有一个独立的标签搜索框，输入时会即时过滤标签卡片，并显示匹配数量。

搜索索引由构建脚本生成，包含 `posts`、`categories` 和 `tags` 三部分，存放在 `dist/search-index.json`。

## 专栏

专栏用来放那些会长期更新、有顺序的文章集。它和分类、标签是三个独立维度：

- 分类回答“属于哪个领域”；
- 标签回答“和什么有关”；
- 专栏回答“这篇文章属于哪条持续更新的路径”。

### 新建一个专栏

在 `content/series/` 新建 Markdown 文件，例如 `100-days-calculus.md`：

```markdown
---
title: "100 天学会微积分"
description: "从变化率开始，把微积分重新讲一遍。"
status: "连载中"
target: 100
order: 1
cover: /assets/covers/series-calculus.svg
---

这个专栏的长期说明。
```

然后在文章 front matter 里引用它的 slug：

```markdown
series: 100-days-calculus
seriesOrder: 1
seriesLabel: DAY 01
```

构建时会自动：

- 生成 `/series/` 列表页；
- 生成 `/series/100-days-calculus/` 详情页；
- 按 `seriesOrder` 排列篇目；
- 在文章页显示“本文收录于《100 天学会微积分》”，并链接回专栏；
- 在首页展示专栏进度。

## 数学公式

站内使用 [KaTeX](https://katex.org/) 在构建时渲染公式。产物是普通 HTML + MathML，不依赖外部公式脚本。

### 行内公式

```markdown
当 $\varepsilon>0$ 时，存在 $\delta>0$。
```

### 独立公式

```markdown
$$
\int_0^\infty e^{-x^2}\,\dd x=\frac{\sqrt{\pi}}{2}
$$
```

也支持：

```markdown
\[
\sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}
\]
```

### 内置宏

为了少敲一点，以下宏可以直接用：

| 宏 | 展开 |
| --- | --- |
| `\R` `\N` `\Z` `\Q` `\C` | 常用的数集符号 |
| `\E` | 期望 |
| `\Var` `\Cov` | 方差、协方差 |
| `\dd` | 正体微分号 d |
| `\abs{x}` | 绝对值 |
| `\norm{x}` | 范数 |
| `\inner{x}{y}` | 内积 |
| `\argmax` `\argmin` | 带下标的 arg max / arg min |

公式写在代码块里不会渲染：

````markdown
```markdown
这里是 $x^2$，不会被当成公式。
```
````

如果正文里真的需要美元符号，写成 `\$5`。

## 评论区

GitHub Pages 是纯静态托管，本身不能运行评论后端。这个项目使用 **Utterances**，把评论存进 GitHub Issues：

- 不需要数据库或服务器；
- 读者用 GitHub 账号登录后留言；
- 每篇文章第一次被评论时，Utterances 会自动创建一个对应的 issue；
- 评论内容和文章一样，公开、可搜索、可管理；
- 本站已实现明暗主题同步。

### 启用步骤

1. 确保仓库是 **Public**。
2. 打开仓库 **Settings → General → Features**，勾选 **Issues**。
3. 安装 Utterances App：<https://github.com/apps/utterances>，选择这个博客仓库授权。
4. 修改 `site.config.json`：

   ```json
   "comments": {
     "provider": "utterances",
     "repo": "你的用户名/你的仓库",
     "issueTerm": "pathname",
     "label": "comment"
   }
   ```

5. 重新发布。打开任意文章，底部就会出现评论区。

`issueTerm: "pathname"` 表示每篇文章用页面路径作为 issue 的标识。修改文章 URL 会让它对应到新的 issue，所以发布后尽量保持 slug 稳定。

### 用 Giscus 也可以

如果你更喜欢 GitHub Discussions，可以改用 Giscus：

```json
"comments": {
  "provider": "giscus",
  "repo": "你的用户名/你的仓库",
  "repoId": "从 giscus.app 获取",
  "category": "Announcements",
  "categoryId": "从 giscus.app 获取"
}
```

需要先启用 Discussions，并在 [giscus.app](https://giscus.app/) 安装 App、生成 `repoId` 和 `categoryId`。模板已经支持这两种 provider，配置后会自动切换。

> 评论区依赖 GitHub 的第三方脚本。如果访客没有 GitHub 账号，就只能阅读，不能留言。

## 友情链接

友链页面在 `/links/`，由 `site.config.json` 的 `friends` 数组驱动。默认是空的，会显示“虚位以待”和交换说明；填入条目后自动变成卡片墙。

```json
"friends": [
  {
    "name": "朋友的名字",
    "url": "https://example.com",
    "description": "一句话介绍这个站点。",
    "avatar": "/assets/friends/avatar.png"
  }
],
"friendApplyUrl": "https://github.com/你的用户名/你的仓库/issues/new"
```

- `avatar` 可选；不填会用站点名的第一个字作为字母标记。
- `friendApplyUrl` 是“交换友链”按钮的链接，默认指向仓库的新 issue 页面。
- 页面底部还会展示本站名称、地址和简介，方便别人复制去添加友链。

## 站点配置

编辑 `site.config.json`：

```json
{
  "title": "Lushio",
  "mark": "∑",
  "description": "一个关于数学、物理与计算机科学的安静博客。",
  "author": "Lushio",
  "url": "https://lushio69.github.io",
  "basePath": "/",
  "tagline": "在公式、定律与代码之间，写下理解的过程。",
  "friends": [],
  "friendApplyUrl": "https://github.com/lushio69/lushio69.github.io/issues/new"
}
```

首页首屏文案、公式、`now` 卡片、导航、社交链接和评论配置也都在这个文件里。

### 项目站点

如果仓库不是 `用户名.github.io`，而是普通仓库 `my-blog`，访问地址会是 `https://用户名.github.io/my-blog/`。修改：

```json
"url": "https://用户名.github.io",
"basePath": "/my-blog/"
```

`url` 只写到域名，`basePath` 负责子路径。构建脚本会给内链、资源、Markdown 站内链接和搜索索引加上正确前缀。

### 自定义域名

1. 在仓库 **Settings → Pages → Custom domain** 填入域名。
2. 在域名服务商处添加 CNAME，指向 `你的用户名.github.io`。
3. 修改配置：

   ```json
   "url": "https://你的域名",
   "customDomain": "你的域名"
   ```

构建时会生成 `dist/CNAME`。开启 HTTPS 后等待证书签发。

## 发布脚本

`publish.ps1` 会：

1. 检查 Node.js 和 Git；
2. 确认当前在 `main` 分支；
3. 同步远程提交（rebase，自动暂存本地修改）；
4. 构建 + 检查；
5. 提交所有变化；
6. 推送并触发 GitHub Actions。

常用参数：

```powershell
.\publish.ps1 -DryRun                 # 只构建和检查
.\publish.ps1 -NoPush                 # 构建 + 本地提交，不推送
.\publish.ps1 -Message "post: 新文章"  # 自定义 commit message
.\publish.ps1 -RemoteUrl "https://github.com/用户名/仓库.git"
```

## 目录结构

```text
.
├─ content/
│  ├─ posts/              # 文章 Markdown（带 category / tags / series）
│  ├─ series/             # 专栏元数据和长期说明
│  └─ pages/              # 独立页面（关于）
├─ archive/v1-math-blog/  # 早期纯数学版本的文字与样式快照
├─ src/assets/            # 样式、交互、封面图、图标
├─ vendor/katex/          # 内置 KaTeX（含字体和许可证）
├─ scripts/
│  ├─ build.mjs           # 静态生成器
│  ├─ dev.mjs             # 本地预览 + 自动刷新
│  ├─ check.mjs           # 产物检查
│  ├─ new-post.mjs        # 新建文章
│  └─ lib/
│     ├─ math.mjs         # KaTeX 渲染和宏
│     ├─ markdown.mjs     # Markdown + 公式解析
│     ├─ templates.mjs    # 页面模板
│     └─ utils.mjs
├─ dist/                  # 构建产物（Git 忽略）
├─ site.config.json
├─ publish.ps1 / .cmd
├─ dev.cmd
└─ new-post.cmd
```

## 常见问题

**公式没有渲染**

检查 `$...$` 两边是否有空格：`$ x$` 和 `$x $` 都不会被当成行内公式。独立公式要用独占一行的 `$$` 或 `\[`。

**公式显示成源代码**

确认构建产物里有 `dist/assets/katex.min.css` 和 `dist/assets/fonts/`。运行 `npm run check` 会检查这些资源。

**评论区没有出现**

确认仓库是 Public、Issues 已开启、Utterances App 已授权，并且 `site.config.json` 里的 `repo` 是 `用户名/仓库名`。

**分类页面是空的**

检查文章 front matter 里的 `category` 是否拼写一致。一个分类名对应一个页面，拼写不同会被视为两个分类。

**专栏里的文章顺序不对**

检查每篇文章的 `seriesOrder`。构建会先按它排序，再按日期排序；没有 `seriesOrder` 的文章会排在后面。

**分类栏只显示了三篇**

首页和分类总览页默认只展示每个分类最近的三篇，完整列表在分类自己的页面里。这个数量在模板 `renderCategoryBoard` 中调整。

**推送失败 / 403**

在终端运行 `git push -u origin main` 查看详细错误，重新登录 GitHub 或检查网络。

## 验证

```powershell
npm run build
npm run check
```

当前构建会生成 6 个分类、19 个标签、1 个专栏和 44 个页面，并检查全部内部链接。

## 一点说明

`content/` 里的八篇文章是示例内容，发布前请替换成你自己的文章。KaTeX 的许可证在 `vendor/katex/LICENSE`。

早期的纯数学版本保存在 Git 标签 `v1-math-blog` 和 `archive/v1-math-blog/` 中，包括当时的文字、样式和首页截图。

这个博客没有统计脚本、没有第三方字体、没有 CDN。公式在构建时就已经排好，评论交给 GitHub。

把每一步写清楚。
