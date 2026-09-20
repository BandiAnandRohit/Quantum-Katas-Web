// Shared Q# source helpers (used by the build pipeline AND in the browser).
// Everything here is text-level and comment/string aware. Line counts are always preserved
// so that compiler line numbers still point at the learner's code.

/** Returns a Uint8Array: 1 where the character at that index is real code (not comment / string). */
export function codeMask(src) {
  const n = src.length;
  const mask = new Uint8Array(n);
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else if (c === '"') {
      i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
    } else {
      mask[i] = 1;
      i++;
    }
  }
  return mask;
}

/** Index of the bracket matching the opening bracket at `open` (code chars only), or -1. */
export function matchBracket(src, mask, open) {
  const o = src[open];
  const close = { "{": "}", "(": ")", "[": "]" }[o];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (!mask[i]) continue;
    const c = src[i];
    if (c === o) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipWs(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

// ---------------------------------------------------------------------------------------------
// Legacy-syntax adapter
// ---------------------------------------------------------------------------------------------

/**
 * Old QDK (0.x) Q# code -> the modern Q# compiler that runs in the browser.
 *  1. `repeat { .. } until (c) fixup { .. }`: in the old language variables declared inside the
 *     repeat body were visible in `until` and `fixup`. We rewrite to an equivalent `while` loop.
 *  2. `MeasureInteger(LittleEndian(x))`, `ApplyXorInPlace(v, LittleEndian(x))`: these took a
 *     LittleEndian wrapper in the old library, the modern ones take plain `Qubit[]`.
 */
export function adaptLegacy(src) {
  src = src.replace(/^\uFEFF/, "");
  src = rewriteRepeat(src);
  src = rewriteForParens(src);
  src = rewriteSteppedRanges(src);
  src = stripExplicitTypeArgs(src);
  src = rewriteEndianCalls(src);
  src = rewriteDumpCalls(src);
  src = insertReleaseChecks(src);
  return src;
}

function rewriteRepeat(src) {
  let counter = 0;
  for (;;) {
    const mask = codeMask(src);
    // find the LAST `repeat {` in code (so nested repeats are rewritten inner-first)
    let found = -1;
    const re = /\brepeat\b/g;
    let m;
    while ((m = re.exec(src))) {
      if (!mask[m.index]) continue;
      const brace = skipWs(src, m.index + 6);
      if (src[brace] === "{" && mask[brace]) found = m.index;
    }
    if (found < 0) break;
    const brace = skipWs(src, found + 6);
    const bodyEnd = matchBracket(src, mask, brace);
    if (bodyEnd < 0) break;
    let p = skipWs(src, bodyEnd + 1);
    if (!/^until\b/.test(src.slice(p, p + 5))) break;
    p += 5;
    p = skipWs(src, p);
    // condition: up to a top-level `;` or the `fixup` keyword
    let depth = 0;
    let q = p;
    let condEnd = -1;
    let kind = "";
    for (; q < src.length; q++) {
      if (!mask[q]) continue;
      const c = src[q];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (depth === 0 && c === ";") { condEnd = q; kind = ";"; break; }
      else if (depth === 0 && /^fixup\b/.test(src.slice(q, q + 6)) && (q === 0 || /\W/.test(src[q - 1]))) { condEnd = q; kind = "fixup"; break; }
    }
    if (condEnd < 0) break;
    const cond = stripComments(src.slice(p, condEnd)).trim();
    const name = `__rep${++counter}`;
    const head = `mutable ${name} = false; while not ${name} {`;
    let tail;
    let end;
    if (kind === ";") {
      tail = `set ${name} = ${cond}; }`;
      end = condEnd + 1;
    } else {
      const fb = skipWs(src, condEnd + 5);
      const fEnd = matchBracket(src, mask, fb);
      if (fEnd < 0) break;
      const fix = src.slice(fb + 1, fEnd);
      tail = `set ${name} = ${cond}; if not ${name} {${fix}} }`;
      end = fEnd + 1;
    }
    // keep line count: text between `}` (body end) and `end` may contain newlines
    const removed = src.slice(bodyEnd, end);
    const nl = (removed.match(/\n/g) || []).length;
    const fixNl = kind === "fixup" ? 0 : 0;
    void fixNl;
    // the replaced tail must keep the same number of newlines as what it replaced
    const replacedTail = kind === ";" ? tail : tail;
    const padded = padNewlines(replacedTail, removed, nl);
    src = src.slice(0, found) + head + src.slice(brace + 1, bodyEnd) + padded + src.slice(end);
  }
  return src;
}

// Removes line and block comments (string aware); newlines inside comments are kept.
export function stripComments(src) {
  const mask = codeMask(src);
  let out = "";
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    if (mask[i]) { out += src[i]; continue; }
    // not code: either comment or string content. Decide by scanning: strings start with a quote.
    if (src[i] === '"') {
      // copy the whole string literal
      let j = i + 1;
      while (j < src.length && src[j] !== '"') { if (src[j] === "\\") j++; j++; }
      out += src.slice(i, j + 1);
      i = j;
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < src.length && !(src[j] === "*" && src[j + 1] === "/")) { if (src[j] === "\n") out += "\n"; j++; }
      i = j + 1;
      continue;
    }
  }
  void inStr;
  return out;
}

