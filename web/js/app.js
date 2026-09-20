import MiniSearch from "minisearch";
import { el } from "./out.js";
import { store } from "./store.js";
import { QsRunner } from "./runner.js";
import { PyRunner } from "./py.js";
import { renderLesson } from "./lesson.js";
import { renderHome, renderPlayground } from "./pages.js";

const $ = (sel) => document.querySelector(sel);

// ---- base URL (works from any sub-path, e.g. https://user.github.io/repo/) ------------------------------
const BASE = new URL(".", document.currentScript ? document.currentScript.src : location.href).href;

const ctx = {
  index: null,
  order: [],
  lessonInfo: new Map(),
  runner: new QsRunner(BASE + "qsworker.js", BASE + "qsc_wasm_bg.wasm"),
  py: new PyRunner(BASE + "pyworker.js"),
};

// ---- theme --------------------------------------------------------------------------------------------------
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  const b = $("#theme-btn");
  if (b) { b.textContent = t === "dark" ? "☀" : "☾"; b.title = t === "dark" ? "Switch to the light theme" : "Switch to the dark theme"; }
}
function initTheme() {
  let t = store.getText("theme");
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(t);
  $("#theme-btn").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store.setText("theme", next);
    applyTheme(next);
  });
}

// ---- data -----------------------------------------------------------------------------------------------------
const lessonCache = new Map();
async function loadLesson(id) {
  if (lessonCache.has(id)) return lessonCache.get(id);
  const r = await fetch(BASE + `data/lessons/${id}.json`);
  if (!r.ok) throw new Error(`lesson ${id} not found`);
  const d = await r.json();
  lessonCache.set(id, d);
  return d;
}

// ---- sidebar ----------------------------------------------------------------------------------------------------
function buildSidebar() {
  const nav = $("#tree");
  nav.textContent = "";
  const openGroups = store.getJSON("groups", {});
  for (const g of ctx.index.groups) {
    const det = el("details", "grp");
    det.dataset.group = g.id;
    if (openGroups[g.id] !== false) det.open = true;
    det.addEventListener("toggle", () => { const o = store.getJSON("groups", {}); o[g.id] = det.open; store.setJSON("groups", o); });
    det.appendChild(el("summary", "", g.title));
    const ul = el("ul");
    for (const l of g.lessons) {
      const li = el("li");
      const a = el("a", "lnk");
      a.href = "#/l/" + l.id;
      a.dataset.lesson = l.id;
      a.appendChild(el("span", "lnk-title", l.title));
      if (l.advanced) a.appendChild(el("span", "tag", "adv"));
      const st = el("span", "lnk-status");
      st.dataset.status = l.id;
      a.appendChild(st);
      li.appendChild(a);
      ul.appendChild(li);
    }
    det.appendChild(ul);
    nav.appendChild(det);
  }
  updateSidebarStatus();
}

function updateSidebarStatus() {
  for (const g of ctx.index.groups) {
    for (const l of g.lessons) {
      const st = document.querySelector(`[data-status="${l.id}"]`);
      if (!st) continue;
      if (l.tasks) {
        const d = l.taskIds.filter((id) => store.isPassed(l.id, id)).length;
        st.textContent = d === l.tasks ? "✓" : d ? `${d}/${l.tasks}` : "";
        st.className = "lnk-status" + (d === l.tasks ? " done" : "");
      } else {
        st.textContent = store.isDone(l.id) ? "✓" : "";
        st.className = "lnk-status" + (store.isDone(l.id) ? " done" : "");
      }
    }
  }
}

