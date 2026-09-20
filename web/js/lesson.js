// Renders one lesson (tutorial or kata): text, runnable demos and exercises with automatic checking.
import { el, appendEvent, renderErrors } from "./out.js";
import { renderMarkdown, typeset } from "./md.js";
import { createEditor, highlightToHtml } from "./editor.js";
import { store } from "./store.js";
import { buildTaskProgram, buildSnippetProgram } from "../../src/assemble.mjs";
import { findItems } from "../../src/qs.mjs";
import SHIM from "../../shim/shim.qs";

const DRAFT_DELAY = 400;

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Editor that is only created (CodeMirror is heavy) when it scrolls near the viewport. */
function lazyEditor(host, opts, observer) {
  let ed = null;
  let value = opts.doc;
  let errors = [];
  host.classList.add("editor-host");
  const placeholder = el("pre", "code pending");
  const code = el("code");
  code.innerHTML = highlightToHtml(value, opts.lang || "qsharp");
  placeholder.appendChild(code);
  host.appendChild(placeholder);
  const api = {
    mount() {
      if (ed) return;
      host.textContent = "";
      ed = createEditor(host, {
        ...opts,
        doc: value,
        onChange: (v) => { value = v; if (opts.onChange) opts.onChange(v); },
      });
      if (errors.length) ed.setErrors(errors);
    },
    getValue: () => (ed ? ed.getValue() : value),
    setValue(v) { value = v; if (ed) ed.setValue(v); else { code.innerHTML = highlightToHtml(v, opts.lang || "qsharp"); } },
    setErrors(items) { errors = items; if (ed) ed.setErrors(items); },
    clearErrors() { errors = []; if (ed) ed.clearErrors(); },
    focus() { api.mount(); ed.focus(); },
    destroy() { if (ed) ed.destroy(); },
  };
  host.__mount = () => api.mount();
  observer.observe(host);
  return api;
}

function staticCode(code, lang) {
  const pre = el("pre", "code");
  const c = el("code");
  c.innerHTML = highlightToHtml(code.replace(/\n$/, ""), lang);
  pre.appendChild(c);
  return pre;
}

function renderStoredOutputs(outputs) {
  const box = el("div", "stored-out");
  for (const o of outputs || []) {
    if (o.k === "text") { const p = el("pre", "out-text"); p.textContent = o.v; box.appendChild(p); }
    else if (o.k === "err") { const p = el("pre", "out-text bad"); p.textContent = o.v; box.appendChild(p); }
    else if (o.k === "img") { const i = el("img", "out-img"); i.src = o.v; i.alt = "Output figure"; i.loading = "lazy"; box.appendChild(i); }
    else if (o.k === "svg" || o.k === "html") { const d = el("div", "out-html"); d.innerHTML = o.v; box.appendChild(d); }
  }
  return box;
}

/**
 * ctx: { runner, py }   opts: { onProgress }
 * returns { root, destroy, setAnchorTarget }
 */
