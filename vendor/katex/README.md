# KaTeX vendor files

This directory vendors the browser distribution of [KaTeX](https://katex.org/) **0.16.22**, so the blog can render formulas at build time without an npm install or a CDN.

Included from the npm package `katex@0.16.22`:

- `katex.mjs` — self-contained ES module used by `scripts/lib/math.mjs`
- `katex.min.css` — copied to `dist/assets/katex.min.css`
- `fonts/*.woff2` — copied to `dist/assets/fonts/`; modern browsers use these
- `LICENSE` — KaTeX's MIT license

The CSS also lists `.woff` and `.ttf` fallbacks; they are intentionally omitted to keep the repository small. Browsers that do not support WOFF2 will fall back to system math fonts, but the formulas still render.

Source: <https://www.npmjs.com/package/katex/v/0.16.22>
