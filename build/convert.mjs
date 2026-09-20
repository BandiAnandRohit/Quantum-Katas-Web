// Converts the Quantum Katas repository into the data files of the static site.
//   node build/convert.mjs [path-to-QuantumKatas] [output-dir]   (defaults: content/QuantumKatas, dist)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import MiniSearch from "minisearch";
import { GROUPS, ALL_LESSONS } from "./curriculum.mjs";
import { loadProject } from "./project.mjs";
import { convertNotebook, parseWorkbooks, listWorkbooks } from "./nb.mjs";
import { referenceFromProject } from "./solutions.mjs";
import { CELL_PATCHES } from "./patches.mjs";
import { findItems, codeMask, matchBracket } from "../src/qs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, "../content/QuantumKatas"));
const OUT = path.resolve(process.argv[3] || path.join(HERE, "../dist"));
const DATA = path.join(OUT, "data");
const REPO_URL = "https://github.com/microsoft/QuantumKatas/blob/main/";

fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(path.join(DATA, "lessons"), { recursive: true });
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });

// ---- notebook file -> lesson id (to rewrite links between notebooks) -----------------------------------
const nbToLesson = new Map();
for (const L of ALL_LESSONS) {
  for (const nb of L.notebooks) nbToLesson.set(path.resolve(ROOT, L.dir, nb), L.id);
  // workbooks live next to the lesson
  const dir = path.resolve(ROOT, L.dir);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (/^Workbook_.*\.ipynb$/.test(f)) nbToLesson.set(path.join(dir, f), L.id);
  }
}
const dirToLesson = new Map(ALL_LESSONS.map((L) => [path.resolve(ROOT, L.dir), L.id]));

// ---- assets -------------------------------------------------------------------------------------------
const copied = new Map();
function assetFor(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const rel = path.relative(ROOT, absPath).split(path.sep).join("/");
  if (rel.startsWith("..")) return null;
  const url = "assets/" + rel;
  if (!copied.has(url)) {
    const dest = path.join(OUT, url);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(absPath, dest);
    copied.set(url, true);
  }
  return url.split("/").map(encodeURIComponent).join("/");
}
let imgCounter = 0;
function saveBase64Image(lessonId, b64, ext) {
  const hash = crypto.createHash("md5").update(b64).digest("hex").slice(0, 10);
  const rel = `assets/outputs/${lessonId}_${hash}.${ext}`;
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, Buffer.from(b64.replace(/\s/g, ""), "base64"));
  imgCounter++;
  return rel;
}

// ---- markdown rewriting -----------------------------------------------------------------------------------
const PHRASES = [
  [/run the cell using Ctrl\+Enter \(⌘\+Enter on macOS\)/gi, "press the **Check** button (or Ctrl+Enter)"],
  [/run the cell using Ctrl\+Enter \(⌘\+Enter on Mac\)/gi, "press the **Check** button (or Ctrl+Enter)"],
  [/run the code cell using Ctrl \+ Enter \(or ⌘ \+ Enter on macOS\)/gi, "press the **Check** button (or Ctrl+Enter)"],
  [/run the code cell using Ctrl\+Enter \(⌘\+Enter on macOS\)/gi, "press the **Check** button (or Ctrl+Enter)"],
];

function resolveTarget(nbDir, url) {
  // returns {route: "#/l/<id>[/anchor]"} | {external: url}
  if (/^(https?:|mailto:|data:|\/\/)/i.test(url)) return { external: url };
  if (url.startsWith("#")) return { anchor: url.slice(1) };
  const [pathPart, hash = ""] = url.split("#");
  const abs = path.resolve(nbDir, decodeURIComponent(pathPart));
  if (nbToLesson.has(abs)) {
    const id = nbToLesson.get(abs);
    return { route: `#/l/${id}${hash ? "/" + hash : ""}` };
  }
  // links to a lesson directory (README)
  if (dirToLesson.has(abs) || dirToLesson.has(abs.replace(/[\\/]$/, ""))) {
    return { route: `#/l/${dirToLesson.get(abs) || dirToLesson.get(abs.replace(/[\\/]$/, ""))}` };
  }
  if (/\.(png|jpe?g|gif|svg|mp4|webm|pdf)$/i.test(pathPart)) {
    const a = assetFor(abs);
    if (a) return { asset: a + (hash ? "#" + hash : "") };
  }
  if (fs.existsSync(abs)) {
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    return { external: REPO_URL + rel.split("/").map(encodeURIComponent).join("/") + (hash ? "#" + hash : "") };
  }
  return { none: true };
}

