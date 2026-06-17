#!/usr/bin/env node
// Harness Studio viewer launcher.
// Run from any project: starts the viewer (Vite) pointed at THAT project's
// .harness/ folder, seeding a starter canvas if there isn't one.
//
//   bunx github:AssetsArt/harness-studio          # zero-install, from anywhere
//   harness                                        # if linked globally
//   harness --project ../other-app --port 5000
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const projectDir = path.resolve(opt("--project", process.cwd()));
const port = Number(opt("--port", "4317"));
const harnessDir = path.join(projectDir, ".harness");

// Seed a minimal canvas so the viewer has something to render on first run.
if (!fs.existsSync(path.join(harnessDir, "state.json"))) {
  fs.mkdirSync(path.join(harnessDir, "prototype", "screens"), { recursive: true });
  fs.mkdirSync(path.join(harnessDir, "prototype", "components"), { recursive: true });
  const starter = {
    meta: { name: "Untitled", phase: "prototype" },
    spec: { goal: "", users: [], userStories: [], scope: { in: [], out: [] }, constraints: [] },
    prototype: {
      start: "home",
      frame: "web",
      store: {},
      layout: "{{slot}}",
      screens: [{ id: "home", title: "Home", url: "app.local" }],
    },
  };
  fs.writeFileSync(path.join(harnessDir, "state.json"), JSON.stringify(starter, null, 2) + "\n");
  fs.writeFileSync(
    path.join(harnessDir, "prototype", "screens", "home.html"),
    '<div style="display:grid;place-items:center;min-height:60vh;font-family:system-ui;color:#71717a">Ask Claude Code to design here — it writes into .harness/</div>\n'
  );
  console.log(`[harness] seeded a starter canvas at ${harnessDir}`);
}

// Point the Vite plugin at this project's canvas, then start Vite via its JS API
// (resolves vite by module resolution — works whether deps are nested or hoisted,
// e.g. under bunx).
process.env.HARNESS_DIR = harnessDir;
try {
  const { createServer } = await import("vite");
  const server = await createServer({
    root: pkgRoot,
    configFile: path.join(pkgRoot, "vite.config.ts"),
    server: { port },
  });
  await server.listen();
  console.log(`\n[harness] viewer → http://localhost:${port}`);
  console.log(`[harness] watching ${harnessDir}\n`);
} catch (e) {
  console.error("[harness] failed to start the viewer:", (e && e.message) || e);
  console.error("[harness] if you cloned the repo, run `bun install` first.");
  process.exit(1);
}
