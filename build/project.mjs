import fs from "fs";
import path from "path";
import { stripTestAttributes, namespaceOf, findItems } from "../src/qs.mjs";
import { PATCHES } from "./patches.mjs";

const ROLE = (name) => (name === "Tasks.qs" ? "tasks" : name === "ReferenceImplementation.qs" ? "reference" : name === "Tests.qs" ? "tests" : "other");

/** Load all .qs files of a lesson directory. */
export function loadProject(dir, patchKey) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".qs")).sort();
  const project = [];
  for (const name of files) {
    let text = fs.readFileSync(path.join(dir, name), "utf8").replace(/^﻿/, "");
    text = stripTestAttributes(text);
    for (const p of PATCHES[patchKey] || []) {
      if (p.file !== name) continue;
      if (p.find !== undefined) {
        if (!text.includes(p.find)) throw new Error(`Patch for ${patchKey}/${name} did not apply: ${p.find.slice(0, 50)}`);
        text = text.replace(p.find, () => p.replace);
      } else if (p.op) {
        const it = findItems(text, 1).find((x) => x.name === p.op);
        if (!it) throw new Error(`Patch op ${p.op} not found in ${patchKey}/${name}`);
        text = text.slice(0, it.start) + p.source + text.slice(it.end);
      }
    }
    project.push({ name, text, role: ROLE(name) });
  }
  const tests = project.find((f) => f.role === "tests");
  const testNs = tests ? namespaceOf(tests.text) : null;
  return { project, testNs };
}
