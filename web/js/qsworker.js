// Web Worker: runs Q# programs with Microsoft's Q# compiler / simulator (WebAssembly).
import { loadWasmModule, getCompiler, QscEventTarget } from "qsharp-lang";

let compilerPromise = null;

function post(msg) {
  self.postMessage(msg);
}

function diagnosticsFrom(result) {
  // result: the "value" of a failed Result event
  const out = [];
  const errs = result && result.errors ? result.errors : [];
  for (const e of errs) {
    const d = e.diagnostic || {};
    const r = d.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    out.push({
      file: e.document,
      line: r.start.line + 1,
      col: r.start.character + 1,
      endLine: r.end.line + 1,
      endCol: r.end.character + 1,
      message: d.message || "",
      stack: e.stack || null,
    });
  }
  if (!out.length && result && result.message) out.push({ file: null, line: 0, col: 0, message: result.message });
  return out;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      compilerPromise = (async () => {
        await loadWasmModule(m.wasmUrl);
        return await getCompiler();
      })();
      await compilerPromise;
      post({ type: "ready" });
    } catch (err) {
      post({ type: "initError", message: String((err && err.message) || err) });
    }
    return;
  }
  if (m.type === "run") {
    const id = m.id;
    let compiler;
    try {
      compiler = await compilerPromise;
    } catch (err) {
      post({ type: "done", id, ok: false, errors: [{ message: "The Q# engine could not be loaded: " + err }] });
      return;
    }
    const et = new QscEventTarget(false);
    let final = null;
    const shotResults = [];
    const first = () => shotResults.length === 0; // with several shots only the output of the first one is shown
    et.addEventListener("Message", (ev) => first() && post({ type: "event", id, event: { type: "Message", message: ev.detail } }));
    et.addEventListener("DumpMachine", (ev) =>
      first() && post({ type: "event", id, event: { type: "DumpMachine", state: ev.detail.state, stateLatex: ev.detail.stateLatex, qubitCount: ev.detail.qubitCount } }),
    );
    et.addEventListener("Matrix", (ev) => first() && post({ type: "event", id, event: { type: "Matrix", matrix: ev.detail.matrix, matrixLatex: ev.detail.matrixLatex } }));
    et.addEventListener("Result", (ev) => {
      final = ev.detail;
      shotResults.push(ev.detail);
    });
    const t0 = performance.now();
    let thrown = null;
    try {
      await compiler.run({ sources: m.sources, languageFeatures: [] }, m.expr, m.shots || 1, et);
    } catch (err) {
      // compile errors are reported both as a Result event (with all details) and as an exception (short text)
      thrown = err;
    }
    if (thrown && !final) {
      post({ type: "done", id, ok: false, ms: performance.now() - t0, errors: [{ message: String((thrown && thrown.message) || thrown) }] });
      return;
    }
    const ms = performance.now() - t0;
    const bad = shotResults.find((r) => !r.success);
    if (bad) final = bad;
    if (!final) {
      post({ type: "done", id, ok: false, ms, errors: [{ message: "The program produced no result." }] });
    } else if (final.success) {
      post({ type: "done", id, ok: true, ms, value: final.value, shots: shotResults.filter((r) => r.success).map((r) => r.value) });
    } else {
      post({ type: "done", id, ok: false, ms, errors: diagnosticsFrom(final.value) });
    }
  }
};
