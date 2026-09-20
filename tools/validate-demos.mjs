import { fileURLToPath } from "url";
process.chdir(fileURLToPath(new URL("../", import.meta.url))); // project root
import fs from "fs";
import { runProgram, closeRunner } from "./runner.mjs";
import { buildSnippetProgram } from "../src/assemble.mjs";
const shim = fs.readFileSync("shim/shim.qs", "utf8");
const only = process.argv[2];
let pass = 0, fail = 0, total = 0;
for (const f of fs.readdirSync("dist/data/lessons")) {
  const L = JSON.parse(fs.readFileSync("dist/data/lessons/" + f));
  if (only && L.id !== only) continue;
  if (!L.hasQsharp) continue;
  const cells = [];
  const walk = async (blocks) => {
    for (const b of blocks) {
      if (b.t === "task" && !b.noTest) cells.push(b.solutionCode || b.code);
      if (b.t === "code" && b.lang === "qsharp" && !b.static) {
        if (!b.refOnly && !(b.incomplete && !b.entry)) cells.push(b.code);
        if (b.entry) {
          total++;
          try {
            const prog = buildSnippetProgram(shim, L, cells, b.entry, b.args || {});
            if (b.incomplete) { console.log("SKIP (fill-in-the-blank)", L.id, b.entry); pass++; continue; }
            const r = await runProgram(prog, 30000);
            if (r.ok) { pass++; console.log("PASS", L.id, b.entry, r.ms + "ms", JSON.stringify(r.msgs.join("|").slice(0, 80))); }
            else { fail++; console.log("FAIL", L.id, b.entry, String(r.err).slice(0, 350)); }
          } catch (e) { fail++; console.log("FAIL", L.id, b.entry, "ASSEMBLE " + e.message.slice(0, 300)); }
        }
      }
    }
  };
  await walk(L.blocks);
}
console.log(JSON.stringify({ total, pass, fail }));
closeRunner(); process.exit(0);
