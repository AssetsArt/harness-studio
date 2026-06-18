#!/usr/bin/env node
// ── Harness Studio MCP server ───────────────────────────────────────────────
// Gives Claude Code eyes and hands on the shared canvas:
//
//   • harness_get_state     — read the whole state.json (what you've built)
//   • harness_set_state     — replace state.json (triggers the live viewer)
//   • harness_patch_state   — shallow-merge a section (spec/plan/prototype/…)
//   • harness_set_phase     — advance the phase stepper
//   • harness_get_view      — see what the dev is looking at right now
//                             (active tab + prototype screen) — "see what you did"
//   • harness_get_feedback  — drain notes the dev left from inside the viewer
//   • harness_start_viewer  — launch the viewer FROM THE INSTALLED PLUGIN (always
//                             matches the installed version; no stale npx cache)
//
// State lives in <project>/.harness/. The server resolves that relative to its
// own location, so it works no matter what cwd Claude Code launches it from.
// Writing state.json is all it takes — the Vite dev server is watching and the
// viewer repaints with a cyan flash.

import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// The SDK depends on zod; import it directly for tool input schemas.
import { z as zod } from "zod";

// Resolve .harness against the USER'S project, not this file's location, so the
// same server works whether it's run locally or installed as a global plugin:
//   HARNESS_DIR (explicit) → CLAUDE_PROJECT_DIR/.harness (plugin) → cwd/.harness
const HARNESS_DIR = process.env.HARNESS_DIR
  ? path.resolve(process.env.HARNESS_DIR)
  : path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), ".harness");
const STATE_FILE = path.join(HARNESS_DIR, "state.json");
const RUNTIME_FILE = path.join(HARNESS_DIR, "runtime.json");
const FEEDBACK_FILE = path.join(HARNESS_DIR, "feedback.json");

// The viewer launcher (bin/harness.mjs) ships inside the plugin alongside this
// server, so we can start the viewer that MATCHES the installed plugin — no stale
// npx/bunx cache. Resolve the plugin root from the env CLAUDE Code expands in
// .mcp.json, falling back to this file's own location (mcp/server[.bundle].mjs
// sits one level under the plugin root) so it works either way.
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The viewer wants the PROJECT dir (it appends /.harness itself).
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR
  ? path.resolve(process.env.CLAUDE_PROJECT_DIR)
  : path.dirname(HARNESS_DIR);

// Split-file prototype layout — edit one piece without touching the rest.
const PROTO_DIR = path.join(HARNESS_DIR, "prototype");
const CSS_FILE = path.join(PROTO_DIR, "design-system.css");
const COMP_DIR = path.join(PROTO_DIR, "components");
const SCREEN_DIR = path.join(PROTO_DIR, "screens");

const PHASES = ["prototype", "data", "flow", "plan"];
const sanitize = (s) => String(s).replace(/[^a-z0-9_-]/gi, "");

