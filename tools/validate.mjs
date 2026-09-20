import { fileURLToPath } from "url";
process.chdir(fileURLToPath(new URL("../", import.meta.url))); // project root
import fs from "fs";
import path from "path";
import { runProgram, closeRunner } from "./runner.mjs";
import { ALL_LESSONS } from "../build/curriculum.mjs";
import { loadProject } from "../build/project.mjs";
import { convertNotebook, parseWorkbooks, listWorkbooks } from "../build/nb.mjs";
import { buildTaskProgram } from "../src/assemble.mjs";
import { referenceFromProject } from "../build/solutions.mjs";

const ROOT = path.resolve("content/QuantumKatas") + "/";
const shim = fs.readFileSync("shim/shim.qs", "utf8");
const only = process.argv[2];
const results = [];

for (const L of ALL_LESSONS) {
  if (only && L.id !== only) continue;
  const dir = ROOT + L.dir;
  const { project, testNs } = loadProject(dir, L.id);
  const wb = parseWorkbooks(listWorkbooks(dir));
  const lesson = { project, testNs };
  for (const nbName of L.notebooks) {
    const nbPath = path.join(dir, nbName);
    const conv = convertNotebook(nbPath, { workbook: wb });
    if (conv.lang !== "qsharp") continue;
    // reference code for every task (workbook solution or ReferenceImplementation.qs)
    for (const task of conv.tasks) {
      if (!task.solutionCode) {
        const ref = referenceFromProject(project, task.names);
        if (ref) { task.solutionCode = ref; task.refFromProject = true; }
      }
    }
    const refOthers = (k) => conv.tasks.filter((t) => t !== k && t.solutionCode).map((t) => ({ names: t.names, code: t.solutionCode }));
    for (const task of conv.tasks) {
      const label = `${L.id}/${task.id}`;
      const codes = task.solutionCode ? [task.solutionCode, ...task.altSolutionCodes] : [];
      if (!codes.length) {
        results.push({ label, status: "NO-SOLUTION" });
        console.log("NO-SOLUTION", label);
        continue;
      }
      let allOk = true;
      let detail = "";
      let ms = 0;
      for (const code of codes) {
        try {
          const prog = buildTaskProgram(shim, lesson, task, code, refOthers(task));
          const r = await runProgram(prog, 30000);
          ms += r.ms;
          if (!r.ok) {
            allOk = false;
            detail = r.err;
            break;
          }
        } catch (e) {
          allOk = false;
          detail = "ASSEMBLE: " + e.message;
          break;
        }
      }
      let stubStatus = "";
      try {
        const prog = buildTaskProgram(shim, lesson, task, task.code, refOthers(task));
        const r = await runProgram(prog, 30000);
        stubStatus = r.ok ? "STUB-PASSES" : r.timeout ? "STUB-TIMEOUT" : "";
      } catch (e) {
        stubStatus = "STUB-ASSEMBLE-ERR " + e.message;
      }
      results.push({ label, status: allOk ? "PASS" : "FAIL", detail: detail.slice(0, 300), ms, stubStatus, ref: task.refFromProject ? "ref" : "wb" });
      console.log(allOk ? "PASS" : "FAIL", label, ms + "ms", stubStatus, task.refFromProject ? "(ref)" : "", allOk ? "" : detail.slice(0, 300));
    }
  }
}
const c = {};
for (const r of results) c[r.status] = (c[r.status] || 0) + 1;
console.log(JSON.stringify(c));
fs.writeFileSync("tools/validate-results.json", JSON.stringify(results, null, 1));
closeRunner();
process.exit(0);