export function renderLesson(ctx, lesson) {
  const runner = ctx.runner;
  const lid = lesson.id;
  const root = el("article", "lesson");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.__mount && e.target.__mount(); observer.unobserve(e.target); }
    },
    { rootMargin: "800px 0px" },
  );
  const entries = []; // Q# cells and tasks in document order (context for demo cells)
  const tasks = []; // {block, ed, statusEl, ...}
  const pyEntries = [];
  const editors = [];
  const ro = lesson.readOnly;
  const pySession = { ran: new Set() };
  let taskCounter = 0;

  // ---- helpers -----------------------------------------------------------------------------------
  const passedCode = (t) => store.getDraft(lid, "pass:" + t.block.id);
  const effectiveTaskCode = (t) => {
    if (t.block.noTest) return t.ed ? t.ed.getValue() : t.block.code;
    if (store.isPassed(lid, t.block.id) && passedCode(t)) return passedCode(t);
    return t.block.solutionCode || t.block.code;
  };
  const othersFor = (t) =>
    tasks
      .filter((o) => o !== t && !o.block.noTest && o.block.solutionCode)
      .map((o) => ({ names: o.block.names, code: effectiveTaskCode(o) }));

  function mapErrorLines(errors, range) {
    return errors.map((e) => {
      if (!range) return null;
      const inRange = (f, l) => f === range.file && l >= range.startLine && l < range.startLine + range.lineCount;
      if (inRange(e.file, e.line)) return e.line - range.startLine + 1;
      if (e.stack) {
        for (const m of e.stack.matchAll(/\bin ([^\s:]+):(\d+):(\d+)/g)) if (inRange(m[1], +m[2])) return +m[2] - range.startLine + 1;
      }
      return null;
    });
  }

  // tests that draw random numbers can occasionally fail even for correct code
  function isRandomized(t, errors) {
    if (errors.some((e) => /Failed to find|not found within|too many/i.test(e.message))) return true;
    const tf = lesson.project.find((f) => f.role === "tests");
    if (!tf) return false;
    const it = findItems(tf.text, 1).find((x) => x.name === t.block.id);
    return !!it && /DrawRandom|Random|Sample/.test(tf.text.slice(it.start, it.end));
  }

  function hintFor(errors, t) {
    for (const e of errors) {
      const m = /`([A-Za-z_0-9]+)` not found/.exec(e.message);
      if (m && t && t.block.names.includes(m[1])) return `Keep the name \`${m[1]}\` and its signature as given: the check looks for exactly this operation.`;
    }
    return null;
  }

  // ---- header --------------------------------------------------------------------------------------
  const header = el("header", "lesson-head");
  const kind = el("span", `pill kind-${lesson.kind}`, lesson.kind === "kata" ? "Kata · programming exercises" : "Tutorial");
  header.appendChild(kind);
  header.appendChild(el("h1", "", lesson.title));
  if (lesson.summary) header.appendChild(el("p", "lead", lesson.summary));
  const progressLine = el("div", "lesson-progress");
  header.appendChild(progressLine);
  root.appendChild(header);

  function updateProgressLine() {
    const total = lesson.taskIds.length;
    progressLine.textContent = "";
    if (!total) return;
    const done = lesson.taskIds.filter((id) => store.isPassed(lid, id)).length;
    const bar = el("div", "bar");
    const fill = el("span");
    fill.style.width = (100 * done) / total + "%";
    bar.appendChild(fill);
    progressLine.appendChild(bar);
    progressLine.appendChild(el("span", "small", `${done} of ${total} exercises completed`));
  }

  if (ro) {
    const note = el("div", "callout warn");
    note.innerHTML =
      "<strong>Read-only tutorial.</strong> This notebook trains a model with the Python <code>qsharp</code> package and plotting libraries, which cannot run in a browser. You can read all of it here, including the saved results; to run it yourself, open the original notebook in Jupyter.";
    root.appendChild(note);
  }

  // ---- block renderers -------------------------------------------------------------------------------
  function renderMd(b) {
    const d = el("div", b.plain ? "md plain" : "md");
    if (b.plain) d.textContent = b.text;
    else {
      d.innerHTML = renderMarkdown(b.text);
      typeset(d);
    }
    return d;
  }

  function renderStaticBlocks(blocks, into) {
    for (const b of blocks) {
      if (b.t === "md") into.appendChild(renderMd(b));
      else if (b.t === "code") {
        into.appendChild(staticCode(b.code, b.lang || "qsharp"));
        if (b.note) into.appendChild(el("div", "callout small", b.note));
      } else if (b.t === "hr") into.appendChild(el("hr"));
    }
  }

  function renderSolutionDetails(blocks, label = "Show solution") {
    const d = el("details", "solution");
    d.appendChild(el("summary", "", label));
    let built = false;
    d.addEventListener("toggle", () => {
      if (d.open && !built) {
        built = true;
        const inner = el("div", "solution-body");
        renderStaticBlocks(blocks, inner);
        d.appendChild(inner);
      }
    });
    return d;
  }

  // ---- Q# tasks ---------------------------------------------------------------------------------------
  function renderTask(b) {
    const t = { block: b, ed: null, running: false };
    const card = el("section", "task");
    card.id = "task-" + b.id;
    const head = el("div", "task-head");
    head.appendChild(el("span", "task-label", b.noTest ? "Practice" : "Your turn"));
    const status = el("span", "pill muted", "Not checked yet");
    head.appendChild(status);
    card.appendChild(head);
    if (b.noTest) card.appendChild(el("div", "callout small", "The original kata has no automatic test for this exercise; write your solution and compare it with the reference solution."));
    const host = el("div");
    card.appendChild(host);
    const bar = el("div", "task-bar");
    const checkBtn = el("button", "btn primary", "Check");
    checkBtn.title = "Run the tests (Ctrl+Enter)";
    const resetBtn = el("button", "btn", "Reset code");
    const solBtn = el("button", "btn ghost", "Show solution");
    const busy = el("span", "small muted");
    bar.append(checkBtn, resetBtn, solBtn, busy);
    if (b.noTest) checkBtn.remove();
    card.appendChild(bar);
    const out = el("div", "task-out");
    card.appendChild(out);
    const solBox = el("div", "task-solution hidden");
    card.appendChild(solBox);

    const draft = store.getDraft(lid, b.id);
    const save = debounce((v) => { if (v === b.code) store.clearDraft(lid, b.id); else store.setDraft(lid, b.id, v); }, DRAFT_DELAY);
    t.ed = lazyEditor(host, { doc: draft ?? b.code, lang: "qsharp", onRun: () => check(), onChange: save }, observer);
    editors.push(t.ed);
    t.statusEl = status;
    entries.push({ kind: "task", task: t });
    tasks.push(t);

    function setStatus() {
      if (store.isPassed(lid, b.id)) { status.className = "pill ok"; status.textContent = "Completed ✓"; }
      else if (t.failed) { status.className = "pill bad"; status.textContent = "Not passing yet"; }
      else { status.className = "pill muted"; status.textContent = "Not checked yet"; }
    }
    t.setStatus = setStatus;
    setStatus();

    async function check() {
      if (b.noTest) return;
      if (t.running) { runner.stop(); return; }
      t.running = true;
      checkBtn.textContent = "Stop";
      checkBtn.classList.add("stop");
      out.textContent = "";
      t.ed.clearErrors();
      status.className = "pill muted";
      status.textContent = "Running…";
      busy.textContent = "";
      let prog;
      try {
        prog = buildTaskProgram(SHIM, lesson, b, t.ed.getValue(), othersFor(t));
      } catch (e) {
        t.running = false;
        checkBtn.textContent = "Check"; checkBtn.classList.remove("stop");
        t.failed = true; setStatus();
        const d = el("div", "err");
        d.appendChild(el("div", "err-title", "Could not prepare the check"));
        d.appendChild(el("pre", "err-body", /Could not find where/.test(e.message) ? `The code must define ${b.names.map((n) => "`" + n + "`").join(", ")}. Keep the operation names from the starter code.` : e.message));
        out.appendChild(d);
        return;
      }
      const msgBox = el("div", "messages");
      let statusTimer = setTimeout(() => { busy.textContent = "Loading the Q# engine (first run only)…"; }, 700);
      const res = await runner.run(prog, {
        onEvent: (ev) => { appendEvent(msgBox, ev); },
        onStart: () => {},
      });
      clearTimeout(statusTimer);
      busy.textContent = "";
      t.running = false;
      checkBtn.textContent = "Check";
      checkBtn.classList.remove("stop");
      if (res.stopped) { t.failed = false; setStatus(); out.appendChild(el("div", "callout small", "Stopped.")); return; }
      if (res.ok) {
        store.setPassed(lid, b.id, true);
        store.setDraft(lid, "pass:" + b.id, t.ed.getValue());
        t.failed = false;
        setStatus();
        const ok = el("div", "success");
        ok.appendChild(el("strong", "", "✓ All tests passed."));
        ok.appendChild(document.createTextNode(` (${Math.round(res.ms)} ms)`));
        out.appendChild(ok);
        if (msgBox.childNodes.length) {
          const det = el("details", "msgs");
          det.appendChild(el("summary", "", "Test output"));
          det.appendChild(msgBox);
          out.appendChild(det);
        }
      } else {
        t.failed = true;
        store.setPassed(lid, b.id, false);
        setStatus();
        if (msgBox.childNodes.length) {
          msgBox.classList.add("before-error");
          out.appendChild(msgBox);
        }
        const lines = mapErrorLines(res.errors, prog.userRange);
        renderErrors(out, res.errors, (e) => lines[res.errors.indexOf(e)]);
        const marks = [];
        res.errors.forEach((e, i) => { if (lines[i]) marks.push({ line: lines[i], message: e.message }); });
        t.ed.setErrors(marks);
        const hint = hintFor(res.errors, t);
        if (hint) out.appendChild(el("div", "callout small", hint));
        else if (isRandomized(t, res.errors)) out.appendChild(el("div", "callout small", "This test uses random numbers. If you are sure your code is correct, click Check once more."));
        if (res.timedOut) out.appendChild(el("div", "callout small", "Tip: an infinite loop or a very slow computation can cause this."));
      }
    }
    checkBtn.addEventListener("click", check);
    resetBtn.addEventListener("click", () => {
      t.ed.setValue(b.code);
      store.clearDraft(lid, b.id);
      t.ed.clearErrors();
    });
    let solBuilt = false;
    solBtn.addEventListener("click", () => {
      const hidden = solBox.classList.toggle("hidden");
      solBtn.textContent = hidden ? "Show solution" : "Hide solution";
      if (!hidden && !solBuilt) {
        solBuilt = true;
        if (b.solution && b.solution.length) renderStaticBlocks(b.solution, solBox);
        else if (b.solutionCode) {
          solBox.appendChild(el("p", "small muted", "Reference solution from the kata repository:"));
          solBox.appendChild(staticCode(b.solutionCode.replace(/^(open [^\n]*\n)+\n?/, ""), "qsharp"));
        } else solBox.appendChild(el("p", "small muted", "No solution is included with the original kata for this exercise."));
        if (b.solutionCode) {
          const use = el("button", "btn small", "Copy solution into the editor");
          use.addEventListener("click", () => { t.ed.setValue(b.solutionCode.replace(/\s+$/, "") + "\n"); });
          solBox.appendChild(use);
        }
        if (b.altSolutionCodes && b.altSolutionCodes.length) {
          for (const alt of b.altSolutionCodes) { solBox.appendChild(el("p", "small muted", "Another way to solve it:")); solBox.appendChild(staticCode(alt.replace(/^(open [^\n]*\n)+\n?/, ""), "qsharp")); }
        }
      }
    });
    return card;
  }

  // ---- Q# demo / snippet cells ---------------------------------------------------------------------------
  function contextCodes(upTo) {
    const codes = [];
    for (let i = 0; i <= upTo; i++) {
      const en = entries[i];
      if (en.kind === "task") codes.push(effectiveTaskCode(en.task));
      else if (en.block.refOnly) continue;
      else if (en.block.incomplete && i !== upTo) continue;
      else codes.push(en.ed.getValue());
    }
    return codes;
  }

  function renderCell(b) {
    const wrap = el("section", "cell");
    const idx = entries.length;
    let ed = null;
    const entry = { kind: "cell", block: b, get ed() { return ed; } };
    const host = el("div");
    if (!b.refOnly) {
      const key = "cell:" + idx;
      const draft = store.getDraft(lid, key);
      const save = debounce((v) => { if (v === b.code) store.clearDraft(lid, key); else store.setDraft(lid, key, v); }, DRAFT_DELAY);
      ed = lazyEditor(host, { doc: draft ?? b.code, lang: "qsharp", onRun: b.entry ? () => run() : undefined, onChange: save }, observer);
      editors.push(ed);
      wrap.appendChild(host);
    } else {
      ed = { getValue: () => b.code, setErrors() {}, clearErrors() {} };
    }
    entries.push(entry);
    if (!b.entry) return wrap;
    const bar = el("div", "task-bar");
    const runBtn = el("button", "btn primary", b.refOnly ? `▶ Run ${b.entry}` : "▶ Run");
    runBtn.title = "Ctrl+Enter";
    const busy = el("span", "small muted");
    bar.append(runBtn, busy);
    if (b.incomplete) bar.appendChild(el("span", "small muted", "Fill in the “…” placeholders first."));
    wrap.appendChild(bar);
    const out = el("div", "task-out");
    wrap.appendChild(out);
    let running = false;
    async function run() {
      if (running) { runner.stop(); return; }
      running = true;
      runBtn.textContent = "Stop"; runBtn.classList.add("stop");
      out.textContent = "";
      let prog;
      try {
        prog = buildSnippetProgram(SHIM, lesson, contextCodes(idx), b.entry, b.args || {});
      } catch (e) {
        running = false; runBtn.textContent = b.refOnly ? `▶ Run ${b.entry}` : "▶ Run"; runBtn.classList.remove("stop");
        renderErrors(out, [{ message: e.message }]);
        return;
      }
      const box = el("div", "messages");
      out.appendChild(box);
      const t = setTimeout(() => { busy.textContent = "Loading the Q# engine (first run only)…"; }, 700);
      const res = await runner.run(prog, { onEvent: (ev) => appendEvent(box, ev) });
      clearTimeout(t);
      busy.textContent = "";
      running = false;
      runBtn.textContent = b.refOnly ? `▶ Run ${b.entry}` : "▶ Run"; runBtn.classList.remove("stop");
      if (res.stopped) { out.appendChild(el("div", "callout small", "Stopped.")); return; }
      if (res.ok) {
        const v = res.value;
        if (v !== undefined && v !== null && v !== "()" && v !== "") { const r = el("div", "result"); r.textContent = "Result: " + v; out.appendChild(r); }
        else if (!box.childNodes.length) out.appendChild(el("div", "small muted", "Finished, nothing was printed."));
      } else {
        const src = new Map(prog.sources);
        const errs = res.errors.map((e) => {
          const text = src.get(e.file);
          if (e.file === "snippet.qs" && text && e.line) {
            const ln = text.split("\n")[e.line - 1];
            if (ln && ln.trim()) return { ...e, message: e.message + "\n> " + ln.trim() };
          }
          return e;
        });
        renderErrors(out, errs, null);
      }
    }
    runBtn.addEventListener("click", run);
    return wrap;
  }

  // ---- Python cells ------------------------------------------------------------------------------------
  function pyRunnable(b) {
    return !ro && !/import qsharp|matplotlib|import Microsoft|import Quantum/.test(b.code);
  }

  function renderPython(b) {
    const wrap = el("section", b.exercise ? "task" : "cell");
    const idx = pyEntries.length;
    const entry = { block: b, ed: null };
    pyEntries.push(entry);
    if (b.exercise) {
      const head = el("div", "task-head");
      head.appendChild(el("span", "task-label", "Your turn (Python)"));
      const status = el("span", "pill muted", "Not checked yet");
      head.appendChild(status);
      wrap.appendChild(head);
      entry.status = status;
      const id = "py_" + b.exercise;
      const setStatus = () => {
        if (store.isPassed(lid, id)) { status.className = "pill ok"; status.textContent = "Completed ✓"; }
        else if (entry.failed) { status.className = "pill bad"; status.textContent = "Not passing yet"; }
        else { status.className = "pill muted"; status.textContent = "Not checked yet"; }
      };
      entry.setStatus = setStatus;
      setStatus();
      wrap.id = "task-" + id;
    }
    if (!pyRunnable(b)) {
      wrap.appendChild(staticCode(b.code, "python"));
      if (!ro) wrap.appendChild(el("div", "callout small", "This cell uses the Python <code>qsharp</code> package and plotting libraries, which are not available in the browser. Run the original notebook locally to reproduce it.".replace(/<\/?code>/g, "`")));
      if (b.outputs && b.outputs.length) wrap.appendChild(renderStoredOutputs(b.outputs));
      return wrap;
    }
    const key = "py:" + idx;
    const draft = store.getDraft(lid, key);
    const host = el("div");
    const save = debounce((v) => { if (v === b.code) store.clearDraft(lid, key); else store.setDraft(lid, key, v); }, DRAFT_DELAY);
    entry.ed = lazyEditor(host, { doc: draft ?? b.code, lang: "python", onRun: () => run(), onChange: save }, observer);
    editors.push(entry.ed);
    wrap.appendChild(host);
    const bar = el("div", "task-bar");
    const runBtn = el("button", "btn primary", b.exercise ? "Check" : "▶ Run");
    const busy = el("span", "small muted");
    bar.appendChild(runBtn);
    let resetBtn = null;
    if (b.exercise) { resetBtn = el("button", "btn", "Reset code"); bar.appendChild(resetBtn); }
    bar.appendChild(busy);
    wrap.appendChild(bar);
    const out = el("div", "task-out");
    wrap.appendChild(out);
    let running = false;
    async function run() {
      if (running) { ctx.py.stop(); return; }
      running = true;
      runBtn.textContent = "Stop"; runBtn.classList.add("stop");
      out.textContent = "";
      ctx.py.setModules(lesson.pyModules || {});
      const t = setTimeout(() => { busy.textContent = "Loading Python (first run downloads about 12 MB)…"; }, 500);
      // earlier setup cells (imports, helper functions) run first, once
      for (let i = 0; i < idx; i++) {
        const prev = pyEntries[i];
        if (prev.block.exercise || pySession.ran.has(i) || !pyRunnable(prev.block)) continue;
        const r = await ctx.py.run(prev.ed ? prev.ed.getValue() : prev.block.code);
        pySession.ran.add(i);
        if (!r.ok && r.stopped) break;
      }
      const r = await ctx.py.run(entry.ed.getValue());
      if (!b.exercise) pySession.ran.add(idx);
      clearTimeout(t);
      busy.textContent = "";
      running = false;
      runBtn.textContent = b.exercise ? "Check" : "▶ Run"; runBtn.classList.remove("stop");
      if (r.stopped) { out.appendChild(el("div", "callout small", "Stopped.")); return; }
      if (r.out) { const p = el("pre", "out-text"); p.textContent = r.out; out.appendChild(p); }
      if (!r.ok) {
        const d = el("div", "err");
        d.appendChild(el("div", "err-title", "Python error"));
        d.appendChild(el("pre", "err-body", r.error));
        out.appendChild(d);
      }
      if (b.exercise) {
        const id = "py_" + b.exercise;
        const success = r.ok && /Success!/.test(r.out || "");
        entry.failed = !success;
        store.setPassed(lid, id, success);
        entry.setStatus();
        if (success) out.appendChild(el("div", "success", "✓ Exercise completed."));
      }
    }
    runBtn.addEventListener("click", run);
    if (resetBtn) resetBtn.addEventListener("click", () => { entry.ed.setValue(b.code); store.clearDraft(lid, key); });
    if (b.outputs && b.outputs.length && !b.exercise) out.appendChild(renderStoredOutputs(b.outputs));
    return wrap;
  }

  // ---- assemble ------------------------------------------------------------------------------------------
  const body = el("div", "lesson-body");
  root.appendChild(body);
  for (const b of lesson.blocks) {
    if (b.t === "md") body.appendChild(renderMd(b));
    else if (b.t === "hr") body.appendChild(el("hr"));
    else if (b.t === "solution") body.appendChild(renderSolutionDetails(b.blocks));
    else if (b.t === "task") body.appendChild(ro ? staticCode(b.code, "qsharp") : renderTask(b));
    else if (b.t === "code") {
      if (b.lang === "python") body.appendChild(renderPython(b));
      else if (b.static || ro) {
        body.appendChild(staticCode(b.code, "qsharp"));
        if (b.note) body.appendChild(el("div", "callout small", b.note));
        if (b.outputs && b.outputs.length) body.appendChild(renderStoredOutputs(b.outputs));
      } else body.appendChild(renderCell(b));
    }
  }

  // ---- footer: mark as done -------------------------------------------------------------------------------
  const foot = el("div", "lesson-foot");
  if (!lesson.taskIds.length && !ro) {
    const btn = el("button", "btn");
    const upd = () => { btn.textContent = store.isDone(lid) ? "✓ Marked as done (click to undo)" : "Mark this tutorial as done"; btn.classList.toggle("primary", !store.isDone(lid)); };
    btn.addEventListener("click", () => { store.setDone(lid, !store.isDone(lid)); upd(); });
    upd();
    foot.appendChild(btn);
  } else if (ro) {
    const btn = el("button", "btn");
    const upd = () => { btn.textContent = store.isDone(lid) ? "✓ Marked as read (click to undo)" : "Mark as read"; btn.classList.toggle("primary", !store.isDone(lid)); };
    btn.addEventListener("click", () => { store.setDone(lid, !store.isDone(lid)); upd(); });
    upd();
    foot.appendChild(btn);
  }
  root.appendChild(foot);

  updateProgressLine();
  const off = store.onChange(() => {
    updateProgressLine();
    for (const t of tasks) t.setStatus && t.setStatus();
    for (const p of pyEntries) p.setStatus && p.setStatus();
  });

  return {
    root,
    destroy() {
      off();
      observer.disconnect();
      if (runner.current) runner.stop();
      if (ctx.py.pending.size) ctx.py.stop();
      editors.forEach((e) => e.destroy());
    },
    mountAll() { root.querySelectorAll(".editor-host").forEach((h) => h.__mount && h.__mount()); },
  };
}
