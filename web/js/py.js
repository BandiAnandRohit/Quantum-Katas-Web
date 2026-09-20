// Main-thread client for the Pyodide worker (created on first use).
export class PyRunner {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.worker = null;
    this.ready = null;
    this.modules = {};
    this.nextId = 1;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.onStatus = () => {};
  }
  setModules(mods) {
    // modules of the current lesson; a fresh interpreter is needed when they change
    const same = JSON.stringify(mods || {}) === JSON.stringify(this.modules);
    if (!same) { this.modules = mods || {}; this.stop(); }
  }
  _start() {
    if (this.worker) return;
    this.onStatus("loading");
    const w = new Worker(this.workerUrl, { type: "module" });
    this.worker = w;
    this.ready = new Promise((resolve, reject) => {
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") { this.onStatus("ready"); resolve(); }
        else if (m.type === "initError") { this.onStatus("error"); reject(new Error(m.message)); }
        else if (m.type === "done") {
          const p = this.pending.get(m.id);
          if (p) { this.pending.delete(m.id); p({ ok: m.ok, out: m.out, error: m.error }); }
        }
      };
      w.onerror = (e) => reject(new Error(e.message || "worker error"));
    });
    this.ready.catch(() => {});
    w.postMessage({ type: "init", modules: this.modules });
  }
  stop() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.ready = null;
    for (const [, p] of this.pending) p({ ok: false, out: "", error: "Stopped.", stopped: true });
    this.pending.clear();
  }
  run(code, timeoutMs = 60000) {
    const job = () =>
      new Promise((resolve) => {
        this._start();
        const id = this.nextId++;
        let timer = null;
        this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
        this.ready
          .then(() => {
            if (!this.worker) return;
            this.worker.postMessage({ type: "run", id, code });
            timer = setTimeout(() => {
              if (this.pending.has(id)) {
                const p = this.pending.get(id);
                this.pending.delete(id);
                p({ ok: false, out: "", error: "The code ran for more than a minute and was stopped.", timedOut: true });
                this.stop();
              }
            }, timeoutMs);
          })
          .catch((err) => {
            const p = this.pending.get(id);
            if (p) { this.pending.delete(id); p({ ok: false, out: "", error: "Python could not be loaded (" + err.message + "). Python exercises need an internet connection the first time." }); }
          });
      });
    const p = this.queue.then(job, job);
    this.queue = p.catch(() => {});
    return p;
  }
}
