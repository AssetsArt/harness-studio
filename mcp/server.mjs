#!/usr/bin/env node
// ── Arta MCP server ───────────────────────────────────────────────
// Gives Claude Code eyes and hands on the shared canvas:
//
//   • arta_get_state     — read state.json — whole, or {outline} / {sections}
//                             to spend tokens only on the parts you need
//   • arta_get_spec /    — read one section on its own (cheap in big projects);
//     _data_model / _api /     also _plan, _architecture, _design_tokens
//   • arta_set_state     — replace state.json (triggers the live viewer)
//   • arta_patch_state   — shallow-merge a section (spec/plan/prototype/…)
//   • arta_set_phase     — record the current phase (shown in the status bar)
//   • arta_get_view      — see what the dev is looking at right now
//                             (active tab + prototype screen) — "see what you did"
//   • arta_get_feedback  — drain notes the dev left from inside the viewer
//   • arta_start_viewer  — launch the viewer FROM THE INSTALLED PLUGIN (always
//                             matches the installed version; no stale npx cache)
//
// State lives in <project>/.arta/. The server resolves that relative to its
// own location, so it works no matter what cwd Claude Code launches it from.
// Writing state.json is all it takes — the Vite dev server is watching and the
// viewer repaints with a cyan flash.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// The SDK depends on zod; import it directly for tool input schemas.
import { z as zod } from "zod";

// Some launchers pass ${CLAUDE_*} through to `env` UNEXPANDED (a literal
// "${VAR}") — or don't pass it at all. Read an env path but reject that case so
// we never build a bogus "<cwd>/${VAR}/..." path; callers then fall back to
// something reliable. envDir additionally requires the dir to exist on disk.
function envPath(name) {
  const v = process.env[name];
  if (!v || v.includes("${")) return null;
  return path.resolve(v);
}
function envDir(name) {
  const p = envPath(name);
  return p && fs.existsSync(p) ? p : null;
}

// Resolve .arta against the USER'S project, not this file's location, so the
// same server works whether it's run locally or installed as a global plugin:
//   ARTA_DIR (explicit) → CLAUDE_PROJECT_DIR/.arta (plugin) → cwd/.arta
const ARTA_DIR =
  envPath("ARTA_DIR") || path.join(envDir("CLAUDE_PROJECT_DIR") || process.cwd(), ".arta");

// One-time migration for projects created before the Arta rename: the canvas used
// to live in .harness/. If there's no .arta/ yet but a legacy .harness/ sits next to
// it, rename it so the existing design carries over with zero manual steps. Runs once
// (skips when .arta/ already exists), non-destructive, and logs to STDERR — stdout is
// the MCP protocol channel and must stay clean.
try {
  const legacyDir = path.join(path.dirname(ARTA_DIR), ".harness");
  if (!fs.existsSync(ARTA_DIR) && fs.existsSync(legacyDir)) {
    fs.renameSync(legacyDir, ARTA_DIR);
    console.error("[arta] migrated legacy .harness/ → .arta/");
  }
} catch {
  /* non-fatal: fall back to a fresh .arta/ */
}

const STATE_FILE = path.join(ARTA_DIR, "state.json");
const RUNTIME_FILE = path.join(ARTA_DIR, "runtime.json");
const FEEDBACK_FILE = path.join(ARTA_DIR, "feedback.json");

// The viewer launcher (bin/arta.mjs) ships inside the plugin alongside this
// server. This file sits at <plugin-root>/mcp/server[.bundle].mjs, so dirname/..
// is the plugin root — a RELIABLE, self-derived path that's correct even when the
// launcher left ${CLAUDE_PLUGIN_ROOT} unexpanded in env (the bug that forced the
// stale `bunx` fallback). Prefer a valid env dir only when it actually exists;
// otherwise use our own location.
const SELF_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = envDir("CLAUDE_PLUGIN_ROOT") || SELF_ROOT;
// The viewer wants the PROJECT dir (it appends /.arta itself).
const PROJECT_DIR = envDir("CLAUDE_PROJECT_DIR") || path.dirname(ARTA_DIR);

// Split-file prototype layout — edit one piece without touching the rest.
const PROTO_DIR = path.join(ARTA_DIR, "prototype");
const CSS_FILE = path.join(PROTO_DIR, "design-system.css");
const COMP_DIR = path.join(PROTO_DIR, "components");
const SCREEN_DIR = path.join(PROTO_DIR, "screens");

const PHASES = ["prototype", "data", "flow", "architecture", "plan"];
const sanitize = (s) => String(s).replace(/[^a-z0-9_-]/gi, "");

