#!/usr/bin/env node
// Harness Studio viewer launcher.
// Run from any project: starts the viewer (Vite) pointed at THAT project's
// .arta/ folder, seeding a starter canvas if there isn't one.
//
//   bunx github:AssetsArt/arta          # zero-install, from anywhere
//   harness                                        # if linked globally
//   harness --project ../other-app --port 5000
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const projectDir = path.resolve(opt("--project", process.cwd()));
const port = Number(opt("--port", "7317"));
const harnessDir = path.join(projectDir, ".arta");

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
    '<div style="display:grid;place-items:center;min-height:60vh;font-family:system-ui;color:#71717a">Ask Claude Code to design here — it writes into .arta/</div>\n'
  );
  console.log(`[harness] seeded a starter canvas at ${harnessDir}`);
}

// Point the Vite plugin at this project's canvas, then start Vite via its JS API
// (resolves vite by module resolution — works whether deps are nested or hoisted,
// e.g. under bunx).
process.env.HARNESS_DIR = harnessDir;

async function startVite() {
  const { createServer } = await import("vite");
  const server = await createServer({
    root: pkgRoot,
    configFile: path.join(pkgRoot, "vite.config.ts"),
    server: { port },
  });
  await server.listen();
  return server;
}

let server;
try {
  server = await startVite();
} catch (e) {
  // Most commonly: deps aren't installed yet. This is the normal first-run state
  // when the viewer is launched from the installed plugin dir (which ships source
  // but no node_modules). Install once, then retry — so it "just works" anywhere.
  console.log("[harness] installing viewer dependencies (first run / after update)…");
  const r = spawnSync("bun", ["install"], { cwd: pkgRoot, stdio: "inherit" });
  if (r.error || r.status !== 0) {
    console.error("[harness] couldn't start the viewer.");
    console.error("[harness] reason:", (e && e.message) || e);
    console.error("[harness] `bun install` failed — install Bun (https://bun.sh) and retry,");
    console.error(`[harness] or run \`bun install\` yourself in ${pkgRoot}.`);
    process.exit(1);
  }
  try {
    server = await startVite();
  } catch (e2) {
    console.error("[harness] failed to start the viewer after installing deps:", (e2 && e2.message) || e2);
    process.exit(1);
  }
}

// strictPort is off, so Vite bumps to the next free port on a collision —
// print the port it actually bound to, not the one we asked for.
const actualPort = server.httpServer?.address()?.port ?? port;
console.log(`\n[harness] viewer → http://localhost:${actualPort}`);
console.log(`[harness] watching ${harnessDir}\n`);