// `for (i in 0 .. n) { }`  ->  `for i in 0 .. n { }`
function rewriteForParens(src) {
  let from = 0;
  for (;;) {
    const mask = codeMask(src);
    const re = /\bfor\s*\(/g;
    re.lastIndex = from;
    let m;
    let hit = null;
    while ((m = re.exec(src))) {
      if (mask[m.index]) { hit = m; break; }
    }
    if (!hit) break;
    const open = src.indexOf("(", hit.index);
    const close = matchBracket(src, mask, open);
    if (close < 0) break;
    const after = skipWs(src, close + 1);
    const inner = src.slice(open + 1, close);
    const innerMask = codeMask(inner);
    // does the parenthesised group contain a top-level ` in `?
    let depth = 0;
    let hasIn = false;
    for (let i = 0; i < inner.length; i++) {
      if (!innerMask[i]) continue;
      const c = inner[i];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (depth === 0 && /^in\b/.test(inner.slice(i, i + 3)) && (i === 0 || /\s/.test(inner[i - 1]))) { hasIn = true; break; }
    }
    if (hasIn && src[after] === "{") {
      src = src.slice(0, open) + " " + inner + " " + src.slice(close + 1);
      from = hit.index + 3;
    } else {
      from = hit.index + 3;
    }
  }
  return src;
}

// Explicit type arguments in expressions (`Mapped(Fst<Int, Bool>, xs)`) are not accepted by the modern
// compiler, which infers them.
function stripExplicitTypeArgs(src) {
  const mask = codeMask(src);
  const re = /\b([A-Z]\w*)<([^<>'=;{}]*(?:\([^()]*\)[^<>'=;{}]*)*)>(?=\s*[,)(])/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (!mask[m.index]) continue;
    if (/(?:function|operation|newtype|struct)\s+$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
    if (!/^[\w\[\]\s,()+\-]+$/.test(m[2]) || !/[A-Z]/.test(m[2])) continue;
    out += src.slice(last, m.index) + m[1];
    last = m.index + m[0].length;
  }
  return out + src.slice(last);
}