function ensureDir() {
  fs.mkdirSync(HARNESS_DIR, { recursive: true });
}
function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function readRaw(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
function writeState(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
function screenFile(id) {
  return path.join(SCREEN_DIR, sanitize(id) + ".html");
}
function componentFile(name) {
  return path.join(COMP_DIR, sanitize(name) + ".html");
}
function text(payload) {
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: body }] };
}
function err(message) {
  return { content: [{ type: "text", text: `ERROR: ${message}` }], isError: true };
}
// Is something already listening on this port? Used to make starting the viewer
// idempotent — don't spawn a second one if it's already up.
function portInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (val) => {
      socket.destroy();
      resolve(val);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const server = new McpServer({
  name: "harness-studio",
  version: "0.1.0",
});

server.registerTool(
  "harness_get_state",
  {
    description:
      "Read .harness/state.json — meta/spec/plan/dataModel/flow plus the prototype MANIFEST (screen ids, titles, frames; NOT the screen HTML). This stays small as the prototype grows. Read the actual markup with harness_get_screen / harness_get_component / harness_get_design_system so you only pull what you need.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE);
    if (state == null)
      return text({ exists: false, note: "No state.json yet — write one with harness_set_state." });
    return text(state);
  }
);

server.registerTool(
  "harness_set_state",
  {
    description:
      "Replace .harness/state.json with a full state object. The running viewer repaints instantly (cyan flash). Use for the first write or a wholesale rewrite; prefer harness_patch_state for incremental edits.",
    inputSchema: {
      state: zod
        .record(zod.any())
        .describe("Full state object. Must include a `meta` object with `name` and `phase`."),
    },
  },
  async ({ state }) => {
    if (!state || typeof state !== "object" || !state.meta)
      return err('state must be an object containing a "meta" field.');
    if (state.meta.phase && !PHASES.includes(state.meta.phase))
      return err(`meta.phase must be one of: ${PHASES.join(", ")}`);
    writeState(state);
    return text({ ok: true, wrote: STATE_FILE });
  }
);

server.registerTool(
  "harness_patch_state",
  {
    description:
      "Shallow-merge a section into state.json without resending the whole object. Top-level keys you provide replace that key (e.g. send the full `spec` object, or a new `prototype`). Everything else is preserved. This is the workhorse for iterating during a design phase.",
    inputSchema: {
      patch: zod
        .record(zod.any())
        .describe("Partial state, e.g. { spec: {...} } or { prototype: {...} }. Top-level keys replace."),
    },
  },
  async ({ patch }) => {
    if (!patch || typeof patch !== "object")
      return err("patch must be an object.");
    const current = readJson(STATE_FILE) || {};
    const next = { ...current, ...patch };
    if (patch.meta) next.meta = { ...(current.meta || {}), ...patch.meta };
    if (!next.meta) return err("Resulting state has no meta — set one first.");
    writeState(next);
    return text({ ok: true, mergedKeys: Object.keys(patch) });
  }
);

server.registerTool(
  "harness_set_phase",
  {
    description: "Advance the phase stepper in the viewer. The flow is prototype → data → flow → plan.",
    inputSchema: { phase: zod.enum(["prototype", "data", "flow", "plan"]) },
  },
  async ({ phase }) => {
    const current = readJson(STATE_FILE);
    if (current == null) return err("No state.json yet.");
    current.meta = { ...(current.meta || {}), phase };
    writeState(current);
    return text({ ok: true, phase });
  }
);

server.registerTool(
  "harness_get_api",
  {
    description:
      "Read the `api` section — the OpenAPI-3-shaped HTTP API (info, servers, the x-middleware registry, and paths with operations). This is what the Flow tab renders.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.api) return text({ exists: false, note: "No api yet — write one with harness_set_api (OpenAPI 3 shape)." });
    return text(state.api);
  }
);

server.registerTool(
  "harness_set_api",
  {
    description:
      'Write the `api` section (the Flow tab) as an OpenAPI 3 document. Shape: { info?, servers?, "x-middleware"?: [{ name, description }], paths: { "/route/{id}": { get|post|put|patch|delete: { summary?, tags?, "x-middleware"?: ["auth"], parameters?: [{ name, in: "path"|"query"|"header", required?, schema, description?, example? }], requestBody?: { required?, content: { "application/json": { schema, example? } } }, responses?: { "200": { description, content? } } } } } }. Replaces the whole api section and the viewer repaints. Vendor extensions (x-*) are valid OpenAPI and export cleanly.',
    inputSchema: {
      api: zod.record(zod.any()).describe("OpenAPI-3-shaped document. Must include a `paths` object."),
    },
  },
  async ({ api }) => {
    if (!api || typeof api !== "object") return err("api must be an object.");
    if (!api.paths || typeof api.paths !== "object")
      return err("api.paths is required — an object of route path → { <method>: operation }.");
    const state = readJson(STATE_FILE) || { meta: { name: "Untitled", phase: "flow" } };
    state.api = api;
    writeState(state);
    return text({ ok: true, paths: Object.keys(api.paths).length });
  }
);

// ── Granular prototype edits — touch one file, not the whole design ─────────

server.registerTool(
  "harness_get_screen",
  {
    description:
      "Read one prototype screen's HTML body (.harness/prototype/screens/<id>.html). Use this instead of pulling the whole state when you only need to look at or edit one screen.",
    inputSchema: { id: zod.string().describe("Screen id from the manifest.") },
  },
  async ({ id }) => {
    const html = readRaw(screenFile(id));
    if (html == null) return text({ exists: false, id, note: "No body file — screen may use inline html or not exist." });
    return text({ id, html });
  }
);

server.registerTool(
  "harness_set_screen",
  {
    description:
      "Create or replace one screen: writes only .harness/prototype/screens/<id>.html and upserts the screen's entry in the manifest (title/url/frame). Other screens and the rest of the design are untouched. This is how you edit a screen cheaply.",
    inputSchema: {
      id: zod.string(),
      html: zod.string().describe("The screen body (HTML). With a layout, just the slot content."),
      title: zod.string().optional(),
      url: zod.string().optional(),
      frame: zod.enum(["web", "desktop", "ios", "android"]).optional(),
    },
  },
  async ({ id, html, title, url, frame }) => {
    fs.mkdirSync(SCREEN_DIR, { recursive: true });
    fs.writeFileSync(screenFile(id), html);
    const state = readJson(STATE_FILE) || { meta: { name: "Untitled", phase: "prototype" } };
    state.prototype = state.prototype || { screens: [] };
    state.prototype.screens = state.prototype.screens || [];
    let sc = state.prototype.screens.find((s) => s.id === id);
    if (!sc) {
      sc = { id, title: title || id };
      state.prototype.screens.push(sc);
      if (!state.prototype.start) state.prototype.start = id;
    }
    if (title !== undefined) sc.title = title;
    if (url !== undefined) sc.url = url;
    if (frame !== undefined) sc.frame = frame;
    delete sc.html; // body lives in the file now
    writeState(state);
    return text({ ok: true, id, wrote: screenFile(id) });
  }
);

server.registerTool(
  "harness_get_component",
  {
    description: "Read a shared component's HTML (.harness/prototype/components/<name>.html).",
    inputSchema: { name: zod.string() },
  },
  async ({ name }) => {
    const html = readRaw(componentFile(name));
    if (html == null) return text({ exists: false, name });
    return text({ name, html });
  }
);

server.registerTool(
  "harness_set_component",
  {
    description:
      "Create or replace a shared component (.harness/prototype/components/<name>.html), referenced as {{>name}} from the layout or screens. Edit it once and every screen that uses it updates — no per-screen edits.",
    inputSchema: { name: zod.string(), html: zod.string() },
  },
  async ({ name, html }) => {
    fs.mkdirSync(COMP_DIR, { recursive: true });
    fs.writeFileSync(componentFile(name), html);
    return text({ ok: true, name, wrote: componentFile(name) });
  }
);

server.registerTool(
  "harness_get_design_system",
  {
    description: "Read the shared prototype CSS (.harness/prototype/design-system.css).",
    inputSchema: {},
  },
  async () => {
    const css = readRaw(CSS_FILE);
    if (css == null) return text({ exists: false });
    return text({ css });
  }
);

server.registerTool(
  "harness_set_design_system",
  {
    description: "Replace the shared prototype CSS (.harness/prototype/design-system.css), injected into every freeform screen.",
    inputSchema: { css: zod.string() },
  },
  async ({ css }) => {
    fs.mkdirSync(PROTO_DIR, { recursive: true });
    fs.writeFileSync(CSS_FILE, css);
    return text({ ok: true, wrote: CSS_FILE });
  }
);

server.registerTool(
  "harness_set_frame",
  {
    description: "Set the default device frame for the prototype (or omit a screen to set the global default).",
    inputSchema: {
      frame: zod.enum(["web", "desktop", "ios", "android"]),
      screen: zod.string().optional().describe("Screen id to scope the frame to; omit for the prototype default."),
    },
  },
  async ({ frame, screen }) => {
    const state = readJson(STATE_FILE);
    if (state == null) return err("No state.json yet.");
    state.prototype = state.prototype || {};
    if (screen) {
      const sc = (state.prototype.screens || []).find((s) => s.id === screen);
      if (!sc) return err(`No screen "${screen}" in the manifest.`);
      sc.frame = frame;
    } else {
      state.prototype.frame = frame;
    }
    writeState(state);
    return text({ ok: true, frame, screen: screen || "(default)" });
  }
);

server.registerTool(
  "harness_get_view",
  {
    description:
      "See what the dev is currently looking at in the viewer: active tab, the prototype screen on screen, and the list of screens. Use this to know which screen your changes will land on and to confirm the dev is where you expect.",
    inputSchema: {},
  },
  async () => {
    const runtime = readJson(RUNTIME_FILE);
    if (runtime == null)
      return text({ live: false, note: "Viewer hasn't reported yet — is `bun run dev` open in a browser?" });
    // runtime.errors carries console/runtime errors from the prototype iframe, so
    // you can see (and fix) broken HTML/CSS/JS without waiting for the dev to report it.
    return text({ live: true, ...runtime });
  }
);

server.registerTool(
  "harness_get_screenshot",
  {
    description:
      "Get a PNG of how a prototype screen actually renders — the same pixels the dev sees, captured by the viewer. Use this to check your work visually instead of reasoning only from the HTML. Returns an image; if none exists yet, the screen may not have been viewed in the browser.",
    inputSchema: { screen: zod.string().describe("Screen id.") },
  },
  async ({ screen }) => {
    const file = path.join(HARNESS_DIR, "snapshots", sanitize(screen) + ".png");
    let buf;
    try {
      buf = fs.readFileSync(file);
    } catch {
      return text({ exists: false, screen, note: "No snapshot yet — open the viewer and visit this screen." });
    }
    return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
  }
);

server.registerTool(
  "harness_get_feedback",
  {
    description:
      "Drain the feedback the dev left from inside the viewer (notes attached to a tab/screen). Returns unread items and marks them read. This is how the dev → AI half of the loop closes without leaving the viewer.",
    inputSchema: {
      peek: zod
        .boolean()
        .optional()
        .describe("If true, return unread items without marking them read."),
    },
  },
  async ({ peek }) => {
    const list = readJson(FEEDBACK_FILE, []) || [];
    const unread = list.filter((f) => !f.read);
    if (!peek) {
      list.forEach((f) => (f.read = true));
      ensureDir();
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2));
    }
    return text({ count: unread.length, feedback: unread });
  }
);