// ── Project registry — one viewer (one port) can show several projects ───────
// Each project's MCP upserts itself into a shared file; the viewer reads it to build
// the switcher and to serve/watch every registered canvas. No IPC. The id MUST match
// the viewer's idFor() (vite/arta-watch.ts) so both sides agree on a project's id.
const REGISTRY_FILE = path.join(os.homedir(), ".arta", "registry.json");
function idForDir(dir) {
  const s = path.resolve(dir);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
let didRegister = false;
function registerProject() {
  if (didRegister) return;
  try {
    // The canonical project key is the .arta dir — the viewer keys/serves by it too,
    // so idForDir(ARTA_DIR) here matches idFor(homeDir) in the viewer.
    const dir = path.resolve(ARTA_DIR);
    const id = idForDir(dir);
    const name = readJson(STATE_FILE)?.meta?.name || path.basename(path.dirname(dir));
    let list = readJson(REGISTRY_FILE);
    if (!Array.isArray(list)) list = [];
    // Drop self's old entry + any dead canvases, then add the fresh self.
    list = list.filter((e) => e && typeof e.dir === "string" && e.id !== id && fs.existsSync(path.join(e.dir, "state.json")));
    list.push({ id, name, dir, at: new Date().toISOString() });
    fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(list, null, 2));
    didRegister = true;
  } catch {
    /* non-fatal — single-project still works */
  }
}

function ensureDir() {
  fs.mkdirSync(ARTA_DIR, { recursive: true });
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
  registerProject(); // this project now has a canvas — make it switchable in the viewer
}
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
// Recursively merge `patch` into `base`: nested objects merge key-by-key, while
// arrays and scalars replace. This is what keeps a partial `prototype` patch from
// nuking the keys it didn't mention (tokens / components / screens). Arrays
// replace wholesale because a patched array means "this is the new list".
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    out[k] = isPlainObject(out[k]) && isPlainObject(patch[k]) ? deepMerge(out[k], patch[k]) : patch[k];
  }
  return out;
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

// Best-effort: stop whatever is LISTENing on `port` so the viewer can be
// restarted onto a fresh build. Uses lsof (macOS/Linux); a no-op if lsof is
// missing or nothing is listening. Returns the PIDs it signalled.
function killPort(port) {
  const killed = [];
  try {
    const res = spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    const pids = String(res.stdout || "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
        killed.push(Number(pid));
      } catch {}
    }
  } catch {}
  return killed;
}

// Stop EVERY Arta viewer (and its bundled esbuild service) across all installed
// versions and ports — not just the one LISTENing on a single port. Each plugin
// version lives at its own cache path, so after a few updates old viewers pile up
// (and orphan their esbuild children); this is what makes `restart`/`update` actually
// clean instead of needing a manual kill. Matches by command line; never the MCP self.
function killAllViewers(signal = "SIGTERM") {
  const killed = [];
  try {
    const out = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).stdout || "";
    for (const line of out.split("\n")) {
      const t = line.trim();
      const sp = t.indexOf(" ");
      if (sp < 1) continue;
      const pid = Number(t.slice(0, sp));
      if (!pid || pid === process.pid) continue;
      const cmd = t.slice(sp + 1);
      const isViewer = /[/\\]bin[/\\]arta\.mjs(\s|$)/.test(cmd);
      const isArtaEsbuild = cmd.includes("esbuild") && /[/\\]arta[/\\]arta[/\\]/.test(cmd);
      if (isViewer || isArtaEsbuild) {
        try {
          process.kill(pid, signal);
          killed.push(pid);
        } catch {}
      }
    }
  } catch {}
  return killed;
}

// Wait until `port` is free (the old viewer has actually exited) or timeout.
async function waitPortFree(port, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (!(await portInUse(port))) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return !(await portInUse(port));
}

