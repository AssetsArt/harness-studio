import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

// ── Shared canvas layout (.harness/) ───────────────────────────────────────
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
const HARNESS_DIR = ".harness";
const STATE_FILE = "state.json";
const RUNTIME_FILE = "runtime.json";
const FEEDBACK_FILE = "feedback.json";
const PROTO_DIR = "prototype";
const CSS_FILE = "design-system.css";
const COMP_DIR = "components";
const SCREEN_DIR = "screens";

function readJson(file: string): unknown | null {
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

export function harnessWatch(): Plugin {
  let dir = "";
  let runtimeFile = "";
  let feedbackFile = "";

  let snapshotDir = "";
  const isHarnessSource = (file: string) => {
    const r = path.resolve(file);
    return (
      dir !== "" &&
      r.startsWith(dir) &&
      r !== runtimeFile &&
      r !== feedbackFile &&
      !r.startsWith(snapshotDir) // snapshots are viewer→agent output, not a design source
    );
  };

  return {
    name: "harness-watch",

    // Suppress Vite's default full-page reload for any .harness source change —
    // we push an in-place update over the WebSocket instead (keeps the dev's
    // current tab/screen). The actual push happens in the watcher handler below.
    handleHotUpdate(ctx) {
      if (isHarnessSource(ctx.file)) return [];
      return;
    },

    configureServer(srv: ViteDevServer) {
      // HARNESS_DIR lets one viewer watch any project's canvas (the launcher sets
      // it to the user's project); otherwise default to <root>/.harness.
      dir = process.env.HARNESS_DIR
        ? path.resolve(process.env.HARNESS_DIR)
        : path.resolve(srv.config.root, HARNESS_DIR);
      const stateFile = path.join(dir, STATE_FILE);
      runtimeFile = path.join(dir, RUNTIME_FILE);
      feedbackFile = path.join(dir, FEEDBACK_FILE);
      snapshotDir = path.join(dir, "snapshots");

      // Pre-create the split-file dirs so chokidar watches files created later.
      fs.mkdirSync(path.join(dir, PROTO_DIR, COMP_DIR), { recursive: true });
      fs.mkdirSync(path.join(dir, PROTO_DIR, SCREEN_DIR), { recursive: true });
      fs.mkdirSync(snapshotDir, { recursive: true });

      const pushState = () => {
        const assembled = assembleState(dir);
        if (assembled != null) {
          srv.ws.send({ type: "custom", event: "harness:update", data: JSON.stringify(assembled) });
        }
      };

      // Describe an edit so the viewer can show a legible "what the AI changed" feed.
      const describeChange = (file: string, event: string) => {
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
        if (r === stateFile) return { kind: "state", label: `${verb} spec / plan / data / flow` };
        return { kind: "other", label: `${verb} ${path.basename(r)}` };
      };

      srv.watcher.add(stateFile);
      srv.watcher.add(path.join(dir, PROTO_DIR));
      srv.watcher.on("all", (event, file) => {
        if ((event === "add" || event === "change" || event === "unlink") && isHarnessSource(file)) {
          srv.ws.send({ type: "custom", event: "harness:change", data: describeChange(file, event) });
          pushState();
        }
      });

      srv.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];

        // Initial state load for the viewer — fully assembled from the split files.
        if (url === "/__harness/state" && req.method === "GET") {
          const raw = readRaw(stateFile);
          if (raw == null) return send(res, 200, { ok: true, state: null });
          try {
            JSON.parse(raw);
          } catch (e) {
            return send(res, 200, { ok: false, error: String(e) });
          }
          return send(res, 200, { ok: true, state: assembleState(dir) });
        }

        // Viewer reports which tab/screen the dev is looking at.
        if (url === "/__harness/runtime" && req.method === "POST") {
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
            fs.writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2));
            return send(res, 200, { ok: true });
          } catch (e) {
            return send(res, 400, { ok: false, error: String(e) });
          }
        }

        // Dev leaves feedback from inside the viewer → appended to the queue.
        if (url === "/__harness/feedback" && req.method === "POST") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const text = String(body.text || "").trim();
            if (!text) return send(res, 400, { ok: false, error: "empty feedback" });
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

        if (url === "/__harness/feedback" && req.method === "GET") {
          const list = (readJson(feedbackFile) as { read?: boolean }[]) || [];
          return send(res, 200, { ok: true, pending: list.filter((f) => !f.read).length });
        }

        // Viewer captures the rendered screen and hands the agent a real picture.
        if (url === "/__harness/snapshot" && req.method === "POST") {
          try {
            const body = JSON.parse((await readBody(req)) || "{}");
            const id = sanitize(String(body.screen || ""));
            const data = String(body.dataUrl || "");
            const m = data.match(/^data:image\/png;base64,(.+)$/);
            if (!id || !m) return send(res, 400, { ok: false, error: "expected screen + png dataUrl" });
            fs.mkdirSync(snapshotDir, { recursive: true });
            fs.writeFileSync(path.join(snapshotDir, id + ".png"), Buffer.from(m[1], "base64"));
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
