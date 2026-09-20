// Builds the exact list of Q# sources + entry expression for a kata test / tutorial demo.
import {
  adaptLegacy,
  extractOpens,
  stripOpens,
  findItems,
  spliceUserCode,
  snippetItemNames,
  DEFAULT_OPENS,
  codeMask,
  matchBracket,
  namespaceOf,
} from "./qs.mjs";

/**
 * lesson.project: [{ name, text, role }]  role: "tasks" | "reference" | "tests" | "other"
 * lesson.testNs : namespace containing the tests
 * others: [{ names, code }]  code for the *other* tasks of the lesson (learner's solved code, or the
 *          reference solution), so that tasks that build on earlier tasks can be checked on their own.
 */
export function buildTaskProgram(shim, lesson, task, userCode, others = []) {
  const opens = extractOpens(userCode);
  let code = stripOpens(userCode);
  const userItemNames = new Set(findItems(code, 0).map((it) => it.name));

  // Other tasks: splice their code in; helper items are added once, unless the user code defines them.
  const seenHelpers = new Set(userItemNames);
  const otherPlans = [];
  for (const o of others) {
    if (!o || !o.code) continue;
    let oc = stripOpens(o.code);
    for (const oo of extractOpens(o.code)) if (!opens.includes(oo)) opens.push(oo);
    // drop helper items that were already provided
    const items = findItems(oc, 0);
    const drop = items.filter((it) => !o.names.includes(it.name) && seenHelpers.has(it.name));
    for (let k = drop.length - 1; k >= 0; k--) oc = oc.slice(0, drop[k].start) + oc.slice(drop[k].end);
    for (const it of items) if (!o.names.includes(it.name)) seenHelpers.add(it.name);
    otherPlans.push({ names: o.names, code: oc });
  }

  const sources = [["shim.qs", shim]];
  let userPlaced = false;
  let userRange = null;
  // Helper names the learner (or the other tasks' code) defines: if the reference/test files of the lesson
  // define something with the same name (they share a namespace here, unlike the original notebooks), rename theirs.
  const definedHelpers = new Set(userItemNames);
  for (const o of otherPlans) for (const it of findItems(o.code, 0)) definedHelpers.add(it.name);
  for (const n of task.names) definedHelpers.delete(n);
  for (const f of lesson.project) {
    let text = f.text;
    if (f.role === "reference" || f.role === "tests") text = renameClashes(text, definedHelpers);
    if (f.role !== "tests" && f.role !== "reference") {
      for (const o of otherPlans) {
        const sp = spliceUserCode(text, o.names, o.code);
        if (sp !== null) text = sp;
      }
      if (!userPlaced) {
        const marker = "\u0001USERCODE\u0001";
        const spliced = spliceUserCode(text, task.names, marker);
        if (spliced !== null) {
          userPlaced = true;
          const at = spliced.indexOf(marker);
          let withOpens = addOpensToNamespace(spliced, opens);
          const idx = withOpens.indexOf(marker);
          const startLine = withOpens.slice(0, idx).split("\n").length; // 1-based line of user code start
          withOpens = withOpens.replace(marker, () => code);
          void at;
          userRange = { file: f.name, startLine, lineCount: code.split("\n").length };
          text = withOpens;
        }
      } else {
        text = addOpensToNamespace(text, opens);
      }
    }
    sources.push([f.name, adaptLegacy(text)]);
  }
  if (!userPlaced) {
    throw new Error(`Could not find where to place the code for ${task.id} (looking for: ${task.names.join(", ")})`);
  }
  return { sources, expr: `${lesson.testNs}.${task.id}()`, userRange };
}

function renameClashes(text, names) {
  if (!names.size) return text;
  const own = new Set(findItems(text, 1).map((it) => it.name));
  for (const n of names) {
    if (own.has(n)) text = text.replace(new RegExp(`\\b${n}\\b`, "g"), `${n}__lib`);
  }
  return text;
}

function addOpensToNamespace(src, opens) {
  if (!opens.length) return src;
  const mask = codeMask(src);
  const re = /\bnamespace\s+[A-Za-z0-9_.]+\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    if (mask[m.index]) {
      const at = m.index + m[0].length;
      return src.slice(0, at) + " " + opens.join(" ") + src.slice(at);
    }
  }
  return src;
}

function parseParams(itemText) {
  // itemText begins with `operation Name(...)` or `operation Name<'T>(...)`
  const mask = codeMask(itemText);
  const open = itemText.indexOf("(");
  if (open < 0) return [];
  const close = matchBracket(itemText, mask, open);
  const inner = itemText.slice(open + 1, close);
  const m2 = codeMask(inner);
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (!m2[i]) continue;
    const c = inner[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
  }
  if (inner.trim()) parts.push(inner.slice(start));
  return parts.map((p) => p.split(":")[0].trim()).filter(Boolean);
}

/**
 * cells: the plain code blocks of the lesson up to and including the one that is run.
 * entry: name of the operation (from a `%simulate` magic) and args: {name: valueText}
 */
export function buildSnippetProgram(shim, lesson, cellCodes, entry, args) {
  const opens = new Set(DEFAULT_OPENS.map((n) => `open ${n};`));
  const latest = new Map(); // name -> text  (later definitions override earlier ones)
  const order = [];
  for (const code of cellCodes) {
    for (const o of extractOpens(code)) opens.add(o);
    const body = stripOpens(code);
    const items = findItems(body, 0);
    for (const it of items) {
      if (!latest.has(it.name)) order.push(it.name);
      latest.set(it.name, body.slice(it.start, it.end));
    }
  }
  const sources = [["shim.qs", shim]];
  for (const f of lesson.project) sources.push([f.name, adaptLegacy(f.text)]);

  let qualified = null;
  let call;
  if (latest.has(entry)) {
    qualified = `Snippets.${entry}`;
  } else {
    // maybe defined in the lesson's own .qs files
    for (const f of lesson.project) {
      const it = findItems(f.text, 1).find((x) => x.name === entry);
      if (it) {
        const nsm = /\bnamespace\s+([A-Za-z0-9_.]+)/.exec(f.text);
        qualified = `${nsm ? nsm[1] : ""}.${entry}`;
        break;
      }
    }
  }
  if (!qualified) qualified = entry;

  // argument order from the operation's signature
  let argList = "";
  const entryText = latest.get(entry);
  if (entryText) {
    const params = parseParams(entryText);
    argList = params.map((p) => (args && p in args ? args[p] : "")).join(", ");
    if (params.length && params.some((p) => !(args && p in args))) {
      const missing = params.filter((p) => !(args && p in args));
      throw new Error(`Missing argument(s) for ${entry}: ${missing.join(", ")}`);
    }
  } else if (args) {
    argList = Object.values(args).join(", ");
  }

  // The kata's reference implementation (`Foo_Reference`, ...) was visible to notebook cells.
  for (const f of lesson.project) {
    if (f.role !== "reference") continue;
    const ns = namespaceOf(f.text);
    if (ns) opens.add(`open ${ns};`);
  }
  const snippet = `namespace Snippets {\n${[...opens].join("\n")}\n${order.map((n) => latest.get(n)).join("\n\n")}\n}\n`;
  sources.push(["snippet.qs", adaptLegacy(snippet)]);
  return { sources, expr: `${qualified}(${argList})` };
}

/** Program for the free-form playground editor. */
export function buildPlaygroundProgram(shim, code, entry) {
  const sources = [["shim.qs", shim], ["playground.qs", adaptLegacy(code)]];
  return { sources, expr: entry };
}

export { snippetItemNames };
