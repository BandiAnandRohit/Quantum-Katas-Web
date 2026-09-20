import { parentPort } from "worker_threads";
import * as qsharp from "qsharp-lang";
import fs from "fs";
await qsharp.loadWasmModule(fs.readFileSync(new URL("../node_modules/qsharp-lang/lib/web/qsc_wasm_bg.wasm", import.meta.url)));
const compiler = await qsharp.getCompiler();
parentPort.postMessage({ ready: true });
parentPort.on("message", async ({ id, sources, expr, shots }) => {
  const et = new qsharp.QscEventTarget(true);
  let threw = null;
  try {
    await compiler.run({ sources, languageFeatures: [] }, expr, shots || 1, et);
  } catch (e) {
    threw = String(e.message || e);
  }
  const rs = et.getResults().map((r) => ({
    success: r.success,
    events: (r.events || []).map((e) => (e.type === "Message" ? { type: "Message", message: e.message } : { type: e.type })),
    error: r.success
      ? null
      : r.result?.errors
        ? r.result.errors.map((e) => `${e.document}:${e.diagnostic.range.start.line + 1} ${e.diagnostic.message.replace(/\n/g, " ")}`).join(" || ")
        : r.result?.message || JSON.stringify(r.result).slice(0, 300),
    result: r.success ? r.result : undefined,
  }));
  parentPort.postMessage({ id, results: rs, threw });
});
