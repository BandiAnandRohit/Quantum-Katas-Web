// Everything the site remembers lives in this browser (localStorage). No accounts, no server.
const PREFIX = "qk:v1:";
const mem = new Map();
const listeners = new Set();

function read(key) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? mem.get(key) ?? null : v;
  } catch (e) {
    return mem.get(key) ?? null;
  }
}
function write(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (e) {
    /* storage unavailable: keep in memory for this visit */
  }
}
function remove(key) {
  mem.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {}
}

export const store = {
  getJSON(key, fallback) {
    const v = read(key);
    if (v === null) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  },
  setJSON(key, value) { write(key, JSON.stringify(value)); },
  getText(key) { return read(key); },
  setText(key, value) { write(key, value); },
  remove,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  _emit() { for (const fn of listeners) fn(); },

  // ---- progress -------------------------------------------------------------------------------------
  progress() { return this.getJSON("progress", {}); },
  isPassed(lesson, task) { return !!this.progress()[lesson]?.[task]; },
  setPassed(lesson, task, passed) {
    const p = this.progress();
    p[lesson] = p[lesson] || {};
    if (passed) p[lesson][task] = Date.now();
    else delete p[lesson][task];
    this.setJSON("progress", p);
    this._emit();
  },
  passedCount(lesson) { return Object.keys(this.progress()[lesson] || {}).length; },
  isDone(lesson) { return !!this.getJSON("done", {})[lesson]; },
  setDone(lesson, done) {
    const d = this.getJSON("done", {});
    if (done) d[lesson] = Date.now(); else delete d[lesson];
    this.setJSON("done", d);
    this._emit();
  },

  // ---- drafts (the learner's code) ------------------------------------------------------------------
  getDraft(lesson, key) { return read(`draft:${lesson}:${key}`); },
  setDraft(lesson, key, code) { write(`draft:${lesson}:${key}`, code); },
  clearDraft(lesson, key) { remove(`draft:${lesson}:${key}`); },

  // ---- export / import / reset ----------------------------------------------------------------------
  exportAll() {
    const data = { app: "quantum-katas-web", version: 1, exported: new Date().toISOString(), items: {} };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) data.items[k.slice(PREFIX.length)] = localStorage.getItem(k);
      }
    } catch (e) {
      for (const [k, v] of mem) data.items[k] = v;
    }
    return data;
  },
  importAll(data) {
    if (!data || data.app !== "quantum-katas-web" || typeof data.items !== "object") throw new Error("This file is not a progress export from this site.");
    for (const [k, v] of Object.entries(data.items)) if (typeof v === "string") write(k, v);
    this._emit();
  },
  resetAll() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && !k.startsWith(PREFIX + "theme")) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    for (const k of [...mem.keys()]) if (k !== "theme") mem.delete(k);
    this._emit();
  },
};
