import { Worker } from "worker_threads";
let worker = null;
let ready = null;
let nextId = 1;
function spawn() {
  worker = new Worker(new URL("./worker-node.mjs", import.meta.url));
  ready = new Promise((res) => worker.once("message", (m) => m.ready && res()));
}
export async function runProgram(prog, timeoutMs = 20000, shots = 1) {
  if (!worker) spawn();
  await ready;
  const id = nextId++;
  const t0 = Date.now();
  const w = worker;
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      w.terminate();
      if (worker === w) worker = null;
      resolve({ ok: false, err: `TIMEOUT after ${timeoutMs}ms`, ms: Date.now() - t0, msgs: [], timeout: true });
    }, timeoutMs);
    const onMsg = (m) => {
      if (m.id !== id) return;
      clearTimeout(timer);
      w.off("message", onMsg);
      const r = m.results[0];
      const msgs = (r?.events || []).filter((e) => e.type === "Message").map((e) => e.message);
      resolve({ ok: !!r?.success, err: r ? r.error : m.threw || "no result", ms: Date.now() - t0, msgs, results: m.results });
    };
    w.on("message", onMsg);
    w.postMessage({ id, sources: prog.sources, expr: prog.expr, shots });
  });
}
export function closeRunner() {
  if (worker) worker.terminate();
  worker = null;
}