server.registerTool(
  "harness_start_viewer",
  {
    description:
      "Start the Harness Studio viewer FROM THE INSTALLED PLUGIN, pointed at this project's .harness/. Because it runs the launcher that ships with the plugin, the viewer always matches the installed plugin version — no stale npx/bunx cache. First run installs the viewer's deps (a few seconds). Idempotent: if a viewer is already on the port, it just returns the URL. Call this once at the start of a design session so the dev has the canvas open, then keep using the other tools as normal.",
    inputSchema: {
      port: zod.number().int().optional().describe("Port for the viewer (default 7317)."),
    },
  },
  async ({ port }) => {
    const p = Number(port) || 7317;
    const launcher = path.join(PLUGIN_ROOT, "bin", "harness.mjs");
    if (!fs.existsSync(launcher))
      return err(
        `Launcher not found at ${launcher}. The plugin may be installed incompletely; the dev can also run \`bunx github:AssetsArt/harness-studio\` manually.`
      );
    if (await portInUse(p))
      return text({
        ok: true,
        alreadyRunning: true,
        url: `http://localhost:${p}`,
        note: "A viewer is already responding on this port — reuse it.",
      });
    // Capture the launcher's output (incl. first-run `bun install`) to a log so
    // failures are inspectable; the child is detached so it outlives this server.
    ensureDir();
    const logFile = path.join(HARNESS_DIR, "viewer.log");
    let out = "ignore";
    try {
      out = fs.openSync(logFile, "a");
    } catch {}
    const child = spawn(
      process.execPath,
      [launcher, "--project", PROJECT_DIR, "--port", String(p)],
      { cwd: PLUGIN_ROOT, detached: true, stdio: ["ignore", out, out] }
    );
    child.unref();
    return text({
      ok: true,
      started: true,
      url: `http://localhost:${p}`,
      watching: path.join(PROJECT_DIR, ".harness"),
      from: PLUGIN_ROOT,
      note: `Viewer starting from the installed plugin. First run installs its deps (a few seconds) — open ${`http://localhost:${p}`} in a moment. Logs: ${logFile}`,
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
