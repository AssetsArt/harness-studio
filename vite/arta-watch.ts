import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

// ── Shared canvas layout (.arta/) ───────────────────────────────────────
// state.json                       meta/spec/plan/dataModel/flow + prototype MANIFEST
// prototype/design-system.css      shared CSS (or inline prototype.designSystem)
// prototype/components/<name>.html shared HTML fragments (or inline prototype.components)
// prototype/screens/<id>.html      each screen body (or inline screen.html)
// runtime.json / feedback.json     viewer→agent channel (written by this plugin)
//
// Splitting the prototype across files keeps each piece small: the implementing
// agent reads/writes one screen or component file at a time instead of the whole
// design. This plugin re-assembles them into a single state object for the viewer,
// so the client stays unaware of the split.
//
// ── Multiple projects, one viewer ──────────────────────────────────────
// One viewer process (one port) can show several projects. Each project's MCP
// upserts itself into a shared registry at ~/.arta/registry.json ({id,name,dir});
// this plugin serves any of them (state/runtime/feedback/snapshot take ?project=<id>)
// and watches them all, tagging live pushes with the project id. The client picks the
// active project (persisted in localStorage) and ignores pushes for the others. With a
// single project the registry holds just the home project and everything behaves as
// before.
const ARTA_DIR = ".arta";
const STATE_FILE = "state.json";
const RUNTIME_FILE = "runtime.json";
const FEEDBACK_FILE = "feedback.json";
const PROTO_DIR = "prototype";
const CSS_FILE = "design-system.css";
const COMP_DIR = "components";
const SCREEN_DIR = "screens";
const REGISTRY_FILE = path.join(os.homedir(), ".arta", "registry.json");

interface Project {
  id: string;
  name: string;
  dir: string;
}

