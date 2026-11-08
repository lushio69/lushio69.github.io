import katex from '../../vendor/katex/katex.mjs';
import { escapeHtml } from './utils.mjs';

const MACROS = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\E': '\\mathbb{E}',
  '\\Var': '\\operatorname{Var}',
  '\\Cov': '\\operatorname{Cov}',
  '\\dd': '\\mathrm{d}',
  '\\abs': '\\left|#1\\right|',
  '\\norm': '\\left\\lVert#1\\right\\rVert',
  '\\inner': '\\left\\langle #1,\\,#2\\right\\rangle',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\argmin': '\\operatorname*{arg\\,min}',
};

export function renderMath(tex, displayMode = false) {
  const source = String(tex).trim();
  if (!source) return '';
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
      macros: MACROS,
      errorColor: '#b4452c',
    });
  } catch (error) {
    console.warn(`  ! KaTeX could not render: ${source.slice(0, 80)}`);
    return `<span class="math-error" title="${escapeHtml(error.message)}">${escapeHtml(source)}</span>`;
  }
}