function rewriteMarkdown(md, nbDir, lessonId) {
  let out = md;
  for (const [re, rep] of PHRASES) out = out.replace(re, rep);
  // markdown links / images: [text](url) ![alt](url)
  out = out.replace(/(!?\[[^\]]*\])\(\s*([^()\s]*(?:\([^()]*\)[^()\s]*)*)(\s+"[^"]*")?\s*\)/g, (all, label, url, title) => {
    const t = resolveTarget(nbDir, url);
    const isImg = label.startsWith("!");
    if (t.external) return `${label}(${t.external}${title || ""})`;
    if (t.asset) return `${label}(${t.asset}${title || ""})`;
    if (t.route) return `${label}(${t.route}${title || ""})`;
    if (t.anchor !== undefined) return `${label}(#/l/${lessonId}/${t.anchor}${title || ""})`;
    return isImg ? all : label.replace(/^\[/, "[").replace(/\]$/, "]") + "(#/l/" + lessonId + ")";
  });
  // html attributes
  out = out.replace(/\b(src|href|poster)=("([^"]*)"|'([^']*)')/g, (all, attr, q, d, s) => {
    const url = d !== undefined ? d : s;
    const t = resolveTarget(nbDir, url);
    if (t.external) return `${attr}="${t.external}"`;
    if (t.asset) return `${attr}="${t.asset}"`;
    if (t.route) return `${attr}="${t.route}"`;
    if (t.anchor !== undefined) return `${attr}="#/l/${lessonId}/${t.anchor}"`;
    return all;
  });
  return out;
}

function fixCode(code) {
  return code
    .replace(/run the cell using Ctrl\+Enter \(⌘\+Enter on macOS\)/gi, "click Check (or press Ctrl+Enter)")
    .replace(/run the cell using Ctrl\+Enter \(⌘\+Enter on Mac\)/gi, "click Check (or press Ctrl+Enter)")
    .replace(/^\s*\/\/\s*Run (this|the next) cell.*\n/gim, "")
    .replace(/^\s*\/\/\s*Run the next cell to see the output.*\n/gim, "");
}

function walkBlocks(blocks, fn) {
  for (const b of blocks) {
    fn(b);
    if (b.t === "solution") walkBlocks(b.blocks, fn);
    if (b.t === "task" && b.solution) walkBlocks(b.solution, fn);
  }
}