// Stable short id from an absolute project dir (FNV-1a → base36). MUST match the
// identical helper in mcp/server.mjs so a project registered by the MCP resolves to
// the same id the viewer computes.
function idFor(dir: string): string {
  const s = path.resolve(dir);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function readJson(file: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function readRaw(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
function listHtml(d: string): string[] {
  try {
    return fs.readdirSync(d).filter((f) => f.endsWith(".html"));
  } catch {
    return [];
  }
}
const sanitize = (s: string) => String(s).replace(/[^a-z0-9_-]/gi, "");

// `dir` is a project's .arta dir, so the human label comes from its state's
// meta.name, then the registry's name, then the PARENT folder (the project dir).
function displayName(dir: string, fallback?: string): string {
  const meta = readJson(path.join(dir, STATE_FILE))?.meta;
  return (meta && typeof meta.name === "string" && meta.name.trim()) || fallback || path.basename(path.dirname(dir));
}

// Inline the externalised prototype pieces (CSS / components / screen bodies)
// into the state object. Inline values in state.json win over files.
function assembleState(dir: string): Record<string, unknown> | null {
  const raw = readRaw(path.join(dir, STATE_FILE));
  if (raw == null) return null;
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }
  const proto = state.prototype as
    | { designSystem?: string; components?: Record<string, string>; screens?: { id?: string; html?: string; components?: unknown }[] }
    | undefined;
  if (proto && typeof proto === "object") {
    const pdir = path.join(dir, PROTO_DIR);
    if (proto.designSystem == null) {
      const css = readRaw(path.join(pdir, CSS_FILE));
      if (css != null) proto.designSystem = css;
    }
    const cdir = path.join(pdir, COMP_DIR);
    const fileComps: Record<string, string> = {};
    for (const f of listHtml(cdir)) {
      const c = readRaw(path.join(cdir, f));
      if (c != null) fileComps[f.replace(/\.html$/, "")] = c;
    }
    // Inline values win over files — but a BLANK inline value must not blank out a
    // real file. A slim patch_state can leave `components: { card: "" }` behind; the
    // file on disk is the source of truth, so an empty/whitespace inline entry falls
    // back to the file instead of overriding it.
    const merged: Record<string, string> = { ...fileComps };
    for (const [k, v] of Object.entries(proto.components || {})) {
      if (typeof v === "string" && v.trim() === "" && fileComps[k] != null) continue;
      merged[k] = v as string;
    }
    proto.components = merged;
    const sdir = path.join(pdir, SCREEN_DIR);
    for (const sc of proto.screens || []) {
      // Read the file when the screen has no inline body — or only a blank one (same
      // footgun as components: an empty inline html shouldn't hide the real file).
      const blankHtml = sc && (sc.html == null || (typeof sc.html === "string" && sc.html.trim() === ""));
      if (sc && blankHtml && sc.components == null && sc.id) {
        const h = readRaw(path.join(sdir, sanitize(sc.id) + ".html"));
        if (h != null) sc.html = h;
      }
    }
  }
  return state;
}

function send(res: import("node:http").ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 4_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function artaWatch(): Plugin {
  let homeDir = "";
  let homeId = "";
  let projects: Project[] = [];
  let projectDirs: string[] = [];

  // A file is a design source if it lives under SOME known project dir and isn't one
  // of the viewer→agent output files (runtime/feedback/snapshots).
  const isArtaSource = (file: string) => {
    const r = path.resolve(file);
    if (!projectDirs.some((d) => r === d || r.startsWith(d + path.sep))) return false;
    const base = path.basename(r);
    if (base === RUNTIME_FILE || base === FEEDBACK_FILE) return false;
    if (r.split(path.sep).includes("snapshots")) return false;
    return true;
  };
  const projectForFile = (file: string): Project | undefined => {
    const r = path.resolve(file);
    return projects.find((p) => r === p.dir || r.startsWith(p.dir + path.sep));
  };
  const projectById = (id: string | null): Project | undefined =>
    (id && projects.find((p) => p.id === id)) || undefined;

  // The home project (this process was launched for) is always present and first;
  // registry entries follow, but only if their canvas still exists on disk.
  const loadProjects = (): Project[] => {
    const seen = new Map<string, Project>();
    const add = (dir: string, name: string | undefined, requireState: boolean) => {
      const rd = path.resolve(dir);
      const id = idFor(rd);
      if (seen.has(id)) return;
      if (requireState && !fs.existsSync(path.join(rd, STATE_FILE))) return;
      seen.set(id, { id, name: displayName(rd, name), dir: rd });
    };
    add(homeDir, path.basename(path.dirname(homeDir)), false); // home always, even before its first write
    const reg = readJson(REGISTRY_FILE);
    if (Array.isArray(reg)) for (const e of reg) if (e && typeof e.dir === "string") add(e.dir, e.name, true);
    return [...seen.values()];
  };

  return {
    name: "arta-watch",

    // Suppress Vite's default full-page reload for any .arta source change —
    // we push an in-place update over the WebSocket instead (keeps the dev's
    // current tab/screen). The actual push happens in the watcher handler below.
    handleHotUpdate(ctx) {
      if (isArtaSource(ctx.file)) return [];
      return;
    },

    configureServer(srv: ViteDevServer) {
      // ARTA_DIR lets one viewer watch any project's canvas (the launcher sets
      // it to the user's project); otherwise default to <root>/.arta.
      homeDir = process.env.ARTA_DIR
        ? path.resolve(process.env.ARTA_DIR)
        : path.resolve(srv.config.root, ARTA_DIR);
      homeId = idFor(homeDir);

      // Pre-create the home split-file dirs so chokidar watches files created later.
      fs.mkdirSync(path.join(homeDir, PROTO_DIR, COMP_DIR), { recursive: true });
      fs.mkdirSync(path.join(homeDir, PROTO_DIR, SCREEN_DIR), { recursive: true });
      fs.mkdirSync(path.join(homeDir, "snapshots"), { recursive: true });

      const watchProject = (p: Project) => {
        srv.watcher.add(path.join(p.dir, STATE_FILE));
        srv.watcher.add(path.join(p.dir, PROTO_DIR));
      };
      const refreshProjects = () => {
        projects = loadProjects();
        const next = projects.map((p) => p.dir);
        for (const p of projects) if (!projectDirs.includes(p.dir)) watchProject(p);
        projectDirs = next;
      };
      refreshProjects();
      srv.watcher.add(REGISTRY_FILE);

      // Describe an edit so the viewer can show a legible "what the AI changed" feed.
      const describeChange = (file: string, event: string, dir: string) => {
        const r = path.resolve(file);
        const verb = event === "unlink" ? "removed" : event === "add" ? "added" : "updated";
        if (r.startsWith(path.join(dir, PROTO_DIR, SCREEN_DIR))) {
          const id = path.basename(r, ".html");
          return { kind: "screen", id, label: `${verb} screen: ${id}` };
        }
        if (r.startsWith(path.join(dir, PROTO_DIR, COMP_DIR))) {
          const name = path.basename(r, ".html");
          return { kind: "component", id: name, label: `${verb} component: ${name}` };
        }
        if (r === path.join(dir, PROTO_DIR, CSS_FILE)) return { kind: "designSystem", label: `${verb} design system` };
        if (r === path.join(dir, STATE_FILE)) return { kind: "state", label: `${verb} spec / plan / data / flow` };
        return { kind: "other", label: `${verb} ${path.basename(r)}` };
      };

      const pushProjects = () =>
        srv.ws.send({ type: "custom", event: "arta:projects", data: projects.map((p) => ({ id: p.id, name: p.name })) });

      srv.watcher.on("all", (event, file) => {
        const r = path.resolve(file);
        if (r === path.resolve(REGISTRY_FILE)) {
          refreshProjects();
          pushProjects();
          return;
        }
        if ((event === "add" || event === "change" || event === "unlink") && isArtaSource(file)) {
          const proj = projectForFile(file);
          if (!proj) return;
          srv.ws.send({ type: "custom", event: "arta:change", data: { project: proj.id, ...describeChange(file, event, proj.dir) } });
          const assembled = assembleState(proj.dir);
          if (assembled != null) srv.ws.send({ type: "custom", event: "arta:update", data: JSON.stringify({ project: proj.id, state: assembled }) });
          // A state.json write may have set/changed meta.name → keep the switcher labels fresh.
          if (path.basename(r) === STATE_FILE) {
            const fresh = displayName(proj.dir, proj.name);
            if (fresh !== proj.name) { proj.name = fresh; pushProjects(); }
          }
        }
      });

      // Resolve ?project=<id> to a project dir, defaulting to home.
      const dirFor = (req: import("node:http").IncomingMessage): string => {
        const q = (req.url || "").split("?")[1] || "";
        const id = new URLSearchParams(q).get("project");
        return projectById(id)?.dir ?? homeDir;
      };

      srv.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];

        // The list of projects this viewer can show (home first).
        if (url === "/__arta/projects" && req.method === "GET") {
          return send(res, 200, { ok: true, home: homeId, projects: projects.map((p) => ({ id: p.id, name: p.name })) });
        }

        // Initial state load for the viewer — fully assembled from the split files.
        if (url === "/__arta/state" && req.method === "GET") {
          const dir = dirFor(req);
          const raw = readRaw(path.join(dir, STATE_FILE));
          if (raw == null) return send(res, 200, { ok: true, state: null });
          try {
            JSON.parse(raw);
          } catch (e) {
            return send(res, 200, { ok: false, error: String(e) });
          }
          return send(res, 200, { ok: true, state: assembleState(dir) });
        }

        // Viewer reports which tab/screen the dev is looking at — into that project's dir.
        if (url === "/__arta/runtime" && req.method === "POST") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const runtime = {
              tab: body.tab ?? null,
              screen: body.screen ?? null,
              screens: Array.isArray(body.screens) ? body.screens : [],
              phase: body.phase ?? null,
              store: body.store ?? {},
              errors: Array.isArray(body.errors) ? body.errors : [],
              updatedAt: body.updatedAt ?? null,
              reportedAt: new Date().toISOString(),
            };
            fs.writeFileSync(path.join(dirFor(req), RUNTIME_FILE), JSON.stringify(runtime, null, 2));
            return send(res, 200, { ok: true });
          } catch (e) {
            return send(res, 400, { ok: false, error: String(e) });
          }
        }

        // Dev leaves feedback from inside the viewer → appended to that project's queue.
        if (url === "/__arta/feedback" && req.method === "POST") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const text = String(body.text || "").trim();
            if (!text) return send(res, 400, { ok: false, error: "empty feedback" });
            const feedbackFile = path.join(dirFor(req), FEEDBACK_FILE);
            const list = (readJson(feedbackFile) as unknown[]) || [];
            list.push({
              text,
              tab: body.tab ?? null,
              screen: body.screen ?? null,
              element: body.element ?? null,
              at: new Date().toISOString(),
              read: false,
            });
            fs.writeFileSync(feedbackFile, JSON.stringify(list, null, 2));
            return send(res, 200, { ok: true, count: list.length });
          } catch (e) {
            return send(res, 400, { ok: false, error: String(e) });
          }
        }

        if (url === "/__arta/feedback" && req.method === "GET") {
          const list = (readJson(path.join(dirFor(req), FEEDBACK_FILE)) as { read?: boolean }[]) || [];
          return send(res, 200, { ok: true, pending: list.filter((f) => !f.read).length });
        }

        // Viewer captures the rendered screen and hands the agent a real picture.
        if (url === "/__arta/snapshot" && req.method === "POST") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const id = sanitize(String(body.screen || ""));
            const data = String(body.dataUrl || "");
            const m = data.match(/^data:image\/png;base64,(.+)$/);
            if (!id || !m) return send(res, 400, { ok: false, error: "expected screen + png dataUrl" });
            const snapDir = path.join(dirFor(req), "snapshots");
            fs.mkdirSync(snapDir, { recursive: true });
            // `.full.png` = the whole screen at content length; `.png` = the framed viewport.
            fs.writeFileSync(path.join(snapDir, id + (body.full ? ".full.png" : ".png")), Buffer.from(m[1], "base64"));
            return send(res, 200, { ok: true });
          } catch (e) {
            return send(res, 400, { ok: false, error: String(e) });
          }
        }

        next();
      });
    },
  };
}