// Spawn the viewer launcher that ships with the installed plugin, detached so it
// outlives this server. Shared by start/restart. Output (incl. first-run
// `bun install`) is appended to .arta/viewer.log for inspection.
function spawnViewer(p) {
  const launcher = path.join(PLUGIN_ROOT, "bin", "arta.mjs");
  if (!fs.existsSync(launcher)) return { ok: false, launcher };
  ensureDir();
  const logFile = path.join(ARTA_DIR, "viewer.log");
  let out = "ignore";
  try {
    out = fs.openSync(logFile, "a");
  } catch {}
  const child = spawn(process.execPath, [launcher, "--project", PROJECT_DIR, "--port", String(p)], {
    cwd: PLUGIN_ROOT,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return { ok: true, launcher, logFile };
}

const server = new McpServer({
  name: "arta",
  version: "0.1.0",
});

// Compact, token-cheap summary of one top-level section — used by the outline.
function summarizeSection(key, v) {
  const s = { bytes: Buffer.byteLength(JSON.stringify(v ?? null)) };
  if (v && typeof v === "object") {
    if (key === "spec") s.keys = Object.keys(v);
    else if (key === "dataModel") {
      s.entities = (v.entities || []).length;
      s.relationships = (v.relationships || []).length;
    } else if (key === "plan") {
      s.milestones = (v.milestones || []).length;
      s.tasks = (v.milestones || []).reduce((n, m) => n + (m.tasks || []).length, 0);
    } else if (key === "api") {
      s.paths = v.paths ? Object.keys(v.paths).length : 0;
    } else if (key === "architecture") {
      s.nodes = (v.nodes || []).length;
      s.edges = (v.edges || []).length;
      if (v.decisions) s.decisions = v.decisions.length;
    } else if (key === "prototype") {
      s.screens = (v.screens || []).length;
      s.hasTokens = !!v.tokens;
      s.hasLayout = !!v.layout;
    }
  }
  return s;
}

// A lightweight index of state.json: which sections exist, how big each is, and
// the screen manifest — so the model can decide what to pull instead of the lot.
function buildOutline(state) {
  const sections = {};
  for (const k of Object.keys(state)) {
    if (k === "meta") continue;
    sections[k] = summarizeSection(k, state[k]);
  }
  const screens = (state.prototype?.screens || []).map((s) => ({
    id: s.id,
    title: s.title,
    ...(s.frame ? { frame: s.frame } : {}),
  }));
  return {
    meta: state.meta || {},
    sections,
    screens,
    note: "Outline only. Pull a section with arta_get_state({ sections:['spec','dataModel'] }) or a named getter (arta_get_spec, arta_get_data_model, arta_get_api, arta_get_plan, arta_get_architecture, arta_get_design_tokens). Screen HTML: arta_get_screen({ id }).",
  };
}

server.registerTool(
  "arta_get_state",
  {
    description:
      "Read .arta/state.json — meta/spec/plan/dataModel/api/architecture plus the prototype MANIFEST (screen ids, titles, frames; NOT the screen HTML). Defaults to the whole state. In a LARGE project that blob gets expensive, so narrow it: `outline:true` returns just an index (which sections exist, their item counts and byte sizes, plus the screen manifest); `sections:['spec','dataModel']` returns only those top-level keys (meta is always included). Then pull screen markup with arta_get_screen / arta_get_component / arta_get_design_system so you only spend tokens on what you need.",
    inputSchema: {
      sections: zod
        .array(zod.string())
        .optional()
        .describe(
          "Return only these top-level keys (e.g. ['spec','dataModel','api']). meta is always included. Omit for the whole state."
        ),
      outline: zod
        .boolean()
        .optional()
        .describe(
          "If true, return a compact index (sections present + counts + byte sizes + screen manifest) instead of the full state. Cheapest way to ground in a big project; then pull what you need."
        ),
    },
  },
  async ({ sections, outline } = {}) => {
    const state = readJson(STATE_FILE);
    if (state == null)
      return text({ exists: false, note: "No state.json yet — write one with arta_set_state." });
    if (outline) return text(buildOutline(state));
    if (Array.isArray(sections) && sections.length) {
      const picked = { meta: state.meta };
      const missing = [];
      for (const k of sections) {
        if (k === "meta") continue;
        if (k in state) picked[k] = state[k];
        else missing.push(k);
      }
      if (missing.length) picked._missing = missing;
      return text(picked);
    }
    return text(state);
  }
);

server.registerTool(
  "arta_set_state",
  {
    description:
      "Replace .arta/state.json with a full state object. The running viewer repaints instantly (cyan flash). Use for the first write or a wholesale rewrite; prefer arta_patch_state for incremental edits.",
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
  "arta_patch_state",
  {
    description:
      "Merge a section into state.json without resending the whole object. Top-level keys you provide REPLACE that key (send the full `spec`, `api`, `dataModel`, … to swap it) — EXCEPT `meta` and `prototype`, which DEEP-MERGE so a partial patch can't wipe what it omits. That guard matters because `prototype` holds your tokens, components, screens and layout: patching `{ prototype: { components: { card: \"…\" } } }` keeps tokens + the other components intact (it used to blank them). To replace a screen/component/token set outright, prefer the granular setters (arta_set_screen / arta_set_component / arta_set_design_tokens) — they touch one file and keep the manifest clean. This is the workhorse for iterating during a design phase.",
    inputSchema: {
      patch: zod
        .record(zod.any())
        .describe(
          "Partial state, e.g. { spec: {...} } or { prototype: { tokens: {...} } }. Top-level keys replace; `meta` and `prototype` deep-merge (sibling keys preserved)."
        ),
    },
  },
  async ({ patch }) => {
    if (!patch || typeof patch !== "object")
      return err("patch must be an object.");
    const current = readJson(STATE_FILE) || {};
    const next = { ...current, ...patch };
    // meta + prototype deep-merge so a partial patch never drops the keys it omits
    // (the classic footgun: a slim `prototype` patch wiping tokens / components).
    if (patch.meta) next.meta = deepMerge(current.meta || {}, patch.meta);
    if (patch.prototype) next.prototype = deepMerge(current.prototype || {}, patch.prototype);
    if (!next.meta) return err("Resulting state has no meta — set one first.");
    writeState(next);
    return text({ ok: true, mergedKeys: Object.keys(patch), deepMerged: Object.keys(patch).filter((k) => k === "meta" || k === "prototype") });
  }
);

server.registerTool(
  "arta_set_phase",
  {
    description: "Record the current phase (prototype → data → flow → architecture → plan), shown in the viewer's status bar. Navigation is free: each tab is a real route the dev can jump to and revisit in any order, so this marks where you're working rather than forcing the view.",
    inputSchema: { phase: zod.enum(["prototype", "data", "flow", "architecture", "plan"]) },
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
  "arta_get_spec",
  {
    description:
      "Read just the `spec` section — goal, users, userStories, scope (in/out), constraints. Cheaper than arta_get_state when you only need the brief. Write it with arta_patch_state({ spec: {...} }).",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.spec)
      return text({ exists: false, note: "No spec yet — write one with arta_patch_state({ spec: {...} })." });
    return text(state.spec);
  }
);

server.registerTool(
  "arta_get_data_model",
  {
    description:
      "Read just the `dataModel` section — entities (each with fields carrying pk/fk/type/required) and relationships. This is what the Data tab renders. Cheaper than arta_get_state when you only need the schema. Write it with arta_patch_state({ dataModel: {...} }).",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.dataModel)
      return text({ exists: false, note: "No dataModel yet — write one with arta_patch_state({ dataModel: {...} })." });
    return text(state.dataModel);
  }
);

server.registerTool(
  "arta_get_api",
  {
    description:
      "Read the `api` section — the OpenAPI-3-shaped HTTP API (info, servers, the x-middleware registry, and paths with operations). This is what the Flow tab renders.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.api) return text({ exists: false, note: "No api yet — write one with arta_set_api (OpenAPI 3 shape)." });
    return text(state.api);
  }
);

server.registerTool(
  "arta_set_api",
  {
    description:
      'Write the `api` section (the Flow tab) as an OpenAPI 3 document. Shape: { info?, servers?, "x-middleware"?: [{ name, description }], paths: { "/route/{id}": { get|post|put|patch|delete: { summary?, tags?, "x-middleware"?: ["auth"], "x-screens"?: ["screenId"], parameters?: [{ name, in: "path"|"query"|"header", required?, schema, description?, example? }], requestBody?: { required?, content: { "application/json": { schema, example? } } }, responses?: { "200": { description, content? } } } } } }. `x-screens` lists the prototype screen ids that call the route, drawing screen→API edges in the graph. Replaces the whole api section and the viewer repaints. Vendor extensions (x-*) are valid OpenAPI and export cleanly.',
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

server.registerTool(
  "arta_get_plan",
  {
    description:
      "Read the `plan` section — the Kanban board: stack, statuses (the columns), and milestones (swimlanes) with their tasks.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.plan) return text({ exists: false, note: "No plan yet — write one with arta_set_plan." });
    return text(state.plan);
  }
);

server.registerTool(
  "arta_set_plan",
  {
    description:
      'Write the `plan` section (the Kanban board). Shape: { stack?: ["React", ...], statuses?: [{ id, name, color? }] — the columns (ClickUp-style custom statuses; defaults to to-do/in-progress/done if omitted), milestones: [{ name, tasks: [{ title, status: "<status id>", priority?: "urgent"|"high"|"normal"|"low" }] }] — each milestone is a swimlane (row). Replaces the whole plan; the viewer repaints.',
    inputSchema: { plan: zod.record(zod.any()).describe("The plan object (statuses + milestones[].tasks).") },
  },
  async ({ plan }) => {
    if (!plan || typeof plan !== "object") return err("plan must be an object.");
    const state = readJson(STATE_FILE) || { meta: { name: "Untitled", phase: "plan" } };
    state.plan = plan;
    writeState(state);
    const milestones = (plan.milestones || []).length;
    const tasks = (plan.milestones || []).reduce((n, m) => n + (m.tasks || []).length, 0);
    return text({ ok: true, statuses: (plan.statuses || []).length, milestones, tasks });
  }
);

server.registerTool(
  "arta_set_task",
  {
    description:
      "Add or update one Kanban card. Finds the task by title within the milestone (creating the milestone if needed): updates its status / priority / title, or adds it if new. Use this to MOVE a card between columns (just set `status`) without resending the whole plan.",
    inputSchema: {
      milestone: zod.string().describe("Milestone (swimlane) name."),
      title: zod.string().describe("Task title to find (or create)."),
      status: zod.string().optional().describe("Status id (a Plan.statuses[].id). Moving a card = setting this."),
      priority: zod.enum(["urgent", "high", "normal", "low"]).optional(),
      newTitle: zod.string().optional().describe("Rename the task."),
    },
  },
  async ({ milestone, title, status, priority, newTitle }) => {
    const state = readJson(STATE_FILE) || { meta: { name: "Untitled", phase: "plan" } };
    state.plan = state.plan || {};
    const statuses = state.plan.statuses || [];
    if (status && statuses.length && !statuses.some((s) => s.id === status))
      return err(`Unknown status "${status}". Valid: ${statuses.map((s) => s.id).join(", ")}`);
    state.plan.milestones = state.plan.milestones || [];
    let m = state.plan.milestones.find((x) => x.name === milestone);
    if (!m) {
      m = { name: milestone, tasks: [] };
      state.plan.milestones.push(m);
    }
    m.tasks = m.tasks || [];
    let t = m.tasks.find((x) => x.title === title);
    const created = !t;
    if (!t) {
      t = { title, status: status || statuses[0]?.id || "todo" };
      m.tasks.push(t);
    }
    if (status !== undefined) t.status = status;
    if (priority !== undefined) t.priority = priority;
    if (newTitle !== undefined) t.title = newTitle;
    writeState(state);
    return text({ ok: true, milestone, task: t.title, status: t.status, created });
  }
);

server.registerTool(
  "arta_get_architecture",
  {
    description:
      "Read the `architecture` section — the system-level design (the Architecture tab): stack, C4-style nodes/edges (the system diagram), decisions (ADRs), nfrs, and security notes.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE) || {};
    if (!state.architecture) return text({ exists: false, note: "No architecture yet — write one with arta_set_architecture." });
    return text(state.architecture);
  }
);

server.registerTool(
  "arta_set_architecture",
  {
    description:
      'Write the `architecture` section (the Architecture tab). Shape: { stack?: ["Node", ...], nodes: [{ id, name, kind: "client"|"service"|"datastore"|"external"|"gateway"|"queue"|"cache"|"infra", tech?, description?, deployment?, group? }], edges: [{ from, to, protocol?: "REST"|"gRPC"|"AMQP"|..., mode?: "sync"|"async", label? }] (the C4-style system diagram), decisions?: [{ id?, title, status?: "proposed"|"accepted"|"superseded"|"rejected", context?, options?: [..], decision?, consequences? }] (ADRs), nfrs?: [{ name, target?, note? }], security?: [{ boundary?, note }] }. Replaces the whole architecture section; the viewer repaints.',
    inputSchema: { architecture: zod.record(zod.any()).describe("The architecture object (nodes/edges + decisions/nfrs/security).") },
  },
  async ({ architecture }) => {
    if (!architecture || typeof architecture !== "object") return err("architecture must be an object.");
    const state = readJson(STATE_FILE) || { meta: { name: "Untitled", phase: "architecture" } };
    state.architecture = architecture;
    writeState(state);
    return text({
      ok: true,
      nodes: (architecture.nodes || []).length,
      edges: (architecture.edges || []).length,
      decisions: (architecture.decisions || []).length,
    });
  }
);

// ── Granular prototype edits — touch one file, not the whole design ─────────

server.registerTool(
  "arta_get_screen",
  {
    description:
      "Read one prototype screen's HTML body (.arta/prototype/screens/<id>.html). Use this instead of pulling the whole state when you only need to look at or edit one screen.",
    inputSchema: { id: zod.string().describe("Screen id from the manifest.") },
  },
  async ({ id }) => {
    const html = readRaw(screenFile(id));
    if (html == null) return text({ exists: false, id, note: "No body file — screen may use inline html or not exist." });
    return text({ id, html });
  }
);

server.registerTool(
  "arta_set_screen",
  {
    description:
      "Create or replace one screen: writes only .arta/prototype/screens/<id>.html and upserts the screen's entry in the manifest (title/url/frame/safeArea). Other screens and the rest of the design are untouched. This is how you edit a screen cheaply. For an ios/android/ipad screen the content is full-screen and the status bar + notch overlay it by default — so PAD the top/bottom (≈48/28px on ios) so the header and bottom bar clear them, and set `safeArea` to the top-edge colour so the clock auto-contrasts. Pass `chrome:false` to drop the status bar entirely (true edge-to-edge: splash/login/media). STYLE WITH TAILWIND UTILITY CLASSES (injected live) — not inline style=; use lucide icons (<i data-lucide=\"…\">), never emoji.",
    inputSchema: {
      id: zod.string(),
      html: zod
        .string()
        .describe(
          "The screen body (HTML). With a layout, just the slot content. Use Tailwind utility classes for styling (NOT inline style=); lucide icons, not emoji. Inline style only for a genuinely dynamic value a utility can't express."
        ),
      title: zod.string().optional(),
      url: zod.string().optional(),
      frame: zod.enum(["web", "desktop", "ios", "android", "ipad"]).optional(),
      safeArea: zod
        .string()
        .optional()
        .describe(
          "For ios/android/ipad frames: the screen's top-edge colour (any CSS colour) so the overlaid status-bar clock + icons auto-contrast. Empty string clears it."
        ),
      chrome: zod
        .boolean()
        .optional()
        .describe(
          "Chrome mode on ios/android/ipad. Default true = the status bar (real time) + notch + home indicator overlay the full-screen content (pad top/bottom to clear them). false = no status bar at all (splash, camera, media, or a screen that draws its own bars)."
        ),
    },
  },
  async ({ id, html, title, url, frame, safeArea, chrome }) => {
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
    if (safeArea !== undefined) {
      if (safeArea === "") delete sc.safeArea;
      else sc.safeArea = safeArea;
    }
    if (chrome !== undefined) sc.chrome = chrome;
    delete sc.html; // body lives in the file now
    writeState(state);
    return text({ ok: true, id, wrote: screenFile(id) });
  }
);

server.registerTool(
  "arta_delete_screen",
  {
    description:
      "Remove one screen: drops its manifest entry AND deletes .arta/prototype/screens/<id>.html. If it was the prototype `start`, start is repointed to the first remaining screen. Use this to clean up a stray / leftover screen — e.g. the seed `home` placeholder (\"Ask Claude Code to design here\") once you've built the real screens, or a lo-fi sketch you no longer need. Leaving an empty placeholder in the manifest shows the dev a blank screen, so delete it.",
    inputSchema: { id: zod.string().describe("Screen id to remove.") },
  },
  async ({ id }) => {
    const state = readJson(STATE_FILE);
    if (state == null) return err("No state.json yet.");
    const proto = state.prototype || {};
    const screens = proto.screens || [];
    const before = screens.length;
    proto.screens = screens.filter((s) => s.id !== id);
    if (proto.screens.length === before)
      return err(`No screen "${id}" in the manifest. Existing: ${screens.map((s) => s.id).join(", ") || "(none)"}`);
    if (proto.start === id) proto.start = proto.screens[0]?.id; // repoint start off the deleted screen
    state.prototype = proto;
    writeState(state);
    try { fs.unlinkSync(screenFile(id)); } catch {}
    return text({ ok: true, deleted: id, start: proto.start ?? null, remaining: proto.screens.map((s) => s.id) });
  }
);

server.registerTool(
  "arta_get_component",
  {
    description: "Read a shared component's HTML (.arta/prototype/components/<name>.html).",
    inputSchema: { name: zod.string() },
  },
  async ({ name }) => {
    const html = readRaw(componentFile(name));
    if (html == null) return text({ exists: false, name });
    return text({ name, html });
  }
);

server.registerTool(
  "arta_set_component",
  {
    description:
      "Create or replace a shared component (.arta/prototype/components/<name>.html), referenced as {{>name}} from the layout or screens. Edit it once and every screen that uses it updates — no per-screen edits. The file is the source of truth: this also clears any stale inline `prototype.components[name]` override in state.json, so a slim patch can't blank the component out. Style with Tailwind utility classes (injected live), not inline style=; lucide icons, not emoji.",
    inputSchema: { name: zod.string(), html: zod.string().describe("Component HTML. Tailwind utility classes for styling (not inline style=); lucide icons, not emoji.") },
  },
  async ({ name, html }) => {
    fs.mkdirSync(COMP_DIR, { recursive: true });
    fs.writeFileSync(componentFile(name), html);
    // Drop any inline override in the state map so the file we just wrote wins
    // (an inline "" here is exactly what used to blank a real component).
    const state = readJson(STATE_FILE);
    if (state && state.prototype && state.prototype.components && name in state.prototype.components) {
      delete state.prototype.components[name];
      writeState(state);
    }
    return text({ ok: true, name, wrote: componentFile(name) });
  }
);

server.registerTool(
  "arta_get_design_system",
  {
    description: "Read the shared prototype CSS (.arta/prototype/design-system.css).",
    inputSchema: {},
  },
  async () => {
    const css = readRaw(CSS_FILE);
    if (css == null) return text({ exists: false });
    return text({ css });
  }
);

server.registerTool(
  "arta_set_design_system",
  {
    description: "Replace the shared prototype CSS (.arta/prototype/design-system.css), injected into every freeform screen.",
    inputSchema: { css: zod.string() },
  },
  async ({ css }) => {
    fs.mkdirSync(PROTO_DIR, { recursive: true });
    fs.writeFileSync(CSS_FILE, css);
    return text({ ok: true, wrote: CSS_FILE });
  }
);

server.registerTool(
  "arta_get_design_tokens",
  {
    description:
      "Read the structured design tokens (prototype.tokens) — the design system's foundations: colors, typography, spacing, radii, shadows, fonts.",
    inputSchema: {},
  },
  async () => {
    const state = readJson(STATE_FILE);
    return text(state?.prototype?.tokens ?? { note: "No design tokens yet — set them with arta_set_design_tokens." });
  }
);

server.registerTool(
  "arta_set_design_tokens",
  {
    description:
      "Write the design system's foundations (prototype.tokens), shown in the Prototype tab's 'Design system' sub-view as a style guide. Tokens COMPILE TO CSS CUSTOM PROPERTIES injected into every screen — colors→var(--color-<name>), spacing→var(--space-<name>), radii→var(--radius-<name>), shadows→var(--shadow-<name>), fonts→var(--font-<name>), typography→var(--text-<name>). Define tokens here first, then style screens with those vars (or Tailwind arbitrary values like bg-[var(--color-primary)]) so the design system is the single source of truth. Replaces the whole tokens object; the viewer repaints.",
    inputSchema: {
      colors: zod.array(zod.object({ name: zod.string(), value: zod.string(), description: zod.string().optional() })).optional(),
      typography: zod
        .array(
          zod.object({
            name: zod.string(),
            sample: zod.string().optional(),
            family: zod.string().optional(),
            size: zod.string().optional(),
            weight: zod.union([zod.string(), zod.number()]).optional(),
            lineHeight: zod.string().optional(),
            letterSpacing: zod.string().optional(),
          })
        )
        .optional(),
      spacing: zod.array(zod.object({ name: zod.string(), value: zod.string(), description: zod.string().optional() })).optional(),
      radii: zod.array(zod.object({ name: zod.string(), value: zod.string(), description: zod.string().optional() })).optional(),
      shadows: zod.array(zod.object({ name: zod.string(), value: zod.string(), description: zod.string().optional() })).optional(),
      fonts: zod.array(zod.object({ name: zod.string(), value: zod.string(), description: zod.string().optional() })).optional(),
    },
  },
  async (tokens) => {
    const state = readJson(STATE_FILE);
    if (state == null) return err("No state.json yet.");
    state.prototype = state.prototype || {};
    const next = {};
    for (const k of ["colors", "typography", "spacing", "radii", "shadows", "fonts"]) {
      if (Array.isArray(tokens[k])) next[k] = tokens[k];
    }
    state.prototype.tokens = next;
    writeState(state);
    return text({ ok: true, tokens: next });
  }
);

server.registerTool(
  "arta_design_review",
  {
    description:
      "Run impeccable's deterministic design-quality detectors over the prototype's screen HTML and return the findings — an anti-slop craft eye for the loop (gradient text, side-stripe borders, glassmorphism-by-default, identical card grids, low-contrast text, tiny uppercase eyebrows, over-rounded cards, etc.). Like arta_get_screenshot sees the pixels and the error feed sees runtime, this catches design issues before the dev does. Needs impeccable available — the first run fetches it via `npx` (a few seconds); offline / unavailable returns a note, NOT an error. Pass a screen id to scan one screen, or omit to scan all.",
    inputSchema: {
      screen: zod.string().optional().describe("Screen id to scan; omit to scan every prototype screen."),
    },
  },
  async ({ screen }) => {
    const target = screen ? screenFile(screen) : SCREEN_DIR;
    if (!fs.existsSync(target)) return err(screen ? `No screen "${screen}".` : "No prototype screens yet.");
    let res;
    try {
      res = spawnSync("npx", ["--yes", "impeccable", "detect", "--json", target], {
        cwd: PROJECT_DIR,
        encoding: "utf8",
        timeout: 180000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      res = { error: e };
    }
    const out = (res.stdout || "").trim();
    const errOut = (res.stderr || "").trim();
    // A linter exits non-zero when it FINDS issues — that's a successful run, not a
    // failure. Only treat "errored, or produced nothing on a non-zero exit" as unavailable.
    if (res.error || (!out && res.status !== 0)) {
      return text({
        ok: false,
        available: false,
        note: "Couldn't run impeccable detect (not installed / offline / npx unavailable). Install it with `npx impeccable install`, or run `/impeccable audit` in Claude Code. Detail: " + ((res.error && res.error.message) || errOut || `exit ${res.status}`),
      });
    }
    let findings = out || errOut || "(no findings)";
    try {
      findings = JSON.parse(out);
    } catch {
      /* not JSON — return as text */
    }
    return text({ ok: true, target, findings });
  }
);

server.registerTool(
  "arta_set_frame",
  {
    description:
      "Set the device frame, safe-area colour, and/or chrome mode — for one screen (pass `screen`) or the prototype default. On ios/android/ipad the content is ALWAYS full-screen (edge-to-edge). `chrome` (default true) overlays the status bar (REAL time) + notch + home indicator ON TOP of the content, so the screen must pad its own top/bottom to clear them (≈48/28px on ios). `safeArea` is the screen's top-edge colour so the overlaid clock/icons auto-contrast (pass `safeArea: \"\"` to clear). `chrome:false` drops the status bar entirely for true edge-to-edge (splash / login / media). Provide at least one of `frame` / `safeArea` / `chrome`.",
    inputSchema: {
      frame: zod.enum(["web", "desktop", "ios", "android", "ipad"]).optional(),
      safeArea: zod
        .string()
        .optional()
        .describe("The screen's top-edge colour (any CSS colour) so the overlaid status-bar clock/icons auto-contrast on ios/android/ipad. Empty string clears it."),
      chrome: zod
        .boolean()
        .optional()
        .describe("Chrome mode on ios/android/ipad. Default true = status bar (real time) + notch + home indicator overlay the full-screen content (pad top/bottom to clear them). false = no status bar at all, true edge-to-edge."),
      screen: zod.string().optional().describe("Screen id to scope to; omit for the prototype default."),
    },
  },
  async ({ frame, safeArea, chrome, screen }) => {
    if (frame === undefined && safeArea === undefined && chrome === undefined)
      return err("Provide at least one of `frame`, `safeArea`, or `chrome`.");
    const state = readJson(STATE_FILE);
    if (state == null) return err("No state.json yet.");
    state.prototype = state.prototype || {};
    let dest;
    if (screen) {
      const sc = (state.prototype.screens || []).find((s) => s.id === screen);
      if (!sc) return err(`No screen "${screen}" in the manifest.`);
      dest = sc;
    } else {
      dest = state.prototype;
    }
    if (frame !== undefined) dest.frame = frame;
    if (safeArea !== undefined) {
      if (safeArea === "") delete dest.safeArea;
      else dest.safeArea = safeArea;
    }
    if (chrome !== undefined) dest.chrome = chrome;
    writeState(state);
    return text({ ok: true, frame: dest.frame, safeArea: dest.safeArea ?? null, chrome: dest.chrome ?? true, screen: screen || "(default)" });
  }
);

server.registerTool(
  "arta_get_view",
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
  "arta_get_screenshot",
  {
    description:
      "Get a PNG of how a prototype screen actually renders — the same pixels the dev sees, captured by the viewer. Use this to check your work visually instead of reasoning only from the HTML. Returns an image; if none exists yet, the screen may not have been viewed in the browser. Pass `full: true` for the WHOLE screen at its full content length (the entire scroll captured in one tall image, not just the device viewport) — best for reviewing a long / scrolling screen end to end. When the screen fits the viewport (nothing to scroll) `full` falls back to the framed shot.",
    inputSchema: {
      screen: zod.string().describe("Screen id."),
      full: zod.boolean().optional().describe("Capture the entire content length (the whole scrollable screen) instead of just the visible device viewport."),
    },
  },
  async ({ screen, full }) => {
    const dir = path.join(ARTA_DIR, "snapshots");
    const candidates = full
      ? [sanitize(screen) + ".full.png", sanitize(screen) + ".png"] // full, then fall back to framed
      : [sanitize(screen) + ".png"];
    for (const name of candidates) {
      try {
        const buf = fs.readFileSync(path.join(dir, name));
        return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] };
      } catch {
        /* try next candidate */
      }
    }
    return text({ exists: false, screen, note: "No snapshot yet — open the viewer and visit this screen." });
  }
);

server.registerTool(
  "arta_get_feedback",
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
  "arta_start_viewer",
  {
    description:
      "Start the Arta viewer FROM THE INSTALLED PLUGIN, pointed at this project's .arta/. Because it runs the launcher that ships with the plugin, the viewer always matches the installed plugin version — no stale npx/bunx cache. First run installs the viewer's deps (a few seconds). Idempotent: if a viewer is already on the port, it just returns the URL (it does NOT restart it — use arta_restart_viewer to pick up a new build after an update). Call this once at the start of a design session so the dev has the canvas open, then keep using the other tools as normal.",
    inputSchema: {
      port: zod.number().int().optional().describe("Port for the viewer (default 7317)."),
    },
  },
  async ({ port }) => {
    const p = Number(port) || 7317;
    registerProject(); // make this project show up in the viewer's project switcher
    if (await portInUse(p))
      return text({
        ok: true,
        alreadyRunning: true,
        url: `http://localhost:${p}`,
        project: readJson(STATE_FILE)?.meta?.name || path.basename(path.resolve(PROJECT_DIR)),
        note: `A viewer is already running on this port — reuse it. It can host several projects: if it's showing a different one, pick this project from the switcher in the top bar. (Serving an old build after an update? use arta_restart_viewer.)`,
      });
    // Port is free → we're spawning THE viewer. First clear any strays left by older
    // versions / bumped ports so they don't pile up (one viewer hosts every project).
    killAllViewers();
    const r = spawnViewer(p);
    if (!r.ok)
      return err(
        `Launcher not found at ${r.launcher}. The plugin may be installed incompletely; the dev can also run \`bunx github:AssetsArt/arta\` manually.`
      );
    return text({
      ok: true,
      started: true,
      url: `http://localhost:${p}`,
      watching: path.join(PROJECT_DIR, ".arta"),
      from: PLUGIN_ROOT,
      note: `Viewer starting from the installed plugin. First run installs its deps (a few seconds) — open ${`http://localhost:${p}`} in a moment. Logs: ${r.logFile}`,
    });
  }
);

server.registerTool(
  "arta_restart_viewer",
  {
    description:
      "Restart the Arta viewer so it serves the LATEST installed plugin build. Stops whatever is listening on the port, waits for it to exit, then relaunches from the installed plugin. Use this right after the plugin updates (`/arta update` or `/plugin update`) — the running viewer keeps serving the old build until it's restarted, so this is what makes an update actually show up on screen. The dev no longer needs to clear caches or kill processes by hand.",
    inputSchema: {
      port: zod.number().int().optional().describe("Port for the viewer (default 7317)."),
    },
  },
  async ({ port }) => {
    const p = Number(port) || 7317;
    registerProject(); // keep this project in the viewer's switcher across a restart
    const launcher = path.join(PLUGIN_ROOT, "bin", "arta.mjs");
    if (!fs.existsSync(launcher))
      return err(
        `Launcher not found at ${launcher}. The plugin may be installed incompletely; the dev can also run \`bunx github:AssetsArt/arta\` manually.`
      );
    const wasRunning = await portInUse(p);
    // Clean slate: stop EVERY Arta viewer (all versions/ports) + the one on this port,
    // so stale builds from past updates don't linger. Escalate to SIGKILL if needed.
    const killed = [...new Set([...killAllViewers(), ...killPort(p)])];
    let freed = await waitPortFree(p);
    if (!freed) {
      killAllViewers("SIGKILL");
      killPort(p);
      freed = await waitPortFree(p, 2500);
    }
    if (!freed)
      return err(
        `Port ${p} is still in use after trying to stop the old viewer${
          killed.length ? ` (signalled PID ${killed.join(", ")})` : ""
        }. Another process may be holding it — free it and retry, or pass a different port.`
      );
    const r = spawnViewer(p);
    if (!r.ok) return err(`Launcher not found at ${r.launcher}.`);
    return text({
      ok: true,
      restarted: true,
      wasRunning,
      stoppedPids: killed,
      url: `http://localhost:${p}`,
      watching: path.join(PROJECT_DIR, ".arta"),
      from: PLUGIN_ROOT,
      note: `Stopped ${killed.length} stale Arta process(es) and relaunched from the installed plugin — now matching the installed version. Reload ${`http://localhost:${p}`} in a moment (hard-refresh if your browser cached the old assets). Logs: ${r.logFile}`,
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
