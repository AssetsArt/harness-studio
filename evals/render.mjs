#!/usr/bin/env bun
// Emit a self-contained HTML file per screen that renders IDENTICALLY to the viewer's
// FreeformDevice iframe — same FONT_LINK, same compiled token CSS + designSystem sheet,
// same Tailwind-browser + lucide CDNs, plus a slim runtime that applies the mock store
// (data-bind / data-show) and renders lucide icons, so the painted result matches what
// the dev sees. A browser (playwright) then loads these to capture console errors and a
// screenshot — the live-render + screenshot graders, headless.
//
//   bun evals/render.mjs --brief <id> --dir <.harness dir>
//   -> writes <dir>/_render/<screenId>.html and prints a JSON manifest (screens + viewport)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScreenHtml, designSheet, FONT_LINK } from "../src/lib/prototype.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRIEFS = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/briefs.json"), "utf8"));
const sanitize = (s) => String(s).replace(/[^a-z0-9_-]/gi, "");
const readRaw = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
const listHtml = (d) => { try { return fs.readdirSync(d).filter((f) => f.endsWith(".html")); } catch { return []; } };

// (same assembleState as the viewer / grader — inline split files, blank inline falls back to file)
function assemble(dir) {
  const raw = readRaw(path.join(dir, "state.json"));
  if (raw == null) return null;
  let state; try { state = JSON.parse(raw); } catch { return null; }
  const proto = state.prototype;
  if (proto && typeof proto === "object") {
    const pdir = path.join(dir, "prototype");
    if (proto.designSystem == null) { const css = readRaw(path.join(pdir, "design-system.css")); if (css != null) proto.designSystem = css; }
    const cdir = path.join(pdir, "components"); const fileComps = {};
    for (const f of listHtml(cdir)) { const c = readRaw(path.join(cdir, f)); if (c != null) fileComps[f.replace(/\.html$/, "")] = c; }
    const merged = { ...fileComps };
    for (const [k, v] of Object.entries(proto.components || {})) { if (typeof v === "string" && v.trim() === "" && fileComps[k] != null) continue; merged[k] = v; }
    proto.components = merged;
    const sdir = path.join(pdir, "screens");
    for (const sc of proto.screens || []) {
      const blank = sc && (sc.html == null || (typeof sc.html === "string" && sc.html.trim() === ""));
      if (sc && blank && sc.components == null && sc.id) { const h = readRaw(path.join(sdir, sanitize(sc.id) + ".html")); if (h != null) sc.html = h; }
    }
  }
  return state;
}

// Mirrors FreeformDevice.tsx BASE_CSS.
const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:'Geist',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:#18181b;background:#fff;-webkit-font-smoothing:antialiased}img{max-width:100%;display:block}a{color:inherit;text-decoration:none}button{font-family:inherit;cursor:pointer}`;
const HEAD_LIBS =
  `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>` +
  `<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js" defer></script>`;
// Slim runtime: reflect the mock store into data-bind/data-show and render lucide icons —
// the parts that affect the painted screenshot. (data-to/inc/dec are click-only.)
const RUNTIME = (store, screenId) => `<script>
(function(){var store=${JSON.stringify(store || {})};var screenId=${JSON.stringify(screenId || "")};
function render(){
  document.querySelectorAll('[data-bind]').forEach(function(el){var k=el.getAttribute('data-bind');el.textContent=(store[k]!==undefined&&store[k]!==null)?store[k]:'';});
  document.querySelectorAll('[data-show]').forEach(function(el){var c=el.getAttribute('data-show'),vis;if(c.indexOf('==')>-1){var p=c.split('==');vis=String(store[p[0].trim()])===p[1].trim();}else{var v=store[c.trim()];vis=!!v&&v!=='0'&&v!==0;}el.style.display=vis?'':'none';});
}
function markNav(){ if(!screenId) return; document.querySelectorAll('[data-nav]').forEach(function(el){ el.classList.toggle('is-active', el.getAttribute('data-nav')===screenId); }); }
function icons(){try{if(window.lucide&&window.lucide.createIcons)window.lucide.createIcons();}catch(_){}}
window.addEventListener('load',function(){render();markNav();icons();setTimeout(icons,300);});
})();</script>`;

function buildDoc(proto, screen) {
  const body = resolveScreenHtml(proto, screen);
  const sheet = `${BASE_CSS}\n${designSheet(proto)}\n${screen.css ?? ""}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    FONT_LINK + `<style>${sheet}</style>` + RUNTIME(proto.store, screen.id) + HEAD_LIBS + `</head><body>${body}</body></html>`;
}

const args = process.argv.slice(2);
const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const briefId = get("--brief"); const dir = get("--dir");
if (!briefId || !dir) { console.error("usage: bun evals/render.mjs --brief <id> --dir <.harness dir>"); process.exit(2); }
const brief = BRIEFS.briefs.find((b) => b.id === briefId);
const state = assemble(path.resolve(dir));
const proto = state?.prototype || {};
const frame = (proto.screens || [])[0]?.frame || proto.frame || brief?.frame || "web";
const viewport = frame === "ios" || frame === "android" ? { width: 390, height: 844 } : { width: 1280, height: 900 };
const outDir = path.join(path.resolve(dir), "_render");
fs.mkdirSync(outDir, { recursive: true });
const screens = (proto.screens || []).filter((s) => s && s.id);
const manifest = [];
for (const s of screens) {
  const file = path.join(outDir, sanitize(s.id) + ".html");
  fs.writeFileSync(file, buildDoc(proto, s));
  manifest.push({ id: s.id, file, url: "file://" + file });
}
console.log(JSON.stringify({ brief: briefId, frame, viewport, screens: manifest }, null, 2));
