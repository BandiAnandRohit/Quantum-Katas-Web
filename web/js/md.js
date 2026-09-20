import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import katex from "katex";
import renderMathInElement from "katex/contrib/auto-render";

// Macros shared by every render (two tutorials define \ket / \bra through \renewcommand cells).
const MACROS = {
  "\\rm": "\\mathrm",
  "\\lt": "<",
  "\\ket": "\\left\\lvert#1\\right\\rangle",
  "\\bra": "\\left\\langle#1\\right\\rvert",
};

const marked = new Marked({ gfm: true, breaks: false });
marked.use(
  markedKatex({
    throwOnError: false,
    strict: "ignore",
    nonStandard: true,
    output: "html",
    macros: MACROS,
  }),
);

const slug = (s) => s.replace(/<[^>]+>/g, "").trim().replace(/\s/g, "-");

marked.use({
  renderer: {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${escAttr(slug(token.text))}">${inner}</h${token.depth}>\n`;
    },
    link(token) {
      const inner = this.parser.parseInline(token.tokens);
      const href = token.href || "";
      const title = token.title ? ` title="${escAttr(token.title)}"` : "";
      if (/^https?:/i.test(href)) return `<a href="${escAttr(href)}"${title} target="_blank" rel="noopener noreferrer">${inner}</a>`;
      return `<a href="${escAttr(href)}"${title}>${inner}</a>`;
    },
  },
});

function escAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// The notebooks contain display math written as `$$ ... $$` over several lines with content on the same
// lines as the delimiters, and inline math that wraps across lines. The markdown extension only accepts
// the canonical forms, so those are normalised first (fenced code is left alone).
const SOURCE_FIXES = [
  // typos in the upstream notebooks (unbalanced $ delimiters)
  ["\\rangle$$\\langle1|$", "\\rangle\\langle1|$"],
  [" and |111\\rangle$", " and $|111\\rangle$"],
  [", and |011\\rangle$", ", and $|011\\rangle$"],
  ["evaluate the effect of each term independently$.", "evaluate the effect of each term independently."],
];

export function normalizeMath(text) {
  for (const [a, b] of SOURCE_FIXES) if (text.includes(a)) text = text.split(a).join(b);
  const parts = text.split(/(```[\s\S]*?```)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/\$\$([\s\S]+?)\$\$/g, (all, body) => (body.includes("\n") ? `\n\n$$\n${body.trim()}\n$$\n\n` : all))
      .replace(/(?<![$\\])\$(?!\$)([^$\n]+\n[^$\n]+(?:\n[^$\n]+)?)(?<!\$)\$(?!\$)/g, (all, body) => "$" + body.replace(/\s*\n\s*/g, " ") + "$");
  }
  return parts.join("");
}

export function renderMarkdown(text) {
  return marked.parse(normalizeMath(text));
}

/** Second pass over rendered markdown: typesets math the markdown extension cannot see (raw HTML blocks,
 *  align/equation environments, tables inside <details>, ...). */
export function typeset(el) {
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\begin{equation}", right: "\\end{equation}", display: true },
        { left: "\\begin{align}", right: "\\end{align}", display: true },
        { left: "\\begin{align*}", right: "\\end{align*}", display: true },
        { left: "$", right: "$", display: false },
      ],
      ignoredClasses: ["katex", "katex-display"],
      throwOnError: false,
    strict: "ignore",
      macros: MACROS,
    });
  } catch (e) {
    /* leave the text as is */
  }
}

/** Renders a LaTeX string (with or without $ delimiters) into an element. */
export function renderLatexInto(el, latex, display = true) {
  const tex = latex.trim().replace(/^\$+|\$+$/g, "").trim();
  try {
    katex.render(tex, el, { displayMode: display, throwOnError: false, strict: "ignore" });
  } catch (e) {
    el.textContent = tex;
  }
}
