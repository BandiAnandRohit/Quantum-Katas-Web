# Quantum Katas Web

**Quantum Katas Web** is an interactive, browser-based learning platform for quantum computing based on Microsoft's [Quantum Katas](https://github.com/microsoft/QuantumKatas).

The project brings the Quantum Katas learning experience into a modern web interface where learners can study quantum computing concepts, write Q# programs, execute quantum programs, and validate their solutions directly in the browser.

The platform contains **14 quantum computing tutorials together with the associated Q# programming exercises**, including exercises, tests, reference solutions, and interactive examples.

Unlike a conventional documentation website, Quantum Katas Web provides an actual browser-based programming environment. Q# programs are compiled and executed using the Q# compiler and simulator through **WebAssembly**, allowing quantum programming exercises to run directly on the user's computer without requiring a local Q# installation or a backend server.

---

## 🚀 Get Started

There are two ways to use Quantum Katas Web.

### Option 1 — Use the Online Website

The easiest way to start learning is to use the hosted version:

### [Quantum Katas — Learn Quantum Computing in Your Browser](https://bandianandrohit.github.io/Quantum-Katas-Web/)

No installation, account, login, or configuration is required.

The online platform provides the complete interactive learning environment directly in your web browser.

You can:

* Explore the complete Quantum Katas curriculum.
* Read interactive quantum computing tutorials.
* Practice Q# programming through browser-based exercises.
* Write and edit Q# code directly in the browser.
* Compile and execute Q# programs using the browser-based Q# engine.
* Use the **Check** button to test your solutions against the exercise test cases.
* View the expected/reference solution using **Show Solution**.
* Restore the original exercise using **Reset**.
* Experiment with Q# programs using the interactive **Q# Playground**.
* Run quantum examples and inspect measurement results.
* View shot histograms for quantum experiments.
* Inspect quantum state information through state dumps.
* Work through the Python-based tutorials directly in the browser.
* Use the built-in search to quickly find lessons and topics.
* Switch between light and dark themes.
* Continue your learning progress using browser-based storage.

The website is designed to work on modern desktop and mobile browsers.

---

## 💻 Option 2 — Run Quantum Katas Web Locally

You can also run the complete project on your own computer.

Running the project locally is useful if you want to:

* Study the implementation of the platform.
* Modify the user interface.
* Add or modify tutorials.
* Modify Q# exercises.
* Experiment with the Q# execution engine.
* Customize the curriculum.
* Develop new features.
* Test changes before publishing your own version.

### Requirements

Install:

* [Node.js](https://nodejs.org/)
* npm
* A modern web browser such as Chrome, Edge, Firefox, or Safari.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/BandiAnandRohit/Quantum-Katas-Web.git
cd Quantum-Katas-Web
```

### Step 2 — Install Dependencies

```bash
npm install
```

This installs the packages required by the project.

### Step 3 — Start the Local Website

```bash
npm run serve
```

The website will be available at:

```text
http://localhost:8080/
```

Open that address in your browser.

You should now see the same Quantum Katas Web interface that is available through the online version.

### Alternative Local Server

Because the generated website is already available in the `dist/` directory, it can also be served directly using Python:

```bash
python3 -m http.server -d dist 8080
```

On Windows, you can use:

```bash
py -m http.server -d dist 8080
```

Then open:

```text
http://localhost:8080/
```

### Important

Do not open `dist/index.html` by double-clicking it.

That creates a `file://` URL, and browser security restrictions can prevent WebAssembly and web workers from functioning correctly.

Always access the application through a local HTTP server such as:

```text
http://localhost:8080/
```

---

# 📚 About the Project

Quantum Katas Web transforms the original Quantum Katas learning material into a unified, interactive web-based environment.

The project combines educational content, Q# programming exercises, automated testing, browser-based quantum simulation, and interactive learning tools in a single application.

The primary goal is to make quantum programming more accessible by removing the need for learners to install and configure a complete quantum development environment before they can begin solving exercises.

---

## 🧑‍💻 Interactive Q# Programming

A central feature of Quantum Katas Web is the ability to write and execute Q# programs directly inside the browser.

The platform uses the Q# compiler and simulator compiled to **WebAssembly**. This allows the application to perform Q# compilation and quantum simulation locally within the user's browser.

The workflow is straightforward:

```text
Write Q# Code
      ↓
Compile in Browser
      ↓
Execute Quantum Program
      ↓
Measure / Simulate
      ↓
Display Results
```

This makes the exercises interactive rather than simply presenting Q# source code as static examples.

Learners can modify their solutions, execute them, inspect the results, and repeatedly refine their implementations.

---

## ✅ Automated Exercise Checking

Each supported programming exercise provides an interactive **Check** mechanism.

When the learner selects **Check**, the submitted Q# program is compiled together with the corresponding exercise test harness.

The system then executes the tests and reports whether the submitted implementation satisfies the requirements of the exercise.

This provides immediate feedback while learning.

The platform also provides:

* **Check** — execute the exercise tests.
* **Show Solution** — view the reference implementation.
* **Reset** — restore the original exercise state.

This allows learners to follow a complete learning cycle:

```text
Learn
  ↓
Attempt
  ↓
Run
  ↓
Check
  ↓
Analyze Result
  ↓
Improve Solution
```

---

## ⚛️ Q# Playground

Quantum Katas Web also includes an interactive **Q# Playground**.

The playground provides an environment for experimenting with Q# programs outside the structured exercises.

It supports quantum programming experiments such as:

* Quantum state preparation.
* Quantum operations.
* Measurement.
* Repeated quantum shots.
* Measurement distributions.
* Shot histograms.
* Quantum state inspection.
* Interactive Q# examples.

The playground is intended to provide a space where learners can experiment with quantum concepts before or after completing the structured exercises.

---

## 🐍 Python Quantum Tutorials

The platform also includes Python-based learning material for selected mathematical and quantum-computing topics.

The supported browser-based Python tutorials include:

* Complex arithmetic.
* Linear algebra.

These tutorials use **Pyodide**, allowing Python code to execute directly in the browser.

This provides learners with an opportunity to explore mathematical concepts without installing Python separately.

The first execution may require the browser to download the Pyodide runtime. Once downloaded, the browser can cache the required resources for subsequent use.

---

## 📖 Interactive Learning Interface

The website uses a documentation-style interface designed around the Quantum Katas curriculum.

The interface includes:

* Curriculum navigation.
* Lesson pages.
* Exercise navigation.
* Full-text search.
* Responsive layout.
* Light and dark themes.
* Interactive code editors.
* Exercise controls.
* Playground access.

The search interface can be accessed using:

```text
/
```

This allows learners to quickly search for lessons, concepts, and exercises.

---

## 💾 Local Progress and Code Storage

Quantum Katas Web stores learner progress and code drafts locally in the browser using `localStorage`.

This allows users to return to the website without requiring an account or server-side database.

The platform also provides export/import functionality so that users can create backups of their locally stored progress and code.

The basic architecture is:

```text
User
 │
 ▼
Web Browser
 │
 ├── Lessons
 ├── Q# Editor
 ├── Q# Compiler
 ├── Quantum Simulator
 ├── Python / Pyodide
 └── Local Storage
```

No user account is required for the learning workflow.

---

# 🏗️ Project Architecture

The project is organized into several major components:

```text
Quantum-Katas-Web/
│
├── content/
│   └── QuantumKatas/
│
├── build/
│
├── src/
│
├── shim/
│
├── web/
│
├── tools/
│
├── dist/
│
├── package.json
│
└── .github/
    └── workflows/
```

### `content/QuantumKatas/`

Contains the Quantum Katas educational content, exercises, tests, and reference solutions derived from the upstream Microsoft Quantum Katas repository.

### `build/`

Contains the build system responsible for transforming the source educational material into the format consumed by the web application.

### `src/`

Contains Q# helper components used by the application and build process.

### `shim/`

Provides compatibility functionality for the APIs used by the original Quantum Katas exercises.

This is particularly important because the original Quantum Katas material was developed for earlier versions of the Q# development environment.

### `web/`

Contains the main web application.

The interface is implemented using web technologies including JavaScript, CodeMirror, KaTeX, and MiniSearch.

### `tools/`

Contains validation and supporting scripts used to test the exercises and generated content.

### `dist/`

Contains the generated, ready-to-run web application.

This directory contains the files required by the browser, including:

* HTML.
* JavaScript.
* CSS.
* Q# WebAssembly components.
* Q# worker files.
* KaTeX resources.
* Pyodide resources.
* Fonts.
* Generated lesson data.
* Other browser assets.

---

# 🔬 Q# Execution Architecture

The Q# execution system is designed to run entirely in the browser.

At a high level:

```text
             Quantum Katas Web
                    │
                    ▼
              Code Editor
                    │
                    ▼
              Q# Source Code
                    │
                    ▼
          Browser-based Q# Compiler
                    │
                    ▼
              WebAssembly
                    │
                    ▼
           Quantum Simulator
                    │
                    ▼
             Execution Result
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Test Result        Measurement
                              │
                              ▼
                       Histogram / State
```

This architecture allows the platform to provide interactive quantum programming without requiring a dedicated server for Q# execution.

---

# 🔄 Building the Project

The repository contains a pre-generated `dist/` directory, so users who only want to run the existing application do not need to rebuild it.

If you modify the source code, lesson content, or build configuration, the application can be regenerated using:

```bash
npm install
npm run build
```

The build process converts the educational content and bundles the browser application and its supporting resources into `dist/`.

After rebuilding, the application can be tested locally using:

```bash
npm run serve
```

and then opening:

```text
http://localhost:8080/
```

---

# 📊 Validation

The project includes validation tools for checking the generated Quantum Katas content and reference solutions.

Available validation commands include:

```bash
npm run validate
```

```bash
npm run validate:dist
```

```bash
npm run validate:demos
```

These tools help verify that the exercises, reference solutions, generated lesson data, and browser demonstrations remain consistent with the project.

---

# 🌐 Online Version

The easiest way to experience the project is through the hosted website:

### **[Quantum Katas — Learn Quantum Computing in Your Browser](https://bandianandrohit.github.io/Quantum-Katas-Web/)**

You can start learning immediately without installing Q#, Python, quantum-computing software, or additional development tools.

---

# 📜 Credits and License

The educational content, exercises, tests, and reference solutions are based on Microsoft's [Quantum Katas](https://github.com/microsoft/QuantumKatas).

Quantum Katas Web is an **unofficial web-based re-packaging and interactive implementation** of the Quantum Katas material and is not affiliated with or endorsed by Microsoft.

The original Quantum Katas material is distributed under the MIT License.

The project also uses open-source technologies and libraries including:

* Q# / `qsharp-lang`
* WebAssembly
* CodeMirror
* KaTeX
* MiniSearch
* Pyodide

Each dependency remains subject to its respective license.

The Quantum Katas Web source code is released under the MIT License. See the project's `LICENSE` file for details.