function markActive(id) {
  document.querySelectorAll("#tree a.lnk").forEach((a) => a.classList.toggle("active", a.dataset.lesson === id));
  document.querySelectorAll("#side-links a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === (id === "__home" ? "#/" : id === "__pg" ? "#/playground" : "")));
  if (id && !id.startsWith("__")) {
    const a = document.querySelector(`#tree a[data-lesson="${id}"]`);
    if (a) {
      const det = a.closest("details");
      if (det && !det.open) det.open = true;
      const box = $("#sidebar");
      const r = a.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (r.top < br.top + 40 || r.bottom > br.bottom - 20) a.scrollIntoView({ block: "center" });
    }
  }
}

// ---- search ----------------------------------------------------------------------------------------------------
let searchIndex = null;
let searchLoading = null;
async function ensureSearch() {
  if (searchIndex) return searchIndex;
  if (!searchLoading) {
    searchLoading = fetch(BASE + "data/search.json")
      .then((r) => r.text())
      .then((t) => {
        searchIndex = MiniSearch.loadJSON(t, {
          fields: ["title", "heading", "text"],
          storeFields: ["lesson", "title", "heading", "anchor", "text"],
        });
        return searchIndex;
      });
  }
  return searchLoading;
}

function initSearch() {
  const input = $("#search");
  const box = $("#search-results");
  let active = -1;
  const close = () => { box.classList.add("hidden"); box.textContent = ""; active = -1; };
  const go = (hit) => {
    close();
    input.value = "";
    input.blur();
    location.hash = `#/l/${hit.lesson}${hit.anchor ? "/" + hit.anchor : ""}`;
    document.body.classList.remove("nav-open");
  };
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    const idx = await ensureSearch();
    const seen = new Set();
    const hits = [];
    for (const h of idx.search(q, { boost: { heading: 3, title: 2 }, prefix: true, fuzzy: 0.15, combineWith: "AND" })) {
      const key = h.lesson + "|" + h.anchor;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(h);
      if (hits.length >= 10) break;
    }
    box.textContent = "";
    box.classList.remove("hidden");
    if (!hits.length) { box.appendChild(el("div", "sr-empty", "No results")); return; }
    hits.forEach((h, i) => {
      const a = el("a", "sr");
      a.href = `#/l/${h.lesson}${h.anchor ? "/" + h.anchor : ""}`;
      a.appendChild(el("div", "sr-title", h.title + (h.heading && h.heading !== h.title ? " › " + h.heading : "")));
      a.appendChild(el("div", "sr-text", (h.text || "").slice(0, 130)));
      a.addEventListener("click", (e) => { e.preventDefault(); go(h); });
      box.appendChild(a);
    });
  };
  let timer = null;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener("focus", () => ensureSearch());
  input.addEventListener("keydown", (e) => {
    const items = [...box.querySelectorAll("a.sr")];
    if (e.key === "Escape") { close(); input.blur(); }
    else if (e.key === "ArrowDown" && items.length) { e.preventDefault(); active = (active + 1) % items.length; items.forEach((x, i) => x.classList.toggle("sel", i === active)); }
    else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; items.forEach((x, i) => x.classList.toggle("sel", i === active)); }
    else if (e.key === "Enter" && items.length) { e.preventDefault(); items[Math.max(active, 0)].click(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#search-wrap")) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.closest(".cm-editor")) {
      e.preventDefault();
      input.focus();
    }
  });
}

// ---- routing ------------------------------------------------------------------------------------------------------
let current = null; // {kind, id, destroy}
const main = () => $("#main");

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  if (!h) return { page: "home" };
  const parts = h.split("/");
  if (parts[0] === "l" && parts[1]) return { page: "lesson", id: decodeURIComponent(parts[1]), anchor: parts.slice(2).join("/") };
  if (parts[0] === "playground") return { page: "playground" };
  return { page: "home" };
}

function scrollToAnchor(anchor) {
  if (!anchor) { window.scrollTo(0, 0); return; }
  const cands = [anchor];
  try { cands.push(decodeURIComponent(anchor)); } catch (e) {}
  for (const c of cands) {
    const t = document.getElementById(c);
    if (t) { t.scrollIntoView(); highlight(t); return; }
  }
}
function highlight(t) {
  t.classList.remove("flash");
  void t.offsetWidth;
  t.classList.add("flash");
}

