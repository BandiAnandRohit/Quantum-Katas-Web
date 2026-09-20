// Jupyter notebook (.ipynb) -> lesson blocks
import fs from "fs";
import path from "path";
import { snippetItemNames } from "../src/qs.mjs";

export function readNotebook(file) {
  const nb = JSON.parse(fs.readFileSync(file, "utf8"));
  const lang = nb.metadata?.kernelspec?.name === "python3" ? "python" : "qsharp";
  const cells = nb.cells.map((c) => ({
    type: c.cell_type,
    source: Array.isArray(c.source) ? c.source.join("") : c.source,
    outputs: c.outputs || [],
  }));
  return { lang, cells };
}

// ---- helpers ---------------------------------------------------------------------------------

export function plainHeading(md) {
  // "### <span style="color:blue">Exercise 3</span>: Foo $|0\rangle$" -> "exercise 3: foo |0>"
  return md
    .replace(/<[^>]+>/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const TASK_HEAD = /^\s*#{1,4}\s*(<span[^>]*>)?\s*(Task|Exercise|Demo)\b/i;

export function isTaskHeading(md) {
  return TASK_HEAD.test(md);
}

const RETURN_LINK = /^\s*\[Return to/i;
const SOLUTION_HEAD = /^\s*#{1,4}\s*Solution\b/i;
const HELP_LINK = /Can't come up with a solution\?|Can’t come up with a solution\?/i;

/** Magic line of a code cell, e.g. "%kata T101_Foo". Returns {magic, arg, body}. */
export function parseMagic(src) {
  const m = /^\s*(%\w+)[ \t]*([^\n]*)\n?([\s\S]*)$/.exec(src);
  if (!m) return { magic: null, arg: "", body: src };
  return { magic: m[1], arg: m[2].trim(), body: m[3].replace(/^\n+/, "") };
}

// ---- workbook --------------------------------------------------------------------------------

/**
 * Parse workbook notebooks into:
 *   byTest:    Map testName -> { blocks, solutionCode }
 *   byHeading: Map normalized heading -> { blocks }   (for exercises without code)
 */
export function parseWorkbooks(files) {
  const byTest = new Map();
  const byHeading = new Map();
  for (const f of files) {
    const { cells } = readNotebook(f);
    let heading = null; // normalized task heading
    const orphan = []; // helper cells from segments that have no test of their own (used by later tasks)
    let i = 0;
    while (i < cells.length) {
      const c = cells[i];
      if (c.type === "markdown" && isTaskHeading(c.source)) {
        heading = plainHeading(c.source.split("\n")[0]);
        i++;
        continue;
      }
      if (c.type === "markdown" && SOLUTION_HEAD.test(c.source)) {
        // collect the segment
        const blocks = [];
        const tests = [];
        const helpers = [];
        let j = i + 1;
        // the "### Solution" heading may itself carry text after the first line
        const rest = c.source.replace(SOLUTION_HEAD, "").replace(/^[^\n]*\n?/, "").trim();
        if (rest) blocks.push({ t: "md", text: rest });
        for (; j < cells.length; j++) {
          const d = cells[j];
          if (d.type === "markdown") {
            if (RETURN_LINK.test(d.source)) { j++; break; }
            if (isTaskHeading(d.source) || /^\s*#{1,2}\s/.test(d.source) && !SOLUTION_HEAD.test(d.source)) break;
            if (SOLUTION_HEAD.test(d.source)) { // e.g. "### Solution 2" style: treat as inline heading
              blocks.push({ t: "md", text: d.source });
              continue;
            }
            blocks.push({ t: "md", text: d.source });
          } else {
            const { magic, arg, body } = parseMagic(d.source);
            if (magic === "%config") continue;
            if (magic === "%kata") {
              const name = arg.split(/\s+/)[0];
              const code = body;
              blocks.push({ t: "code", lang: "qsharp", code, static: true, test: name });
              const pre = [...orphan, ...helpers];
              tests.push({ name, code: pre.length ? pre.join("\n") + "\n" + code : code, plain: code });
            } else if (magic === "%simulate" || magic === "%trace" || magic === "%debug" || magic === "%azure") {
              blocks.push({ t: "code", lang: "qsharp", code: d.source, static: true });
            } else {
              const isPy = /^\s*(def |import |from |@exercise)/m.test(d.source);
              blocks.push({ t: "code", lang: isPy ? "python" : "qsharp", code: d.source, static: true });
              if (!isPy && !magic) helpers.push(d.source);
            }
          }
        }
        if (!tests.length) orphan.push(...helpers);
        for (const t of tests) {
          if (!byTest.has(t.name)) byTest.set(t.name, { blocks, tests: [], plain: [] });
          byTest.get(t.name).tests.push(t.code);
          byTest.get(t.name).plain.push(t.plain);
        }
        if (heading && !byHeading.has(heading)) byHeading.set(heading, { blocks, tests: tests.map((t) => t.code) });
        i = j;
        continue;
      }
      i++;
    }
  }
  return { byTest, byHeading };
}

// ---- main notebook conversion ------------------------------------------------------------------

/**
 * Convert one lesson notebook to blocks.
 * opts.workbook: result of parseWorkbooks; opts.emitOutputs: keep stored outputs for code cells.
 */
export function convertNotebook(nbFile, opts = {}) {
  const { lang, cells } = readNotebook(nbFile);
  const wb = opts.workbook || { byTest: new Map(), byHeading: new Map() };
  const blocks = [];
  const tasks = [];
  let pendingHeading = null;
  let pendingSolution = null; // solution for an exercise heading that had no code

  const flushPending = () => {
    if (pendingSolution) {
      blocks.push({ t: "solution", blocks: pendingSolution.blocks });
      pendingSolution = null;
    }
  };

  let lastPlainCode = null; // last plain code block (for %simulate merging)

  for (let idx = 0; idx < cells.length; idx++) {
    const c = cells[idx];
    if (c.type === "markdown") {
      if (HELP_LINK.test(c.source) && c.source.length < 500) continue; // replaced by our solution button
      if (isTaskHeading(c.source)) {
        flushPending();
        pendingHeading = plainHeading(c.source.split("\n")[0]);
        if (wb.byHeading.has(pendingHeading)) {
          const seg = wb.byHeading.get(pendingHeading);
          // only used if no %kata cell claims it before the next heading
          pendingSolution = seg.tests.length === 0 ? seg : null;
        }
      } else if (/^\s*#{1,2}\s/.test(c.source)) {
        flushPending();
      }
      blocks.push({ t: "md", text: c.source });
      lastPlainCode = null;
      continue;
    }
    // ---- code cell
    const src = c.source;
    if (lang === "python") {
      blocks.push(pythonBlock(src, c, opts));
      continue;
    }
    const { magic, arg, body } = parseMagic(src);
    if (magic === "%kata") {
      const name = arg.split(/\s+/)[0];
      const seg = wb.byTest.get(name);
      const prev = tasks.find((t) => t.id === name);
      if (prev) {
        // several cells for one test (e.g. Alice's and Bob's strategy): one combined task
        prev.parts = (prev.parts || 1) + 1;
        prev.code = prev.code.replace(/\s+$/, "") + "\n\n" + body.replace(/\s+$/, "") + "\n";
        for (const n of snippetItemNames(body)) if (!prev.names.includes(n)) prev.names.push(n);
        if (seg && seg.tests.length >= prev.parts) {
          prev.solutionCode = [seg.tests[0], ...seg.plain.slice(1, prev.parts)].join("\n\n");
          prev.altSolutionCodes = seg.tests.slice(prev.parts);
        }
        continue;
      }
      const task = {
        t: "task",
        id: name,
        code: body.replace(/\s+$/, "") + "\n",
        names: snippetItemNames(body),
        solution: seg ? seg.blocks : null,
        solutionCode: seg ? seg.tests[0] : null,
        altSolutionCodes: seg ? seg.tests.slice(1) : [],
      };
      pendingSolution = null;
      blocks.push(task);
      tasks.push(task);
      lastPlainCode = null;
      if (seg) {
        // make sure the same workbook segment is not attached twice under a heading
      }
      continue;
    }
    if (magic === "%simulate") {
      // "%simulate Op a=1 b=2"  (may also be "%simulate Op" only)
      const parts = arg.split(/\s+/);
      const entry = parts[0];
      const args = {};
      for (const p of parts.slice(1)) {
        const m = /^(\w+)=(.*)$/.exec(p);
        if (m) args[m[1]] = m[2];
      }
      if (lastPlainCode && !lastPlainCode.entry) {
        lastPlainCode.entry = entry;
        lastPlainCode.args = args;
      } else {
        blocks.push({ t: "code", lang: "qsharp", code: `// (defined earlier in this lesson)\n`, entry, args, refOnly: true });
      }
      continue;
    }
    if (magic === "%azure" || magic === "%debug" || magic === "%trace" || magic === "%lsmagic") {
      blocks.push({ t: "code", lang: "qsharp", code: src, static: true, note: magicNote(magic) });
      lastPlainCode = null;
      continue;
    }
    if (magic) {
      blocks.push({ t: "code", lang: "qsharp", code: src, static: true });
      continue;
    }
    // plain Q# snippet
    const blk = { t: "code", lang: "qsharp", code: src.replace(/\s+$/, "") + "\n" };
    blocks.push(blk);
    lastPlainCode = blk;
  }
  flushPending();
  return { lang, blocks, tasks };
}

function magicNote(m) {
  if (m === "%azure") return "This cell submits a job to Azure Quantum hardware/simulators and cannot run in the browser.";
  if (m === "%debug") return "The interactive debugger from Jupyter is not available in the browser version.";
  if (m === "%trace") return "The circuit trace magic from Jupyter is not available in the browser version.";
  return "";
}

function pythonBlock(src, cell, opts) {
  const isExercise = /^\s*@exercise\b/m.test(src);
  const blk = { t: "code", lang: "python", code: src.replace(/\s+$/, "") + "\n" };
  if (isExercise) blk.exercise = (/def\s+(\w+)\s*\(/.exec(src) || [])[1];
  if (opts.emitOutputs) blk.outputs = simplifyOutputs(cell.outputs, opts);
  return blk;
}

/** Keep text / png / html outputs from a code cell. Images are handed to opts.saveImage(base64, ext) -> url */
export function simplifyOutputs(outputs, opts = {}) {
  const res = [];
  for (const o of outputs || []) {
    if (o.output_type === "stream") {
      res.push({ k: "text", v: Array.isArray(o.text) ? o.text.join("") : o.text });
    } else if (o.output_type === "error") {
      res.push({ k: "err", v: (o.ename || "") + ": " + (o.evalue || "") });
    } else if (o.data) {
      const d = o.data;
      if (d["image/png"] && opts.saveImage) {
        res.push({ k: "img", v: opts.saveImage(Array.isArray(d["image/png"]) ? d["image/png"].join("") : d["image/png"], "png") });
      } else if (d["image/svg+xml"]) {
        res.push({ k: "svg", v: Array.isArray(d["image/svg+xml"]) ? d["image/svg+xml"].join("") : d["image/svg+xml"] });
      } else if (d["text/html"]) {
        res.push({ k: "html", v: Array.isArray(d["text/html"]) ? d["text/html"].join("") : d["text/html"] });
      } else if (d["text/plain"]) {
        res.push({ k: "text", v: Array.isArray(d["text/plain"]) ? d["text/plain"].join("") : d["text/plain"] });
      }
    }
  }
  return res;
}

export function listWorkbooks(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^Workbook_.*\.ipynb$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}
