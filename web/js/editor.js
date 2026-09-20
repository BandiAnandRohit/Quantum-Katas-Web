// CodeMirror 6 editors + static syntax highlighting (Q# and Python).
import { EditorState, StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection, Decoration, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags, tagHighlighter, highlightCode } from "@lezer/highlight";
import { python } from "@codemirror/legacy-modes/mode/python";

// ---- Q# tokenizer -------------------------------------------------------------------------------
const KEYWORDS = new Set(
  ("namespace open import export as operation function newtype struct internal body adjoint controlled auto self invert distribute intrinsic is if elif else for in while repeat until fixup return fail let mutable set use borrow using borrowing within apply not and or new w/ w/=").split(" "),
);
const TYPES = new Set(["Int", "BigInt", "Double", "Bool", "Qubit", "Result", "Pauli", "Unit", "String", "Range", "Complex", "Adj", "Ctl"]);
const ATOMS = new Set(["true", "false", "Zero", "One", "PauliI", "PauliX", "PauliY", "PauliZ"]);

const qsharpMode = {
  name: "qsharp",
  startState: () => ({ inBlock: false }),
  token(stream, state) {
    if (state.inBlock) {
      while (!stream.eol()) {
        if (stream.match("*/")) { state.inBlock = false; break; }
        stream.next();
      }
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.match("/*")) { state.inBlock = true; return qsharpMode.token(stream, state); }
    if (stream.match(/^\$?"/)) {
      let esc = false;
      while (!stream.eol()) {
        const c = stream.next();
        if (c === '"' && !esc) break;
        esc = !esc && c === "\\";
      }
      return "string";
    }
    if (stream.match(/^0[xX][0-9a-fA-F]+L?|^0[bB][01]+L?|^\d+\.\d*([eE][+-]?\d+)?|^\.\d+|^\d+([eE][+-]?\d+)?L?/)) return "number";
    if (stream.match(/^@[A-Za-z_]\w*/)) return "meta";
    if (stream.match(/^'[A-Za-z_]\w*/)) return "typeName";
    if (stream.match(/^[A-Za-z_][\w.]*/)) {
      const w = stream.current();
      if (KEYWORDS.has(w)) return "keyword";
      if (TYPES.has(w)) return "typeName";
      if (ATOMS.has(w)) return "atom";
      if (/^[A-Z]/.test(w.split(".").pop())) return stream.peek() === "(" || stream.peek() === "<" ? "def" : "variableName.special";
      return "variableName";
    }
    if (stream.match(/^(\.\.\.|\.\.|w\/=?|<-|=>|->|==|!=|<=|>=|<<<|>>>|&&&|\|\|\||\^\^\^|~~~|[-+*/%^&|<>=!?:~])/)) return "operator";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "//", block: { open: "/*", close: "*/" } }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
};

const qsharp = StreamLanguage.define(qsharpMode);
const pythonLang = StreamLanguage.define(python);

const highlighter = tagHighlighter([
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.keyword, class: "tok-kw" },
  { tag: tags.string, class: "tok-str" },
  { tag: tags.number, class: "tok-num" },
  { tag: tags.typeName, class: "tok-type" },
  { tag: tags.atom, class: "tok-atom" },
  { tag: tags.bool, class: "tok-atom" },
  { tag: tags.meta, class: "tok-meta" },
  { tag: tags.definition(tags.variableName), class: "tok-fn" },
  { tag: tags.special(tags.variableName), class: "tok-fn" },
  { tag: tags.operator, class: "tok-op" },
  { tag: tags.self, class: "tok-kw" },
  { tag: tags.function(tags.variableName), class: "tok-fn" },
  { tag: tags.className, class: "tok-type" },
]);

const langFor = (lang) => (lang === "python" ? pythonLang : qsharp);

/** Static (read-only) highlighted code as an HTML string. */
export function highlightToHtml(code, lang) {
  const language = langFor(lang);
  const tree = language.parser.parse(code);
  let html = "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  highlightCode(
    code,
    tree,
    highlighter,
    (text, cls) => { html += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text); },
    () => { html += "\n"; },
  );
  return html;
}

// ---- error line decorations ---------------------------------------------------------------------
const setErrors = StateEffect.define();
const errorField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setErrors)) {
        const b = new RangeSetBuilder();
        const seen = new Set();
        const items = [...e.value].sort((a, b2) => a.line - b2.line);
        for (const it of items) {
          if (it.line < 1 || it.line > tr.state.doc.lines || seen.has(it.line)) continue;
          seen.add(it.line);
          const line = tr.state.doc.line(it.line);
          b.add(line.from, line.from, Decoration.line({ class: "cm-errline", attributes: { title: it.message || "" } }));
        }
        deco = b.finish();
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * opts: { doc, lang, readOnly, onRun, onChange, onEdit, minHeight }
 * returns { view, getValue, setValue, setErrors(lines), clearErrors, focus, destroy }
 */
export function createEditor(parent, opts = {}) {
  const extensions = [
    errorField,
    syntaxHighlighting(highlighter),
    langFor(opts.lang),
    EditorView.lineWrapping,
    indentUnit.of("    "),
    EditorState.tabSize.of(4),
    drawSelection(),
    bracketMatching(),
  ];
  if (!opts.readOnly) {
    extensions.push(
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      indentOnInput(),
      closeBrackets(),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            if (opts.onRun) opts.onRun();
            return true;
          },
        },
        indentWithTab,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          if (opts.onChange) opts.onChange(u.state.doc.toString());
        }
      }),
    );
  } else {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false), lineNumbers());
  }
  const view = new EditorView({ state: EditorState.create({ doc: opts.doc || "", extensions }), parent });
  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, effects: setErrors.of([]) });
    },
    setErrors(items) {
      view.dispatch({ effects: setErrors.of(items) });
    },
    clearErrors() {
      view.dispatch({ effects: setErrors.of([]) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