// ---- headings / toc / search --------------------------------------------------------------------------------
function jupyterSlug(text) {
  return text.trim().replace(/\s/g, "-");
}
function plainMd(md) {
  return md
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]*\$/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Tasks.qs based conversion for a kata without notebook (Simon's algorithm) ------------------------------
function convertTasksQs(L, project) {
  const dir = path.resolve(ROOT, L.dir);
  const blocks = [];
  const tasks = [];
  const readme = path.join(dir, "README.md");
  if (fs.existsSync(readme)) {
    blocks.push({ t: "md", text: rewriteMarkdown(fs.readFileSync(readme, "utf8").replace(/^﻿/, ""), dir, L.id) });
  }
  const tasksFile = project.find((f) => f.role === "tasks");
  const testsFile = project.find((f) => f.role === "tests");
  const src = tasksFile.text;
  const items = findItems(src, 1).filter((it) => it.kind === "operation" || it.kind === "function");
  const testNames = testsFile ? findItems(testsFile.text, 1).map((i) => i.name) : [];
  let cursor = 0;
  for (const it of items) {
    // comment block directly above the item
    const before = src.slice(cursor, it.start);
    const lines = before.split("\n");
    // take trailing consecutive comment lines
    const comment = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (l.startsWith("//")) comment.unshift(l.replace(/^\/\/ ?/, ""));
      else if (l === "" && comment.length === 0) continue;
      else break;
    }
    // section headers (////... // Part I ... ////...)
    const sect = /\/\/\s*(Part [IVX]+\.[^\n]*)/.exec(before);
    if (sect && !blocks.some((b) => b.text && b.text.includes(sect[1]))) blocks.push({ t: "md", text: "## " + sect[1].trim() });
    const first = comment.findIndex((c) => /^Task\s+\d/.test(c));
    const desc = first >= 0 ? comment.slice(first) : comment;
    if (desc.length) {
      const title = desc[0];
      blocks.push({ t: "md", text: "### " + title });
      if (desc.length > 1) blocks.push({ t: "md", plain: true, text: desc.slice(1).join("\n") });
    }
    const itemText = src.slice(it.start, it.end);
    const suffix = it.name;
    const testName = testNames.find((n) => /^Q\d+_/.test(n) && n.endsWith("_" + suffix)) || null;
    const task = { t: "task", id: testName || `__notest_${suffix}`, code: itemText + "\n", names: [it.name], solution: null, solutionCode: null, altSolutionCodes: [], noTest: !testName };
    blocks.push(task);
    tasks.push(task);
    cursor = it.end;
  }
  return { blocks, tasks };
}

// ---- convert one lesson ---------------------------------------------------------------------------------
const searchDocs = [];
const indexOut = { groups: [] };
const report = [];

function convertLesson(L) {
  const dir = path.resolve(ROOT, L.dir);
  const { project, testNs } = fs.readdirSync(dir).some((f) => f.endsWith(".qs")) ? loadProject(dir, L.id) : { project: [], testNs: null };
  const workbook = parseWorkbooks(listWorkbooks(dir));
  let blocks = [];
  let tasks = [];
  let hasPython = false;
  let hasQsharp = false;

  if (L.notebooks.length === 0) {
    const r = convertTasksQs(L, project);
    blocks = r.blocks;
    tasks = r.tasks;
    hasQsharp = true;
  } else {
    L.notebooks.forEach((nbName, idx) => {
      const nbPath = path.join(dir, nbName);
      const conv = convertNotebook(nbPath, {
        workbook,
        emitOutputs: !!L.readOnly || undefined,
        saveImage: (b64, ext) => saveBase64Image(L.id, b64, ext),
      });
      if (idx > 0) blocks.push({ t: "hr" });
      if (conv.lang === "python") hasPython = true;
      else hasQsharp = true;
      // python outputs are kept for read-only python notebooks so the results can still be read
      blocks.push(...conv.blocks);
      tasks.push(...conv.tasks);
      // rewrite markdown in this notebook's blocks
      walkBlocks(conv.blocks, (b) => {
        if (b.t === "md") b.text = rewriteMarkdown(b.text, dir, L.id);
        if (b.t === "code") {
          b.code = fixCode(b.code);
          for (const p of CELL_PATCHES[L.id] || []) {
            if (b.code.includes(p.find)) { b.code = b.code.replace(p.find, () => p.replace); p.used = true; }
          }
          // fill-in-the-blank cells of the tutorials ("..." placeholders): not valid Q# until completed
          if (b.lang === "qsharp" && !b.static && /^\s*(use\s+)?\.\.\.\s*$|\bif\s+\.\.\.|\(\s*\.\.\.\s*\)/m.test(b.code)) b.incomplete = true;
        }
        if (b.t === "task") b.code = fixCode(b.code);
      });
    });
  }

  for (const p of CELL_PATCHES[L.id] || []) if (!p.used) throw new Error(`cell patch for ${L.id} did not apply`);
  // --- solutions for every task (workbook, or the reference implementation)
  for (const t of tasks) {
    if (t.noTest) continue;
    if (!t.solutionCode) {
      const ref = referenceFromProject(project, t.names);
      if (ref) {
        t.solutionCode = ref;
        t.solutionIsReference = true;
      }
    }
    if (t.solutionCode) t.solutionCode = fixCode(t.solutionCode);
    t.altSolutionCodes = (t.altSolutionCodes || []).map(fixCode);
    if (!t.solutionCode) report.push(`no solution for ${L.id}/${t.id}`);
  }

  // --- ids for headings, toc, search docs
  const toc = [];
  let currentHeading = L.title;
  let currentAnchor = "";
  for (const b of blocks) {
    if (b.t !== "md") continue;
    const lines = b.text.split("\n");
    for (const line of lines) {
      const m = /^(#{1,3})\s+(.*)$/.exec(line);
      if (m) {
        const text = plainMd(m[2]);
        if (!text) continue;
        const level = m[1].length;
        const id = jupyterSlug(m[2].replace(/<[^>]+>/g, ""));
        toc.push({ id, text, level });
        currentHeading = text;
        currentAnchor = id;
      }
    }
    const body = plainMd(b.text);
    if (body) searchDocs.push({ id: `${L.id}#${searchDocs.length}`, lesson: L.id, title: L.title, heading: currentHeading, anchor: currentAnchor, text: body.slice(0, 700) });
  }

  const lesson = {
    id: L.id,
    title: L.title,
    kind: L.kind,
    summary: L.summary,
    group: L.group,
    readOnly: !!L.readOnly,
    hasPython,
    hasQsharp,
    testNs,
    project,
    toc,
    blocks,
    taskIds: [
      ...tasks.filter((t) => !t.noTest).map((t) => t.id),
      // Python exercises (run with Pyodide in the browser) count as tasks, too
      ...(L.readOnly ? [] : blocks.filter((b) => b.t === "code" && b.exercise).map((b) => "py_" + b.exercise)),
    ],
  };

  // python helper modules (testing.py) for Pyodide
  if (hasPython) {
    const mods = {};
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".py")) mods[f.replace(/\.py$/, "")] = fs.readFileSync(path.join(dir, f), "utf8");
    lesson.pyModules = mods;
  }

  fs.writeFileSync(path.join(DATA, "lessons", `${L.id}.json`), JSON.stringify(lesson));
  return lesson;
}

