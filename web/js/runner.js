// Main-thread client for the Q# worker. One job at a time; a running job can be stopped
// (the worker is terminated and re-created, which is the only way to interrupt WebAssembly code).
export class QsRunner {
  constructor(workerUrl, wasmUrl) {
    this.workerUrl = workerUrl;
    this.wasmUrl = wasmUrl;
    this.worker = null;
    this.ready = null;
    this.nextId = 1;
    this.current = null;
    this.queue = Promise.resolve();
    this.onStatus = () => {};
  }

  _start() {
    if (this.worker) return;
    this.onStatus("loading");
    const w = new Worker(this.workerUrl);
    this.worker = w;
    this.ready = new Promise((resolve, reject) => {
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") { this.onStatus("ready"); resolve(); }
        else if (m.type === "initError") { this.onStatus("error"); reject(new Error(m.message)); }
        else this._handle(m);
      };
      w.onerror = (e) => {
        const err = new Error(e.message || "worker error");
        if (this.current) this.current.finish({ ok: false, errors: [{ message: "The Q# engine crashed: " + err.message }] });
        reject(err);
      };
    });
    this.ready.catch(() => {});
    w.postMessage({ type: "init", wasmUrl: this.wasmUrl });
  }

  warm() {
    this._start();
    return this.ready.catch(() => {});
  }

  _handle(m) {
    const cur = this.current;
    if (!cur || m.id !== cur.id) return;
    if (m.type === "event") cur.events.push(m.event), cur.onEvent && cur.onEvent(m.event);
    else if (m.type === "shot") cur.onShot && cur.onShot(m);
    else if (m.type === "done") cur.finish({ ok: m.ok, ms: m.ms, value: m.value, shots: m.shots, errors: m.errors || [] });
  }

  /** Stops the running job (if any). */
  stop() {
    if (this.current) this.current.finish({ ok: false, stopped: true, errors: [] });
    if (this.worker) { this.worker.terminate(); this.worker = null; this.ready = null; }
  }

  /**
   * prog: { sources, expr }   opts: { shots, onEvent, onShot, timeoutMs }
   * resolves to { ok, ms, value, shots, errors, events, stopped?, timedOut? } (never rejects)
   */
  run(prog, opts = {}) {
    const job = () =>
      new Promise((resolve) => {
        this._start();
        const id = this.nextId++;
        const events = [];
        let timer = null;
        const cur = {
          id,
          events,
          onEvent: opts.onEvent,
          onShot: opts.onShot,
          finish: (res) => {
            if (this.current !== cur) return;
            this.current = null;
            clearTimeout(timer);
            resolve({ events, ...res });
          },
        };
        this.current = cur;
        if (opts.onStart) opts.onStart();
        this.ready
          .then(() => {
            if (this.current !== cur) return;
            this.worker.postMessage({ type: "run", id, sources: prog.sources, expr: prog.expr, shots: opts.shots || 1 });
            const t = opts.timeoutMs || 120000;
            timer = setTimeout(() => {
              if (this.current === cur) {
                cur.finish({ ok: false, timedOut: true, errors: [{ message: `The program ran for more than ${Math.round(t / 1000)} seconds and was stopped (is there an infinite loop?).` }] });
                if (this.worker) { this.worker.terminate(); this.worker = null; this.ready = null; }
              }
            }, t);
          })
          .catch((err) => cur.finish({ ok: false, errors: [{ message: "The Q# engine could not be started: " + err.message }] }));
      });
    const p = this.queue.then(job, job);
    this.queue = p.catch(() => {});
    return p;
  }
}