// `for i in a..s..b` with |s| > 1 and an empty range: the automatically generated adjoint of such a loop
// reverses the range with truncating integer division and wrongly runs one iteration. We wrap explicit
// stepped ranges into a helper that normalises empty ranges.
function rewriteSteppedRanges(src) {
  let from = 0;
  for (;;) {
    const mask = codeMask(src);
    const re = /\bfor\s+/g;
    re.lastIndex = from;
    let m;
    let hit = null;
    while ((m = re.exec(src))) {
      if (mask[m.index]) { hit = m; break; }
    }
    if (!hit) break;
    from = hit.index + 3;
    // find the `{` that opens the loop body (depth 0) and the ` in `
    let depth = 0;
    let inAt = -1;
    let brace = -1;
    for (let i = hit.index + hit[0].length; i < src.length; i++) {
      if (!mask[i]) continue;
      const c = src[i];
      if (c === "{" && depth === 0) { brace = i; break; }
      if ("([".includes(c)) depth++;
      else if (")]".includes(c)) depth--;
      else if (depth === 0 && inAt < 0 && /\sin\s/.test(src.slice(i - 1, i + 3)) && /\s/.test(src[i - 1])) inAt = i;
    }
    if (brace < 0 || inAt < 0) continue;
    const exprStart = inAt + 2;
    const expr = src.slice(exprStart, brace);
    const em = codeMask(expr);
    const seps = [];
    let d = 0;
    for (let i = 0; i < expr.length; i++) {
      if (!em[i]) continue;
      const c = expr[i];
      if ("([{".includes(c)) d++;
      else if (")]}".includes(c)) d--;
      else if (d === 0 && c === "." && expr[i + 1] === ".") {
        if (expr[i + 2] === ".") { seps.length = 99; break; } // `...` open-ended range: leave alone
        seps.push(i);
        i++;
      }
    }
    if (seps.length !== 2) continue;
    const a = expr.slice(0, seps[0]).trim();
    const st = expr.slice(seps[0] + 2, seps[1]).trim();
    const b = expr.slice(seps[1] + 2).trim();
    if (!a || !st || !b) continue;
    const rep = ` Microsoft.Quantum.Diagnostics.__SafeRange(${a}, ${st}, ${b}) `;
    src = src.slice(0, exprStart) + rep + src.slice(brace);
    from = exprStart + rep.length;
  }
  return src;
}

// ---------------------------------------------------------------------------------------------
// Qubit release semantics.
// The legacy simulator let you release a qubit that had merely been *measured* (it was in a
// classical state) without resetting it: `use q = Qubit(); H(q); return M(q);`.
// The modern runtime raises an error for that. We insert, at every scope exit / return of a scope
// that allocated qubits, a check that resets classical-state qubits and reports genuinely
// non-zero (superposed / entangled) qubits.
// ---------------------------------------------------------------------------------------------
const KEYWORDS = new Set(["use", "borrow", "let", "set", "mutable", "Qubit", "in"]);

