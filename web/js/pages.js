import { el, appendEvent, renderErrors } from "./out.js";
import { createEditor } from "./editor.js";
import { store } from "./store.js";
import { codeMask, namespaceOf } from "../../src/qs.mjs";
import SHIM from "../../shim/shim.qs";

// ================================================================================================
// Home
// ================================================================================================
export function renderHome(ctx) {
  const root = el("div", "home");
  const hero = el("section", "hero");
  hero.appendChild(el("h1", "", "Learn quantum computing by doing"));
  hero.appendChild(
    el("p", "lead", "Self-paced tutorials and programming exercises: from qubits and gates to Grover's search and Shor's algorithm. Write real Q# code and run it right here, in your browser. No account, no installation, nothing to sign up for."),
  );
  const cta = el("div", "cta");
  const last = store.getText("last");
  const lessonById = ctx.lessonInfo;
  if (last && lessonById.has(last)) {
    const a = el("a", "btn primary big", `Continue: ${lessonById.get(last).title}`);
    a.href = `#/l/${last}`;
    cta.appendChild(a);
    const b = el("a", "btn big", "Start from the beginning");
    b.href = "#/l/" + ctx.order[0];
    cta.appendChild(b);
  } else {
    const a = el("a", "btn primary big", "Start learning");
    a.href = "#/l/" + ctx.order[0];
    cta.appendChild(a);
  }
  const pg = el("a", "btn big", "Open the Q# playground");
  pg.href = "#/playground";
  cta.appendChild(pg);
  hero.appendChild(cta);
  root.appendChild(hero);

  const how = el("section", "how");
  const items = [
    ["Read", "Each lesson explains the ideas with text and math, and shows small runnable programs."],
    ["Code", "Exercises give you starter code in an editor. Fill it in with real Q#."],
    ["Check", "One click runs the original kata tests against your code with Microsoft's Q# simulator, in your browser."],
    ["Keep going", "Your progress and code are saved in this browser only. Export them any time."],
  ];
  items.forEach(([h, p], i) => {
    const c = el("div", "how-item");
    c.appendChild(el("div", "how-num", String(i + 1)));
    c.appendChild(el("h3", "", h));
    c.appendChild(el("p", "", p));
    how.appendChild(c);
  });
  root.appendChild(how);

  // overall progress
  const total = ctx.index.groups.reduce((a, g) => a + g.lessons.reduce((b, l) => b + l.tasks, 0), 0);
  const done = ctx.index.groups.reduce((a, g) => a + g.lessons.reduce((b, l) => b + l.taskIds.filter((id) => store.isPassed(l.id, id)).length, 0), 0);
  const prog = el("section", "overall");
  prog.appendChild(el("h2", "", "Curriculum"));
  const line = el("div", "lesson-progress");
  const bar = el("div", "bar");
  const fill = el("span");
  fill.style.width = total ? (100 * done) / total + "%" : "0%";
  bar.appendChild(fill);
  line.appendChild(bar);
  line.appendChild(el("span", "small", `${done} of ${total} exercises completed`));
  prog.appendChild(line);
  root.appendChild(prog);

  for (const g of ctx.index.groups) {
    const sec = el("section", "group");
    sec.appendChild(el("h3", "group-title", g.title));
    const grid = el("div", "cards");
    for (const l of g.lessons) {
      const a = el("a", "card");
      a.href = "#/l/" + l.id;
      const top = el("div", "card-top");
      top.appendChild(el("span", `pill kind-${l.kind}`, l.kind === "kata" ? "Kata" : "Tutorial"));
      if (l.advanced) top.appendChild(el("span", "pill adv", "Advanced"));
      if (l.hasPython) top.appendChild(el("span", "pill py", "Python"));
      if (l.readOnly) top.appendChild(el("span", "pill muted", "Read-only"));
      a.appendChild(top);
      a.appendChild(el("h4", "", l.title));
      a.appendChild(el("p", "small", l.summary || ""));
      const d = l.taskIds.filter((id) => store.isPassed(l.id, id)).length;
      const foot = el("div", "card-foot");
      if (l.tasks) {
        const b = el("div", "bar");
        const f = el("span");
        f.style.width = (100 * d) / l.tasks + "%";
        b.appendChild(f);
        foot.appendChild(b);
        foot.appendChild(el("span", "small", `${d}/${l.tasks}`));
      } else foot.appendChild(el("span", "small muted", store.isDone(l.id) ? "✓ Read" : "Reading"));
      a.appendChild(foot);
      grid.appendChild(a);
    }
    sec.appendChild(grid);
    root.appendChild(sec);
  }

  // progress tools
  const tools = el("section", "tools");
  tools.appendChild(el("h2", "", "Your progress"));
  tools.appendChild(el("p", "", "Everything is stored in this browser only (localStorage). To move to another browser or device, export your progress and import it there."));
  const row = el("div", "cta");
  const exp = el("button", "btn", "Export progress");
  exp.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quantum-katas-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const imp = el("button", "btn", "Import progress");
  const file = el("input");
  file.type = "file";
  file.accept = "application/json,.json";
  file.style.display = "none";
  file.addEventListener("change", async () => {
    try {
      store.importAll(JSON.parse(await file.files[0].text()));
      alert("Progress imported.");
      location.reload();
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  });
  imp.addEventListener("click", () => file.click());
  const reset = el("button", "btn danger", "Reset everything");
  reset.addEventListener("click", () => {
    if (confirm("Delete all saved progress and code from this browser?")) { store.resetAll(); location.reload(); }
  });
  row.append(exp, imp, reset, file);
  tools.appendChild(row);
  root.appendChild(tools);
  return { root, destroy() {} };
}

// ================================================================================================
// Playground
// ================================================================================================
const SAMPLES = {
  "One random bit": `operation Main() : Result {
    use q = Qubit();
    H(q);                 // put the qubit into an equal superposition of |0⟩ and |1⟩
    return MResetZ(q);    // measure it (and reset it to |0⟩)
}`,
  "Bell pair": `operation Main() : (Result, Result) {
    use (a, b) = (Qubit(), Qubit());
    H(a);
    CNOT(a, b);           // entangle the two qubits
    DumpMachine();        // show the quantum state
    return (MResetZ(a), MResetZ(b));
}`,
  "Interference (H, H)": `// Two Hadamard gates in a row give back the starting state: the amplitudes interfere.
operation Main() : Result {
    use q = Qubit();
    H(q);
    Message("After one H:");
    DumpMachine();
    H(q);
    Message("After the second H:");
    DumpMachine();
    return MResetZ(q);
}`,
  "Random number 0–7": `operation Main() : Int {
    use qs = Qubit[3];
    ApplyToEach(H, qs);
    let bits = MResetEachZ(qs);
    return ResultArrayAsInt(bits);
}`,
  "Teleportation": `// Teleports the state of the "message" qubit to Bob's qubit.
operation Main() : Result {
    use (message, alice, bob) = (Qubit(), Qubit(), Qubit());
    // Prepare the message |1⟩
    X(message);
    // Alice and Bob share a Bell pair
    H(alice);
    CNOT(alice, bob);
    // Alice measures her two qubits in the Bell basis
    CNOT(message, alice);
    H(message);
    let m1 = MResetZ(message);
    let m2 = MResetZ(alice);
    // Bob fixes his qubit according to the two classical bits
    if m2 == One { X(bob); }
    if m1 == One { Z(bob); }
    return MResetZ(bob);   // always One: the message arrived
}`,
};

function playgroundProgram(code) {
  const mask = codeMask(code);
  let hasNs = false;
  const re = /\bnamespace\b/g;
  let m;
  while ((m = re.exec(code))) if (mask[m.index]) { hasNs = true; break; }
  let text, ns;
  if (hasNs) {
    text = code;
    ns = namespaceOf(code) || "Main";
  } else {
    ns = "Playground";
    text = `namespace Playground { open Std.Diagnostics; open Std.Math; open Std.Measurement; open Std.Arrays; open Std.Convert; open Std.Canon; ${code}\n}`;
  }
  let name = "Main";
  const ep = /@EntryPoint\(\)\s*(?:internal\s+)?(?:operation|function)\s+([A-Za-z_]\w*)/.exec(code);
  if (ep) name = ep[1];
  return { sources: [["shim.qs", SHIM], ["playground.qs", text]], expr: `${ns}.${name}()`, name };
}

export function renderPlayground(ctx) {
  const runner = ctx.runner;
  const root = el("div", "playground");
  root.appendChild(el("h1", "", "Q# playground"));
  root.appendChild(
    el("p", "lead", "Write your own Q# programs and run them with the in-browser quantum simulator. The program's entry point is an operation called Main (or the one marked @EntryPoint())."),
  );
  const top = el("div", "pg-bar");
  const sel = el("select", "select");
  sel.appendChild(new Option("Load an example…", ""));
  for (const k of Object.keys(SAMPLES)) sel.appendChild(new Option(k, k));
  const shotsLabel = el("label", "small");
  shotsLabel.textContent = "Runs (shots): ";
  const shots = el("input", "num");
  shots.type = "number"; shots.min = "1"; shots.max = "2000"; shots.value = store.getText("pg:shots") || "1";
  shotsLabel.appendChild(shots);
  const runBtn = el("button", "btn primary", "▶ Run");
  runBtn.title = "Ctrl+Enter";
  const busy = el("span", "small muted");
  top.append(sel, shotsLabel, runBtn, busy);
  root.appendChild(top);
  const host = el("div", "editor-host");
  root.appendChild(host);
  const out = el("div", "task-out");
  root.appendChild(out);

  const saved = store.getText("pg:code");
  const ed = createEditor(host, {
    doc: saved || SAMPLES["Bell pair"],
    lang: "qsharp",
    onRun: () => run(),
    onChange: (v) => store.setText("pg:code", v),
  });
  sel.addEventListener("change", () => {
    if (sel.value) { ed.setValue(SAMPLES[sel.value]); store.setText("pg:code", SAMPLES[sel.value]); }
    sel.value = "";
  });
  let running = false;
  async function run() {
    if (running) { runner.stop(); return; }
    running = true;
    runBtn.textContent = "Stop"; runBtn.classList.add("stop");
    out.textContent = "";
    ed.clearErrors();
    const n = Math.max(1, Math.min(2000, parseInt(shots.value, 10) || 1));
    store.setText("pg:shots", String(n));
    const prog = playgroundProgram(ed.getValue());
    const box = el("div", "messages");
    out.appendChild(box);
    let shown = 0;
    const t = setTimeout(() => { busy.textContent = "Loading the Q# engine (first run only)…"; }, 700);
    const res = await runner.run(prog, {
      shots: n,
      timeoutMs: 120000,
      onEvent: (ev) => { if (shown++ < 300) appendEvent(box, ev); else if (shown === 302) box.appendChild(el("div", "small muted", "(further output hidden)")); },
    });
    clearTimeout(t);
    busy.textContent = "";
    running = false;
    runBtn.textContent = "▶ Run"; runBtn.classList.remove("stop");
    if (res.stopped) { out.appendChild(el("div", "callout small", "Stopped.")); return; }
    if (res.ok) {
      const vals = res.shots && res.shots.length ? res.shots : [res.value];
      if (n === 1) {
        const v = res.value;
        if (v !== "()" && v !== undefined) out.appendChild(el("div", "result", "Result: " + v));
        else if (!box.childNodes.length) out.appendChild(el("div", "small muted", "Finished, nothing was printed."));
      } else {
        const counts = new Map();
        for (const v of vals) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
        const hist = el("div", "hist");
        hist.appendChild(el("div", "small muted", `Results of ${vals.length} runs (${Math.round(res.ms)} ms):`));
        const max = Math.max(...counts.values());
        for (const [k, c] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          const row = el("div", "hist-row");
          row.appendChild(el("span", "mono hist-key", k));
          const b = el("span", "hist-bar");
          const f = el("span");
          f.style.width = (100 * c) / max + "%";
          b.appendChild(f);
          row.appendChild(b);
          row.appendChild(el("span", "mono small", `${c} (${((100 * c) / vals.length).toFixed(1)}%)`));
          hist.appendChild(row);
        }
        out.appendChild(hist);
      }
    } else {
      const lines = res.errors.map((e) => (e.file === "playground.qs" ? e.line : null));
      renderErrors(out, res.errors, (e) => lines[res.errors.indexOf(e)]);
      ed.setErrors(res.errors.filter((e) => e.file === "playground.qs" && e.line).map((e) => ({ line: e.line, message: e.message })));
    }
  }
  runBtn.addEventListener("click", run);
  return { root, destroy() { if (runner.current) runner.stop(); ed.destroy(); } };
}
