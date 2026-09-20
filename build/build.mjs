// Bundles the front-end into dist/ (run `node build/convert.mjs` first for the lesson data).
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
process.chdir(fileURLToPath(new URL("../", import.meta.url))); // project root

const OUT = path.resolve("dist");
const common = { bundle: true, minify: true, sourcemap: false, target: ["es2020"], loader: { ".qs": "text" }, logLevel: "warning", legalComments: "none" };

await esbuild.build({ ...common, entryPoints: ["web/js/app.js"], outfile: `${OUT}/app.js`, format: "iife", platform: "browser", conditions: ["browser"] });
await esbuild.build({ ...common, entryPoints: ["web/js/qsworker.js"], outfile: `${OUT}/qsworker.js`, format: "iife", platform: "browser", conditions: ["browser"] });

fs.mkdirSync(`${OUT}/vendor/katex`, { recursive: true });
fs.copyFileSync("node_modules/qsharp-lang/lib/web/qsc_wasm_bg.wasm", `${OUT}/qsc_wasm_bg.wasm`);
fs.copyFileSync("node_modules/katex/dist/katex.min.css", `${OUT}/vendor/katex/katex.min.css`);
fs.cpSync("node_modules/katex/dist/fonts", `${OUT}/vendor/katex/fonts`, { recursive: true });
for (const f of fs.readdirSync(`${OUT}/vendor/katex/fonts`)) if (!f.endsWith(".woff2")) fs.rmSync(`${OUT}/vendor/katex/fonts/${f}`); // woff2 is enough for all current browsers
let css = fs.readFileSync(`${OUT}/vendor/katex/katex.min.css`, "utf8");
css = css.replace(/,\s*url\([^)]*\.woff\)\s*format\("woff"\)/g, "").replace(/,\s*url\([^)]*\.ttf\)\s*format\("truetype"\)/g, "");
fs.writeFileSync(`${OUT}/vendor/katex/katex.min.css`, css);

// Pyodide (Python in the browser) for the two Python tutorials, self-hosted so that nothing depends on a CDN
fs.mkdirSync(`${OUT}/pyodide`, { recursive: true });
for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) fs.copyFileSync(`node_modules/pyodide/${f}`, `${OUT}/pyodide/${f}`);

fs.copyFileSync("web/index.html", `${OUT}/index.html`);
fs.copyFileSync("web/css/app.css", `${OUT}/app.css`);
fs.copyFileSync("web/js/pyworker.js", `${OUT}/pyworker.js`);
fs.copyFileSync("web/favicon.svg", `${OUT}/favicon.svg`);
fs.writeFileSync(`${OUT}/.nojekyll`, "");
const size = (f) => (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0) + " KB";
console.log("app.js", size("app.js"), "| qsworker.js", size("qsworker.js"), "| wasm", size("qsc_wasm_bg.wasm"));
