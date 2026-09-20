import { fileURLToPath } from "url";
process.chdir(fileURLToPath(new URL("../", import.meta.url))); // project root
// Validates the SHIPPED data: every task's reference solution must pass its test and its stub must not.
import fs from "fs";
import { runProgram, closeRunner } from "./runner.mjs";
import { buildTaskProgram } from "../src/assemble.mjs";
const shim = fs.readFileSync("shim/shim.qs", "utf8");
const only = process.argv[2];
let pass = 0, fail = 0, stubPass = 0;
for (const f of fs.readdirSync("dist/data/lessons")) {
  const L = JSON.parse(fs.readFileSync("dist/data/lessons/" + f));
  if (only && L.id !== only) continue;
  const tasks = L.blocks.filter((b) => b.t === "task" && !b.noTest);
  const others = (t) => tasks.filter((o) => o !== t && o.solutionCode).map((o) => ({ names: o.names, code: o.solutionCode }));
  for (const t of tasks) {
    if (!t.solutionCode) { console.log("NO-SOLUTION", L.id, t.id); fail++; continue; }
    let ok = true, detail = "";
    for (const code of [t.solutionCode, ...(t.altSolutionCodes || [])]) {
      try {
        const r = await runProgram(buildTaskProgram(shim, L, t, code, others(t)), 60000);
        if (!r.ok) { ok = false; detail = r.err; break; }
      } catch (e) { ok = false; detail = "ASSEMBLE " + e.message; break; }
    }
    let stub = "";
    try { const r = await runProgram(buildTaskProgram(shim, L, t, t.code, others(t)), 60000); if (r.ok) { stub = "STUB-PASSES"; stubPass++; } } catch (e) { stub = "STUB-ERR " + e.message.slice(0, 80); }
    if (ok) pass++; else fail++;
    console.log(ok ? "PASS" : "FAIL", L.id + "/" + t.id, stub, ok ? "" : String(detail).slice(0, 300));
  }
}
console.log(JSON.stringify({ pass, fail, stubPass }));
closeRunner(); process.exit(0);