function splitTop(text, sep) {
  const mask = codeMask(text);
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!mask[i]) continue;
    const c = text[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

function stripParens(t) {
  t = t.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    const mask = codeMask(t);
    if (matchBracket(t, mask, 0) !== t.length - 1) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** From `use PATTERN = RHS` returns expressions to hand to the release check, e.g. ["[q]", "qs"]. */
function releaseTargets(lhs, rhs) {
  lhs = lhs.trim();
  rhs = rhs.trim();
  const l = stripParens(lhs);
  const r = stripParens(rhs);
  const isTuple = lhs.startsWith("(") && splitTop(l, ",").length > 1;
  if (!isTuple) {
    if (!/^[A-Za-z_]\w*$/.test(l)) return [];
    if (/^Qubit\s*\[/.test(r)) return [l];
    if (/^Qubit\s*\(\s*\)$/.test(r)) return [`[${l}]`];
    return [];
  }
  const ls = splitTop(l, ",").map((x) => x.trim());
  const rs = splitTop(r, ",").map((x) => x.trim());
  const out = [];
  ls.forEach((name, i) => {
    const rr = rs[i] || "";
    if (!/^[A-Za-z_]\w*$/.test(name)) return;
    if (/^Qubit\s*\[/.test(rr)) out.push(name);
    else if (/^Qubit\s*\(\s*\)$/.test(rr)) out.push(`[${name}]`);
  });
  return out;
}

function insertReleaseChecks(src) {
  if (!/\buse\b/.test(src)) return src;
  const mask = codeMask(src);
  const edits = []; // {start, end, text}
  const stack = [];
  let rv = 0;
  let pendingNames = null; // names from a block-form `use` waiting for its `{`
  const n = src.length;

  const callableReturnsUnit = (openIdx) => {
    // text between the previous `)` of the parameter list and `{`
    let k = openIdx - 1;
    // find the start of this signature: back to the previous `;` `{` or `}` at code level
    let start = k;
    while (start >= 0 && !(mask[start] && (src[start] === ";" || src[start] === "}" || src[start] === "{"))) start--;
    const sig = src.slice(start + 1, openIdx);
    if (!/\b(operation|function)\b/.test(sig)) return null; // not a callable body
    const m = /\)\s*:\s*([^{]*?)\s*$/.exec(sig.replace(/\bis\s+[A-Za-z+\s]+$/, "").replace(/\/\/[^\n]*/g, ""));
    if (!m) return true;
    return m[1].trim() === "Unit";
  };

  const checksFor = (names) => names.map((nm) => `Microsoft.Quantum.Diagnostics.__ReleaseCheck(${nm});`).join(" ");

  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const c = src[i];
    if (c === "{") {
      const unitInfo = callableReturnsUnit(i);
      stack.push({ open: i, names: pendingNames || [], callable: unitInfo !== null, unit: unitInfo });
      pendingNames = null;
    } else if (c === "}") {
      const sc = stack.pop();
      if (!sc || sc.names.length === 0) continue;
      // look back for the last code char
      let k = i - 1;
      while (k > sc.open && (!mask[k] || /\s/.test(src[k]))) k--;
      const last = src[k];
      const checks = checksFor(sc.names);
      if (k === sc.open || last === ";" || last === "}" || last === "{") {
        edits.push({ start: i, end: i, text: " " + checks + " " });
      } else if (sc.callable && sc.unit === false) {
        // value-returning callable whose body ends with an expression: hoist it
        let d = 0;
        let s0 = k;
        for (; s0 > sc.open; s0--) {
          if (!mask[s0]) continue;
          const ch = src[s0];
          if (ch === ")" || ch === "]") d++;
          else if (ch === "(" || ch === "[") d--;
          else if (d === 0 && (ch === ";" || ch === "{" || ch === "}")) break;
        }
        const exprStart = s0 + 1;
        const expr = src.slice(exprStart, k + 1);
        const v = `__rv${++rv}`;
        edits.push({ start: exprStart, end: k + 1, text: ` let ${v} = ${expr.trim()}; ${checks} ${v}` });
      } else {
        // Unit-valued trailing expression: make it a statement
        edits.push({ start: k + 1, end: k + 1, text: "; " + checks + " " });
      }
    } else if (c === "u" && /^use\b/.test(src.slice(i, i + 4)) && (i === 0 || /\W/.test(src[i - 1]))) {
      // parse `use LHS = RHS ;|{`
      let j = i + 3;
      let eq = -1;
      let depth = 0;
      for (; j < n; j++) {
        if (!mask[j]) continue;
        const ch = src[j];
        if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        else if (ch === "=" && depth === 0 && src[j + 1] !== "=") { eq = j; break; }
        else if (ch === ";") break;
      }
      if (eq < 0) continue;
      let e = eq + 1;
      depth = 0;
      let term = "";
      for (; e < n; e++) {
        if (!mask[e]) continue;
        const ch = src[e];
        if (ch === "{" && depth === 0) { term = "{"; break; }
        if ("([".includes(ch)) depth++;
        else if (")]".includes(ch)) depth--;
        else if (ch === ";" && depth === 0) { term = ";"; break; }
      }
      const lhs = src.slice(i + 3, eq);
      const rhs = src.slice(eq + 1, e);
      const targets = releaseTargets(lhs, rhs);
      if (targets.length === 0) { i = eq; continue; }
      if (term === "{") {
        pendingNames = targets; // block form: the block that follows owns the qubits
      } else if (stack.length) {
        stack[stack.length - 1].names.push(...targets);
      }
      i = e - 1;
    } else if (c === "r" && /^return\b/.test(src.slice(i, i + 7)) && (i === 0 || /\W/.test(src[i - 1]))) {
      const names = stack.flatMap((s) => s.names);
      if (names.length === 0) continue;
      // statement end
      let e = i + 6;
      let depth = 0;
      for (; e < n; e++) {
        if (!mask[e]) continue;
        const ch = src[e];
        if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth--;
        else if (ch === ";" && depth === 0) break;
      }
      const expr = src.slice(i + 6, e).trim();
      const checks = checksFor(names);
      if (!expr) {
        edits.push({ start: i, end: e + 1, text: `${checks} return;` });
      } else {
        const v = `__rv${++rv}`;
        edits.push({ start: i, end: e + 1, text: `let ${v} = ${expr}; ${checks} return ${v};` });
      }
      i = e;
    }
  }
  if (!edits.length) return src;
  // apply from the end; edits never overlap, but sort defensively
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const ed of edits) {
    // keep line count: an edit can swallow newlines in `expr`; re-add them after
    const removed = src.slice(ed.start, ed.end);
    const nl = (removed.match(/\n/g) || []).length;
    const ins = (ed.text.match(/\n/g) || []).length;
    src = src.slice(0, ed.start) + ed.text + "\n".repeat(Math.max(0, nl - ins)) + src.slice(ed.end);
  }
  return src;
}

function padNewlines(tail, removed, nl) {
  // Re-insert the newlines from the replaced region (`} until (c)\n fixup {\n ...}`) after the tail
  // so that line numbers after this statement do not shift.
  const tailNl = (tail.match(/\n/g) || []).length;
  return tail + "\n".repeat(Math.max(0, nl - tailNl));
}

function splitTopLevelArgs(argText) {
  const mask = codeMask(argText);
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argText.length; i++) {
    if (!mask[i]) continue;
    const c = argText[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      parts.push(argText.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(argText.slice(start));
  return parts;
}

/** If `text` (trimmed) is exactly `Name(inner)`, returns inner, else null. */
function unwrapCall(text, name) {
  const t = text.trim();
  const m = new RegExp("^" + name + "\\s*\\(").exec(t);
  if (!m) return null;
  const open = m[0].length - 1;
  const mask = codeMask(t);
  const close = matchBracket(t, mask, open);
  if (close !== t.length - 1) return null;
  return t.slice(open + 1, close);
}

// legacy `DumpRegister((), qs)` (first argument was an optional file name) -> `DumpRegister(qs)`
function rewriteDumpCalls(src) {
  const mask = codeMask(src);
  return src.replace(/\bDumpRegister\s*\(\s*\(\s*\)\s*,\s*/g, (all, off) => (mask[off] ? "DumpRegister(" : all));
}

function rewriteEndianCalls(src) {
  const rules = [
    { fn: "MeasureInteger", arg: 0 },
    { fn: "ApplyXorInPlace", arg: 1 },
  ];
  for (const { fn, arg } of rules) {
    let from = 0;
    for (;;) {
      const mask = codeMask(src);
      const re = new RegExp("\\b" + fn + "\\s*\\(", "g");
      re.lastIndex = from;
      let m;
      let hit = -1;
      while ((m = re.exec(src))) {
        if (mask[m.index]) { hit = m.index; break; }
      }
      if (hit < 0) break;
      const open = src.indexOf("(", hit);
      const close = matchBracket(src, mask, open);
      if (close < 0) break;
      const args = splitTopLevelArgs(src.slice(open + 1, close));
      let changed = false;
      if (args.length > arg) {
        const a = args[arg];
        const inner = unwrapCall(a, "LittleEndian");
        const id = a.trim();
        if (inner !== null) {
          args[arg] = a.replace(a.trim(), inner.trim());
          changed = true;
        } else if (/^[A-Za-z_]\w*$/.test(id) && new RegExp("(?:let|mutable)\\s+" + id + "\\s*=\\s*LittleEndian\\b|\\b" + id + "\\s*:\\s*LittleEndian\\b").test(src)) {
          // a variable known to hold a LittleEndian value
          args[arg] = a.replace(id, id + "!");
          changed = true;
        } else {
          const be = unwrapCall(a, "BigEndianAsLittleEndian");
          if (be !== null) {
            args[arg] = a.replace(a.trim(), `Microsoft.Quantum.Arrays.Reversed((${be.trim()})!)`);
            changed = true;
          }
        }
      }
      if (changed) {
        src = src.slice(0, open + 1) + args.join(",") + src.slice(close);
      }
      from = hit + fn.length;
    }
  }
  return src;
}

// ---------------------------------------------------------------------------------------------
// Top-level item handling
// ---------------------------------------------------------------------------------------------

/**
 * Finds top-level callables/types in a source that has ONE namespace block (or none, for snippets).
 * Returns [{kind, name, start, end}] where [start, end) covers `operation Foo ... { ... }`.
 * `depthBase` = brace depth at which items live (1 for a namespace body, 0 for snippets).
 */
export function findItems(src, depthBase = 1) {
  const mask = codeMask(src);
  const items = [];
  let depth = 0;
  const re = /\b(operation|function|newtype|struct)\s+([A-Za-z_][A-Za-z0-9_]*)/y;
  for (let i = 0; i < src.length; i++) {
    if (!mask[i]) continue;
    const c = src[i];
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; continue; }
    if (depth !== depthBase) continue;
    if (/[a-z]/.test(c) && (i === 0 || /[^A-Za-z0-9_]/.test(src[i - 1]))) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m) continue;
      const kind = m[1];
      let end;
      if (kind === "newtype") {
        // ends at the first `;` in code
        end = i;
        while (end < src.length && !(mask[end] && src[end] === ";")) end++;
        end++;
      } else {
        // callable / struct: first `{` in code, matched
        let b = i;
        while (b < src.length && !(mask[b] && src[b] === "{")) b++;
        const close = matchBracket(src, mask, b);
        end = close < 0 ? src.length : close + 1;
      }
      items.push({ kind, name: m[2], start: i, end });
      i = end - 1;
    }
  }
  return items;
}

/** Names of top-level callables/types declared in a snippet of code (no namespace). */
export function snippetItemNames(code) {
  return findItems(code, 0).map((it) => it.name);
}

/**
 * Splice `userCode` into a kata source: every top-level item named in `names` is removed and
 * `userCode` is inserted where the first of them was. Line count of the result may change (fine).
 */
export function spliceUserCode(taskSrc, names, userCode) {
  const items = findItems(taskSrc, 1).filter((it) => names.includes(it.name) && it.kind !== "newtype");
  if (items.length === 0) return null;
  // remove from last to first, keeping the first position
  let out = taskSrc;
  const first = items[0];
  for (let k = items.length - 1; k >= 1; k--) {
    out = out.slice(0, items[k].start) + out.slice(items[k].end);
  }
  out = out.slice(0, first.start) + userCode + out.slice(first.end);
  return out;
}

/** `open X;` statements in a piece of code. */
export function extractOpens(code) {
  const mask = codeMask(code);
  const opens = [];
  const re = /\bopen\s+([A-Za-z0-9_.]+)(\s+as\s+[A-Za-z0-9_.]+)?\s*;/g;
  let m;
  while ((m = re.exec(code))) if (mask[m.index]) opens.push(m[0]);
  return opens;
}

export function stripOpens(code) {
  const mask = codeMask(code);
  const re = /\bopen\s+([A-Za-z0-9_.]+)(\s+as\s+[A-Za-z0-9_.]+)?\s*;/g;
  return code.replace(re, (all, _a, _b, off) => (mask[off] ? "" : all));
}

/** Legacy tests were annotated with @Test("..."); the browser build has no test runner. */
export function stripTestAttributes(src) {
  return src.replace(/@Test\([^)]*\)/g, "");
}

export function namespaceOf(src) {
  const mask = codeMask(src);
  const re = /\bnamespace\s+([A-Za-z0-9_.]+)/g;
  let m;
  while ((m = re.exec(src))) if (mask[m.index]) return m[1];
  return null;
}

/** Namespaces that iqsharp opens automatically in every notebook cell. */
export const DEFAULT_OPENS = [
  "Microsoft.Quantum.Intrinsic",
  "Microsoft.Quantum.Canon",
];