function buildToc(lesson, container) {
  container.textContent = "";
  const items = lesson.toc.filter((t) => t.level <= 2);
  if (items.length < 3) return () => {};
  container.appendChild(el("div", "toc-title", "On this page"));
  const ul = el("ul");
  const links = [];
  for (const t of items) {
    const li = el("li", "l" + t.level);
    const a = el("a", "", t.text);
    a.href = `#/l/${lesson.id}/${t.id}`;
    li.appendChild(a);
    ul.appendChild(li);
    links.push({ a, id: t.id });
  }
  container.appendChild(ul);
  let ticking = false;
  const spy = () => {
    ticking = false;
    let best = null;
    for (const l of links) {
      const h = document.getElementById(l.id);
      if (!h) continue;
      if (h.getBoundingClientRect().top < 120) best = l; else break;
    }
    links.forEach((l) => l.a.classList.toggle("active", l === best));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  spy();
  return () => window.removeEventListener("scroll", onScroll);
}

function footer() {
  const f = el("footer", "site-foot");
  f.innerHTML =
    'Lessons and exercises are from Microsoft’s <a href="https://github.com/microsoft/QuantumKatas" target="_blank" rel="noopener">Quantum Katas</a> (MIT License, © Microsoft Corporation). ' +
    'Code runs with the <a href="https://github.com/microsoft/qdk" target="_blank" rel="noopener">Q# compiler and simulator</a> compiled to WebAssembly. ' +
    'This is an unofficial, static re-packaging: no server, no tracking, no account. <a href="LICENSE-QuantumKatas.txt" target="_blank">License</a> · <a href="NOTICE-QuantumKatas.txt" target="_blank">Notices</a> · <a href="assets/qsharp-quick-reference.pdf" target="_blank">Q# quick reference (PDF)</a>';
  return f;
}

async function route() {
  const r = parseHash();
  document.body.classList.remove("nav-open");
  const m = main();
  // same lesson, different anchor: only scroll
  if (r.page === "lesson" && current && current.kind === "lesson" && current.id === r.id) {
    scrollToAnchor(r.anchor);
    return;
  }
  if (current) { current.destroy(); current = null; }
  m.textContent = "";
  $("#toc").textContent = "";
  document.title = "Quantum Katas — learn quantum computing in your browser";
  if (r.page === "home") {
    markActive("__home");
    const p = renderHome(ctx);
    m.appendChild(p.root);
    m.appendChild(footer());
    current = { kind: "home", destroy: p.destroy };
    window.scrollTo(0, 0);
  } else if (r.page === "playground") {
    markActive("__pg");
    document.title = "Q# playground — Quantum Katas";
    const p = renderPlayground(ctx);
    m.appendChild(p.root);
    m.appendChild(footer());
    current = { kind: "playground", destroy: p.destroy };
    window.scrollTo(0, 0);
  } else if (r.page === "lesson") {
    const info = ctx.lessonInfo.get(r.id);
    if (!info) { m.appendChild(el("p", "err-page", "Lesson not found. ")); const a = el("a", "", "Back to the start"); a.href = "#/"; m.appendChild(a); return; }
    markActive(r.id);
    document.title = `${info.title} — Quantum Katas`;
    m.appendChild(el("div", "loading", "Loading…"));
    let lesson;
    try {
      lesson = await loadLesson(r.id);
    } catch (e) {
      m.textContent = "";
      m.appendChild(el("p", "err-page", "Could not load this lesson: " + e.message));
      return;
    }
    // the route may have changed while loading
    const now = parseHash();
    if (now.page !== "lesson" || now.id !== r.id) return;
    m.textContent = "";
    store.setText("last", r.id);
    const view = renderLesson(ctx, lesson);
    m.appendChild(view.root);
    // previous / next
    const i = ctx.order.indexOf(r.id);
    const nav = el("nav", "pager");
    if (i > 0) { const a = el("a", "pager-prev"); a.href = "#/l/" + ctx.order[i - 1]; a.innerHTML = `<span class="small">Previous</span><br>${ctx.lessonInfo.get(ctx.order[i - 1]).title}`; nav.appendChild(a); } else nav.appendChild(el("span"));
    if (i < ctx.order.length - 1) { const a = el("a", "pager-next"); a.href = "#/l/" + ctx.order[i + 1]; a.innerHTML = `<span class="small">Next</span><br>${ctx.lessonInfo.get(ctx.order[i + 1]).title}`; nav.appendChild(a); }
    m.appendChild(nav);
    m.appendChild(footer());
    const offToc = buildToc(lesson, $("#toc"));
    current = { kind: "lesson", id: r.id, destroy: () => { view.destroy(); offToc(); } };
    // wait for layout (math, images) before jumping to an anchor
    requestAnimationFrame(() => { scrollToAnchor(r.anchor); if (!r.anchor) window.scrollTo(0, 0); });
    if ("requestIdleCallback" in window) requestIdleCallback(() => ctx.runner.warm(), { timeout: 4000 });
    else setTimeout(() => ctx.runner.warm(), 1500);
  }
}

// ---- boot ---------------------------------------------------------------------------------------------------------------
async function boot() {
  initTheme();
  try {
    const r = await fetch(BASE + "data/index.json");
    ctx.index = await r.json();
  } catch (e) {
    $("#main").textContent = "Could not load the curriculum: " + e.message;
    return;
  }
  for (const g of ctx.index.groups) for (const l of g.lessons) { ctx.order.push(l.id); ctx.lessonInfo.set(l.id, l); }
  buildSidebar();
  initSearch();
  store.onChange(updateSidebarStatus);
  $("#menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", () => {});
  await route();
}

boot();
