// Web Worker for the Python exercises (Pyodide = CPython compiled to WebAssembly; self-hosted, loaded on demand).
import { loadPyodide } from "./pyodide/pyodide.mjs";
const PYODIDE_BASE = new URL("pyodide/", self.location.href).href;

const PYTEST_STUB = `
class approx:
    """Minimal replacement for pytest.approx (the exercises only compare numbers and sequences of numbers)."""
    def __init__(self, expected, rel=None, abs=None, nan_ok=False):
        self.expected = expected
        self.rel = 1e-6 if rel is None else rel
        self.abs = 1e-12 if abs is None else abs
    def _close(self, a, e):
        if isinstance(e, (list, tuple)):
            try:
                a = list(a)
            except TypeError:
                return False
            return len(a) == len(e) and all(self._close(x, y) for x, y in zip(a, e))
        if isinstance(a, (list, tuple)) or a is None or a is Ellipsis:
            return False
        try:
            if a == e:
                return True
            return abs(a - e) <= max(self.rel * abs(e), self.abs)
        except TypeError:
            return False
    def __eq__(self, other):
        return self._close(other, self.expected)
    def __ne__(self, other):
        return not self.__eq__(other)
    def __repr__(self):
        return "approx(%r)" % (self.expected,)
`;

let pyodide = null;
let current = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
      pyodide.setStdout({ batched: (s) => current && current.push(s) });
      pyodide.setStderr({ batched: (s) => current && current.push(s) });
      pyodide.FS.writeFile("/home/pyodide/pytest.py", PYTEST_STUB);
      for (const [name, text] of Object.entries(m.modules || {})) pyodide.FS.writeFile(`/home/pyodide/${name}.py`, text);
      await pyodide.runPythonAsync("import sys\nif '/home/pyodide' not in sys.path: sys.path.insert(0, '/home/pyodide')");
      self.postMessage({ type: "ready" });
    } else if (m.type === "run") {
      current = [];
      let ok = true;
      let error = null;
      try {
        const code = m.code.split("\n").map((l) => (/^\s*%/.test(l) ? "" : l)).join("\n");
        await pyodide.loadPackagesFromImports(code);
        await pyodide.runPythonAsync(code);
      } catch (err) {
        ok = false;
        // keep the part of the traceback that concerns the learner's code
        const msg = String(err && err.message ? err.message : err);
        const at = msg.lastIndexOf('File "<exec>"');
        error = at >= 0 ? "Traceback (most recent call last):\n  " + msg.slice(at) : msg;
      }
      const out = current.join("\n");
      current = null;
      self.postMessage({ type: "done", id: m.id, ok, out, error });
    }
  } catch (err) {
    self.postMessage({ type: m.type === "init" ? "initError" : "done", id: m.id, ok: false, out: "", error: String((err && err.message) || err), message: String((err && err.message) || err) });
  }
};