for (const G of GROUPS) {
  const g = { id: G.id, title: G.title, lessons: [] };
  for (const L0 of G.lessons) {
    const L = { ...L0, group: G.id };
    const lesson = convertLesson(L);
    g.lessons.push({
      id: L.id,
      title: L.title,
      kind: L.kind,
      summary: L.summary,
      advanced: !!L.advanced,
      readOnly: !!L.readOnly,
      hasPython: lesson.hasPython,
      tasks: lesson.taskIds.length,
      taskIds: lesson.taskIds,
    });
  }
  indexOut.groups.push(g);
}
fs.writeFileSync(path.join(DATA, "index.json"), JSON.stringify(indexOut));

// search index
const ms = new MiniSearch({ fields: ["title", "heading", "text"], storeFields: ["lesson", "title", "heading", "anchor", "text"], searchOptions: { boost: { heading: 3, title: 2 }, prefix: true, fuzzy: 0.15 } });
ms.addAll(searchDocs);
fs.writeFileSync(path.join(DATA, "search.json"), JSON.stringify(ms.toJSON()));

// misc static resources
const quickref = path.join(ROOT, "quickref", "qsharp-quick-reference.pdf");
if (fs.existsSync(quickref)) {
  fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
  fs.copyFileSync(quickref, path.join(OUT, "assets", "qsharp-quick-reference.pdf"));
}
for (const f of ["LICENSE", "NOTICE.txt"]) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f === "LICENSE" ? "LICENSE-QuantumKatas.txt" : "NOTICE-QuantumKatas.txt"));

const nTasks = indexOut.groups.reduce((a, g) => a + g.lessons.reduce((b, l) => b + l.tasks, 0), 0);
console.log(`Converted ${ALL_LESSONS.length} lessons, ${nTasks} checkable tasks, ${copied.size} assets, ${imgCounter} output images, ${searchDocs.length} search docs`);
if (report.length) console.log(report.join("\n"));
