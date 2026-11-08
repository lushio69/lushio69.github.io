# Lushio · 个人博客

一个安静、克制、零前端框架的个人博客。纯 Node.js 静态生成，托管在 GitHub Pages，本地双击即可发布。

部署后的地址：`https://lushio69.github.io`（请把用户名换成你自己的）。

![Lushio 博客预览](docs/preview.webp)

## 特点

- **零运行时依赖**：不需要 React、Vue、Astro 或 Hugo，只要有 Node.js。
- **一键发布**：双击 `publish.cmd`，自动构建、检查、提交、同步远程并推送。
- **自动部署**：推送到 `main` 后，GitHub Actions 自动构建并发布到 Pages。
- **完整博客功能**：文章、归档、标签、关于、站内搜索、RSS、站点地图、404。
- **认真做过的阅读体验**：响应式布局、明暗主题、文章目录、阅读进度、代码复制。
- **本地实时预览**：修改内容或样式后自动重建，浏览器自动刷新。
- **写作友好**：Markdown + 简单 front matter，内置新建文章脚本。

## 先看一眼

需要 Node.js 18+ 和 Git。在当前目录打开终端：

```powershell
npm run dev
```

然后访问 [http://localhost:4173](http://localhost:4173)。也可以直接双击 `dev.cmd`。

生产构建：

```powershell
npm run build
npm run check
```

构建结果在 `dist/`。`npm run check` 会检查所有页面标题、重复 id、内部链接以及 RSS / 搜索索引。

## 第一次发布到 GitHub Pages

### 1. 创建 GitHub 仓库

在 GitHub 新建一个 **Public** 仓库，名称必须是：

```text
lushio69.github.io
```

如果你要换用户名，仓库名就是 `你的用户名.github.io`，并把 `site.config.json` 里的 `url` 一起改掉。

> 建议创建**空仓库**，不要勾选 “Add a README file”。如果已经有初始提交，发布脚本会尝试在其基础上继续，但空仓库最省事。

### 2. 开启 Pages

进入仓库 **Settings → Pages**：

- **Build and deployment**
- **Source** 选择 **GitHub Actions**

不需要选分支，也不需要填目录。部署由仓库里的 `.github/workflows/deploy.yml` 完成。

### 3. 双击发布

双击 `publish.cmd`。

第一次运行时，脚本会：

1. 自动初始化本地 Git 仓库；
2. 构建并检查站点；
3. 提交所有文件；
4. 提示你粘贴仓库地址，例如：

   ```text
   https://github.com/lushio69/lushio69.github.io.git
   ```

5. 推送代码；
6. GitHub Actions 自动部署，通常 1–2 分钟后网站上线。

如果 Windows 弹出凭据窗口，登录 GitHub 即可。Git 会通过 Git Credential Manager 记住账号。

也可以使用命令行：

```powershell
.\publish.ps1
```

首次发布后，后续每次只要双击 `publish.cmd`。它会先同步远程提交，再构建、提交和推送，避免覆盖别人的改动。

> 如果你手动创建了仓库并配置了远程，可以直接运行：
>
> ```powershell
> git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
> git push -u origin main
> ```

## 日常写作流程

```text
new-post.cmd  →  写内容  →  dev.cmd 预览  →  publish.cmd 发布
```

### 新建文章

双击 `new-post.cmd`，输入标题。

或者：

```powershell
npm run new -- "今天的标题"
```

脚本会在 `content/posts/` 下创建一篇草稿：

```markdown
---
title: "今天的标题"
date: 2026-11-08
tags: [随笔]
summary: ""
draft: true
---

在这里开始写正文。
```

把 `draft: true` 改成 `false`（或删掉这一行），文章才会出现在构建结果里。

### Front matter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `date` | 是 | `YYYY-MM-DD`，用于排序和显示 |
| `tags` | 否 | `[写作, 生活]` 或分行列表 |
| `summary` | 否 | 首页摘要和 SEO 描述；不填会自动截取正文 |
| `cover` | 否 | 封面图路径，例如 `/assets/covers/quiet-morning.svg` |
| `draft` | 否 | `true` 时不参与构建 |
| `featured` | 否 | 预留字段，可标记精选文章 |

文件名会成为文章 URL，例如 `content/posts/hello-world.md` → `/posts/hello-world/`。建议使用英文小写和连字符；中文文件名也能工作，会自动进行 URL 编码。

### Markdown 支持

标题、粗体、斜体、删除线、链接、图片、引用、有序 / 无序 / 嵌套列表、任务列表、表格、代码块、分割线，以及 Markdown 中直接写 HTML。

文章内的图片建议放在 `src/assets/images/`，引用路径写：

```markdown
![描述](/assets/images/your-photo.jpg)
```

构建时会整个复制 `src/assets/`，所以本地路径可以放心使用。

## 个性化配置

### 站点信息

编辑 `site.config.json`：

```json
{
  "title": "Lushio",
  "description": "代码、文字与生活的安静角落。",
  "author": "Lushio",
  "url": "https://lushio69.github.io",
  "basePath": "/",
  "tagline": "在代码与文字之间，记录缓慢发生的事。"
}
```

首页首屏文案、`now` 卡片、导航、社交链接也都在这个文件里。

### 关于页

编辑 `content/pages/about.md`。这是普通的 Markdown 页面，会生成 `/about/`。

### 颜色和字体

所有设计变量集中在 `src/assets/styles.css` 顶部的 `:root` 和 `[data-theme="dark"]` 中：

```css
:root {
  --bg: #f4efe5;
  --ink: #211f1b;
  --accent: #b4452c;
  --serif: "Iowan Old Style", "Songti SC", serif;
  --sans: "Avenir Next", "PingFang SC", sans-serif;
}
```

改完保存，`dev.cmd` 会自动重建并刷新页面。

### 替换示例内容

`content/posts/` 里的四篇文章是演示内容，可以直接删除或替换。删空之后首页依然可以构建，只是会显示空状态。

### 项目站点（非用户名仓库）

如果你把博客放在普通仓库，例如 `my-blog`，访问地址会是 `https://用户名.github.io/my-blog/`。需要修改：

```json
"url": "https://用户名.github.io",
"basePath": "/my-blog/"
```

`url` 只写到域名（不要带 `/my-blog`），`basePath` 负责仓库子路径。构建脚本会把所有内链、资源、RSS、搜索索引和 Markdown 里的站内链接都加上正确前缀。

### 自定义域名

1. 在仓库 **Settings → Pages → Custom domain** 填入域名并保存；
2. 在域名服务商处添加 CNAME 记录，指向 `你的用户名.github.io`；
3. 在 `site.config.json` 中设置：

   ```json
   "url": "https://你的域名",
   "customDomain": "你的域名"
   ```

构建时会额外生成 `dist/CNAME`。开启 HTTPS 后等待证书签发即可。

## 发布脚本说明

`publish.ps1` 做这些事：

1. 检查 Node.js 和 Git；
2. 没有 `.git` 时自动初始化并创建 `main` 分支；
3. 没有远程仓库时提示粘贴地址；
4. 拉取远程更新（rebase，自动暂存本地修改）；
5. 构建并检查站点；
6. `git add -A` + 提交；
7. `git push -u origin main`；
8. 由 GitHub Actions 构建并部署。

常用参数：

```powershell
.\publish.ps1 -DryRun                 # 只构建和检查，不提交、不推送
.\publish.ps1 -NoPush                 # 构建 + 本地提交，不推送
.\publish.ps1 -Message "post: 新文章"  # 自定义 commit message
.\publish.ps1 -SkipBuild              # 跳过构建，提交现有文件
.\publish.ps1 -RemoteUrl "https://github.com/用户名/仓库.git"
```

`publish.cmd` 只是带暂停提示的包装器，方便双击运行。

## 目录结构

```text
.
├─ content/
│  ├─ posts/              # 文章 Markdown
│  └─ pages/              # 独立页面（关于）
├─ src/
│  └─ assets/             # CSS、JS、图标、封面图
├─ scripts/
│  ├─ build.mjs           # 静态生成器
│  ├─ dev.mjs             # 本地预览 + 自动刷新
│  ├─ check.mjs           # 产物检查
│  ├─ new-post.mjs        # 新建文章
│  └─ lib/
│     ├─ markdown.mjs     # 轻量 Markdown 渲染器
│     ├─ templates.mjs    # 页面模板
│     └─ utils.mjs
├─ dist/                  # 构建产物（Git 忽略）
├─ site.config.json       # 站点配置
├─ publish.ps1 / .cmd     # 一键发布
├─ dev.cmd                # 一键预览
└─ new-post.cmd           # 一键新建文章
```

## 部署原理

```text
本地 publish.cmd
      │
      ├─ node scripts/build.mjs  →  dist/
      ├─ node scripts/check.mjs  →  链接检查
      └─ git push origin main
                    │
                    ▼
        GitHub Actions (deploy.yml)
                    │
                    ├─ npm run build
                    ├─ npm run check
                    └─ upload-pages-artifact + deploy-pages
                    │
                    ▼
              GitHub Pages
```

构建过程没有 `npm install`，也没有第三方依赖。GitHub Actions 只需要 Node.js 22 和仓库里的文件。

## 常见问题

**网站显示 404 / Actions 没有部署**

检查 **Settings → Pages → Source** 是否选择了 **GitHub Actions**。首次修改后，去 **Actions** 页面手动运行一次 `Deploy blog to GitHub Pages`。

**推送时提示 403 / Authentication failed**

重新登录 GitHub。Windows 上通常使用 Git Credential Manager：

```powershell
git config --global credential.helper manager
git push -u origin main
```

**`publish.cmd` 一闪而过**

在终端中运行 `.\publish.ps1` 查看详细错误。也可能是 PowerShell 执行策略限制，`publish.cmd` 已经使用 `-ExecutionPolicy Bypass` 处理。

**提示找不到 Node.js 或 Git**

安装 [Node.js LTS](https://nodejs.org/) 和 [Git for Windows](https://git-scm.com/download/win)。安装后重新打开终端，确保 `node -v`、`git --version` 能正常输出。

**新文章没有出现**

检查 front matter 里的 `draft` 是否为 `true`，以及 `date` 格式是否为 `YYYY-MM-DD`。

**中文标签的 URL 很长**

这是正常的 URL 编码，浏览器会自动解码。不影响检索、RSS 或 SEO。

**想改用自定义域名或换用户名**

修改 `site.config.json` 的 `url`；如果仓库路径也变了，同时修改 `basePath`。换用户名后 GitHub 仓库地址也会变，记得更新 remote：

```powershell
git remote set-url origin https://github.com/新用户名/新用户名.github.io.git
```

## 一点说明

代码部分可以自由修改和使用。`content/` 里的示例文章仅用于展示排版，发布前请替换成你自己的内容。

这个博客没有评论区、没有统计脚本、没有第三方字体和 CDN。它只是几张静态页面，和一些愿意被慢慢读到的字。

保持好奇，保持笨拙。
