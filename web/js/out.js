// Rendering of program output: messages, quantum state dumps, matrices, errors.
import { renderLatexInto } from "./md.js";

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function fmt(x) {
  const r = Math.round(x * 10000) / 10000;
  return (Object.is(r, -0) ? 0 : r).toString();
}

function complexText(re, im) {
  const a = Math.abs(re) < 5e-5, b = Math.abs(im) < 5e-5;
  if (a && b) return "0";
  if (b) return fmt(re);
  if (a) return fmt(im) + "i";
  return `${fmt(re)} ${im < 0 ? "−" : "+"} ${fmt(Math.abs(im))}i`;
}

export function renderDump(ev) {
  const wrap = el("div", "dump");
  const entries = Object.entries(ev.state || {});
  if (!entries.length) {
    wrap.appendChild(el("div", "dump-empty", "The state is |0…0⟩ (no non-zero amplitudes reported)."));
    return wrap;
  }
  const table = el("table");
  const head = el("tr");
  for (const h of ["Basis state", "Amplitude", "Measurement probability", "Phase"]) head.appendChild(el("th", "", h));
  table.appendChild(head);
  for (const [label, amp] of entries) {
    const [re, im] = amp;
    const p = re * re + im * im;
    const tr = el("tr");
    tr.appendChild(el("td", "mono", label));
    tr.appendChild(el("td", "mono", complexText(re, im)));
    const pc = el("td", "probcell");
    const bar = el("span", "probbar");
    bar.style.width = Math.max(0, Math.min(100, p * 100)).toFixed(1) + "%";
    pc.appendChild(bar);
    pc.appendChild(el("span", "probtext", (p * 100).toFixed(p < 0.001 && p > 0 ? 3 : 1) + "%"));
    tr.appendChild(pc);
    const ph = el("td", "phase");
    if (p > 1e-9) {
      const ang = Math.atan2(im, re);
      const arrow = el("span", "arrow", "↑");
      arrow.style.transform = `rotate(${(ang * 180) / Math.PI}deg)`;
      ph.appendChild(arrow);
      ph.appendChild(el("span", "mono small", ((ang * 180) / Math.PI).toFixed(0) + "°"));
    }
    tr.appendChild(ph);
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  if (ev.stateLatex) {
    const l = el("div", "dump-latex");
    renderLatexInto(l, ev.stateLatex, false);
    wrap.appendChild(l);
  }
  return wrap;
}

export function renderMatrix(ev) {
  const d = el("div", "matrix");
  if (ev.matrixLatex) renderLatexInto(d, ev.matrixLatex, true);
  else d.textContent = JSON.stringify(ev.matrix);
  return d;
}

/** Appends one event to the container. */
export function appendEvent(container, ev) {
  if (ev.type === "Message") {
    const d = el("div", "msg");
    d.textContent = ev.message;
    container.appendChild(d);
  } else if (ev.type === "DumpMachine") container.appendChild(renderDump(ev));
  else if (ev.type === "Matrix") container.appendChild(renderMatrix(ev));
}

/** Clean up compiler messages for learners. */
export function cleanMessage(msg) {
  return msg
    .replace(/^runtime error: program failed: /, "")
    .replace(/^runtime error: /, "")
    .replace(/\s+help:\s*/g, "\n→ ")
    .trim();
}

/** Turns a compile / runtime error from the engine into a readable block. `mapLine(err)` may return a user line. */
export function renderErrors(container, errors, mapLine) {
  const seen = new Set();
  for (const e of errors) {
    const key = e.message + "|" + e.line + "|" + e.file;
    if (seen.has(key)) continue;
    seen.add(key);
    const d = el("div", "err");
    const line = mapLine ? mapLine(e) : null;
    const isRuntime = /^runtime error/.test(e.message);
    const isTest = /program failed/.test(e.message);
    let title = isTest ? "Test failed" : isRuntime ? "Runtime error" : /syntax error|type error|name error|error/.test(e.message.slice(0, 40)) ? "Compile error" : "Error";
    const head = el("div", "err-title", title + (line ? ` (line ${line})` : ""));
    d.appendChild(head);
    const body = el("pre", "err-body");
    body.textContent = cleanMessage(e.message);
    d.appendChild(body);
    container.appendChild(d);
  }
}
