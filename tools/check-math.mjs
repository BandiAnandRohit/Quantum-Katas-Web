import { fileURLToPath } from "url";
process.chdir(fileURLToPath(new URL("../", import.meta.url))); // project root
import fs from "fs";
import { renderMarkdown } from "../web/js/md.js";
let bad = 0, total = 0;
for (const f of fs.readdirSync("dist/data/lessons")) {
  const L = JSON.parse(fs.readFileSync("dist/data/lessons/" + f));
  const walk = (bs) => {
    for (const b of bs) {
      if (b.t === "md" && !b.plain) {
        total++;
        const html = renderMarkdown(b.text);
        // strip rendered math and code, then look for leftovers
        const rest = html.replace(/<span class="katex[\s\S]*?<\/span><\/span><\/span>/g, "").replace(/<code[\s\S]*?<\/code>/g, "").replace(/<pre[\s\S]*?<\/pre>/g, "").replace(/<[^>]+>/g, "");
        const m = /\$\$|\\begin|\\frac|\\end\{|katex-error|\\sqrt|\\rangle|\$[^$\n]{1,80}\$/.exec(rest);
        if (m) { bad++; const i = m.index; console.log(L.id, "→", rest.slice(Math.max(0, i - 60), i + 90).replace(/\n/g, " ")); }
      }
      if (b.t === "solution") walk(b.blocks);
      if (b.t === "task" && b.solution) walk(b.solution);
    }
  };
  walk(L.blocks);
}
console.log({ total, bad });
