# Quantum Katas Web

An interactive, self-paced website built from Microsoft's [Quantum Katas](https://github.com/microsoft/QuantumKatas):
14 tutorials plus all the Q# programming exercises, with **real Q# running inside your browser** (the official Q# compiler and
simulator, compiled to WebAssembly).

- No server, no login, no sign-up, no tracking. It is a plain folder of static files.
- Progress and your code drafts are saved in your browser (`localStorage`); there is an export/import button for backups.
- Docs-style layout, sidebar curriculum, full-text search (press `/`), dark and light theme, works on phones.
- Every exercise has a **Check** button (runs the original kata tests), **Show solution**, and **Reset**.
- A **Q# playground** with samples, shot histograms and state dumps.
- The two Python tutorials (Complex arithmetic, Linear algebra) run in the browser through Pyodide.

Everything you need to host it is already built in `dist/`.

## Host it for free (pick one)

### GitHub Pages (recommended, free for public repositories)

1. Create a new **public** repository on GitHub and upload the contents of this folder (or `git push` it).
2. In the repository go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` publishes `dist/`, and the site appears at
   `https://<your-user>.github.io/<repo-name>/`.

The site uses only relative URLs, so it works both at a root domain and under a `/<repo-name>/` sub-path.

### Cloudflare Pages, Netlify, Vercel, GitLab Pages, Codeberg Pages, any web server

Upload or point the host at the `dist/` folder. There is no build command; the publish/output directory is `dist`.
On Netlify you can simply drag the `dist` folder onto the deploy page. Any host that serves static files works, including
your own nginx/Apache or an S3 bucket. The only requirement is that `.wasm` is served as `application/wasm` and `.mjs`/`.js`
as JavaScript, which every mainstream host already does.

> Opening `dist/index.html` by double-clicking (a `file://` address) does **not** work, because browsers block WebAssembly
> and web workers there. Use a host, or run the local server below.

### Try it locally

```bash
npm install        # only needed once, and only for the scripts below
npm run serve      # http://localhost:8080/
```

(`python3 -m http.server -d dist 8080` works as well.)

## Rebuilding from the source

`dist/` is generated, and it is already committed so that you do not have to build anything to publish. To regenerate it
(for example after editing lesson patches or the UI):

```bash
npm install
npm run build      # = npm run convert  (notebooks -> JSON)  +  npm run bundle  (app, worker, wasm, fonts, Pyodide)
```

| Path | What it holds |
| --- | --- |
| `content/QuantumKatas/` | Unmodified copy of the upstream repository (tutorials, katas, reference solutions). |
| `build/` | `convert.mjs` turns notebooks into lesson JSON; `patches.mjs` holds the small per-kata fixes; `build.mjs` bundles the app. |
| `src/` | Q# helpers shared by the build and the browser (adapting legacy kata code to the current Q#, assembling test programs). |
| `shim/shim.qs` | Compatibility library that provides the old `Microsoft.Quantum.*` kata APIs on top of the current Q# standard library. |
| `web/` | The single-page app (vanilla JS, CodeMirror 6, KaTeX, MiniSearch). |
| `tools/` | Validation scripts: `npm run validate` (every reference solution against every test, straight from the notebooks), `npm run validate:dist` (same, on the shipped data), `npm run validate:demos`. |

Validation status at release: all 335 reference solutions pass their checks, and starter stubs fail them (except 3 tasks whose
starter code is legitimately correct). To update the content, replace `content/QuantumKatas/` with a newer upstream copy and
run `npm run build`; new katas need an entry in `build/curriculum.mjs`.

## Things worth knowing

- **How checking works.** Your code is compiled together with the kata's test harness by the in-browser Q# compiler. The old
  katas were written for the legacy QDK, so a small adapter and shim translate them; a few checks are approximated:
  the "called the oracle exactly N times" counters are not enforced, and comparing two operations for equality is exact up to
  5 qubits and randomized beyond that.
- **Randomized tasks** (e.g. Grover with an unknown number of solutions) can rarely fail a correct solution. If a correct
  solution fails once, press **Check** again.
- **Read-only material.** The Quantum classification tutorial and the notebook cells that need the Python `qsharp` package,
  matplotlib or model training cannot run in a browser. They are shown as text with their saved results.
- **Python tutorials** download Pyodide (about 13 MB) the first time you press Run in one of them; the Q# engine downloads
  its 6 MB WebAssembly file when you first run Q# code. Both are cached by the browser afterwards.
- **Long-running checks** are stopped with the Stop button (the worker is terminated) and time out automatically.
- A modern browser is needed (Chrome, Edge, Firefox, Safari 15+).

## Credits and licence

- Lesson content, exercises, tests and reference solutions: © Microsoft Corporation, [Quantum Katas](https://github.com/microsoft/QuantumKatas),
  MIT licence (`content/QuantumKatas/LICENSE`, `content/QuantumKatas/NOTICE.txt`; both are also served from the site footer).
  This project is an unofficial re-packaging and is not affiliated with or endorsed by Microsoft.
- Q# compiler/simulator: [`qsharp-lang`](https://www.npmjs.com/package/qsharp-lang) (MIT). Other bundled libraries: CodeMirror,
  KaTeX, marked, MiniSearch, Pyodide, each under its own permissive licence.
- The code of this site is MIT licensed (see `LICENSE`).
