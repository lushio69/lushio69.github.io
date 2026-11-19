# Liii STEM 一键发布到博客（blog-publish 插件）

把 Liii STEM 里的文档直接导出成 Markdown 并发布到你的 GitHub Pages 博客仓库
`lushio69.github.io`。

```
Liii STEM 文档(.tmu)
  → stree 交给 goldfish 子进程
  → (liii blog-publish) 渲染 Markdown（标题/公式/列表/表格/代码块/图片）
  → 写 content/posts/<slug>.md
  → 调用 publish.cmd（构建 + 检查 + 提交 + 推送）
  → GitHub Actions 自动部署到 https://lushio69.github.io
```

## 安装（已装好，重建时按此步骤）

插件是「用户级插件」，不修改 Liii STEM 安装目录：

```text
%APPDATA%\liiilabs\plugins\blog-publish\
├─ progs\init-blog-publish.scm     入口：加载命令层 + 挂菜单
├─ progs\blog-publish-mod.scm      命令层（texmacs-module）
└─ goldfish\liii\blog-publish.scm  Markdown 渲染库（Goldfish/s7）
```

源码副本在仓库的 `tools/liii-blog-publish/`，改完后复制到上面的目录，重启 Liii STEM 即生效。

## 用法

重启后在「工具」菜单里选 **Publish to blog**：

- **Publish current document**：导出并发布（会弹出构建窗口，完成推送后 1–2 分钟上线）
- **Export only (no push)**：只导出到 `content/posts/`，不推送

也可以在命令面板/脚本里调用：

```scheme
(blog-publish-current-buffer)
(blog-publish-current-buffer "高考物理：从零到满分" "物理学" '("高考" "力学"))
(blog-export-current-buffer)
```

不传标题时，取文档的首个章节标题（`chapter*`），再退回文件名。

## 写文档的约定

| 文档里的写法 | 导出的 Markdown |
| --- | --- |
| `chapter*` / `section*` / `subsection*` | `#` / `##` / `###` |
| 正文段落 | 普通段落 |
| 粗体 / 斜体 / 下划线 | `**粗体**` / `*斜体*` / `<u>…</u>` |
| 行内公式 | `$latex$` |
| 独立公式（equation*） | `$$latex$$` |
| 无序列表 / 有序列表 | `- 项目` |
| `tformat` 表格 | Markdown 表格 |
| 代码块（`python-code`/`cpp-code`/`bash-code`/`scm-code`/`code`） | 带语言标记的围栏代码块 |
| `big-figure` + 图片 | `![](路径)` + 图注 |

> 列表项的分隔符是 Liii STEM 的 `item` 标记，导出时自动识别。
> 公式用 TeXmacs 数学编辑器输入即可，导出为 LaTeX 交给博客的 KaTeX 渲染。

## 配置

可选地创建 `%APPDATA%\blog-publish\config.json` 覆盖默认值：

```json
{
  "siteDir": "D:/DSH/Workspaces/Projects/lushio69.github.io",
  "postsDir": "content/posts",
  "defaultCategory": "随笔",
  "publishScript": "publish.cmd"
}
```

## 排错

- 菜单里没出现：确认 `%APPDATA%\liiilabs\plugins\blog-publish\` 下三个文件都在，重启 Liii STEM。
- 提示 `goldfish connection failed`：说明插件的 goldfish 会话没起来，重启 Liii STEM。
- 导出成功但没推送：看 `publish.cmd` 弹出的窗口，通常是 `git push` 需要重新登录 GitHub。
- 想改标题/分类：用带参数的 `(blog-publish-current-buffer "标题" "分类" '("标签"))`。

## 已知限制

- 表格的列对齐、合并单元格不保留（Markdown 表格本身不支持合并）。
- 复杂排版（分栏、浮动体定位、自定义字体）不保留，按语义导出。
- 图片请使用相对路径或站点 `assets/` 下的路径，导出时原样写入 Markdown。
