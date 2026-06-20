#!/usr/bin/env bun
// Deterministic grader for the harness-studio eval. Given a built .harness/ dir and
// a brief id, it assembles the prototype EXACTLY like the viewer (vite/harness-watch
// assembleState), then scores five verifiable assertions:
//
//   A1 tokens-set     — a real design system exists and screens use it (not raw hex)
//   A2 shared-layout  — layout + components factored, no duplicated screen markup
//   A3 interactivity  — data-to targets valid + all screens reachable + binds resolve
//   A4 renders-clean  — every screen fully expands, non-empty, roughly tag-balanced
//   A5 design-review  — impeccable detect finds zero SERIOUS anti-slop findings
//
// No LLM: every check is computed from the artifacts. Output is JSON on stdout.
//   bun evals/grade.mjs --brief checkout --dir /path/to/.harness [--json]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveScreenHtml, designSheet, compileTokens, expandFragment } from "../src/lib/prototype.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRIEFS = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/briefs.json"), "utf8"));
const SERIOUS = new Set(BRIEFS.serious_antipatterns);
const DETECT =
  process.env.IMPECCABLE_DETECT ||
  path.join(os.homedir(), ".claude/skills/impeccable/scripts/detect.mjs");

const sanitize = (s) => String(s).replace(/[^a-z0-9_-]/gi, "");
// Rough luminance of a hex/rgb colour → is it dark? (for the safe-area heuristic)
function isDarkColor(v) {
  const s = String(v || "").trim();
  let r = 255, g = 255, b = 255;
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.replace(/./g, "$&$&"); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  else { m = s.match(/rgba?\(([^)]+)\)/i); if (m) { const p = m[1].split(",").map(parseFloat); [r, g, b] = p; } else return false; }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}
// Brand / social icon names lucide's UMD core DROPPED — they render BLANK (an empty gap,
// the classic footer "social strip" tell). data-lucide on any of these = a render defect a
// raw HTML check can catch without a browser. Keep in sync with the SKILL.md icon note.
const BLANK_ICONS = new Set([
  "github", "twitter", "x-twitter", "linkedin", "slack", "facebook", "instagram",
  "youtube", "discord", "dribbble", "gitlab", "figma", "twitch", "tiktok", "whatsapp",
]);
const readRaw = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return null; } };
const listHtml = (d) => { try { return fs.readdirSync(d).filter((f) => f.endsWith(".html")); } catch { return []; } };

// Mirror of vite/harness-watch.ts assembleState: inline the split files (css /
// components / screen bodies) into state.prototype, inline values winning over files
// EXCEPT blank inline values, which fall back to the file on disk.
function assemble(dir) {
  const raw = readRaw(path.join(dir, "state.json"));
  if (raw == null) return null;
  let state;
  try { state = JSON.parse(raw); } catch { return null; }
  const proto = state.prototype;
  if (proto && typeof proto === "object") {
    const pdir = path.join(dir, "prototype");
    if (proto.designSystem == null) {
      const css = readRaw(path.join(pdir, "design-system.css"));
      if (css != null) proto.designSystem = css;
    }
    const cdir = path.join(pdir, "components");
    const fileComps = {};
    for (const f of listHtml(cdir)) {
      const c = readRaw(path.join(cdir, f));
      if (c != null) fileComps[f.replace(/\.html$/, "")] = c;
    }
    const merged = { ...fileComps };
    for (const [k, v] of Object.entries(proto.components || {})) {
      if (typeof v === "string" && v.trim() === "" && fileComps[k] != null) continue;
      merged[k] = v;
    }
    proto.components = merged;
    const sdir = path.join(pdir, "screens");
    for (const sc of proto.screens || []) {
      const blank = sc && (sc.html == null || (typeof sc.html === "string" && sc.html.trim() === ""));
      if (sc && blank && sc.components == null && sc.id) {
        const h = readRaw(path.join(sdir, sanitize(sc.id) + ".html"));
        if (h != null) sc.html = h;
      }
    }
  }
  return state;
}

// token-shingle Jaccard similarity of two strings (for duplicate-markup detection)
function similarity(a, b) {
  const sh = (s) => {
    const toks = String(s).replace(/\s+/g, " ").trim().split(" ");
    const set = new Set();
    for (let i = 0; i + 4 <= toks.length; i++) set.add(toks.slice(i, i + 4).join(" "));
    return set;
  };
  const A = sh(a), B = sh(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function attrValues(html, attr) {
  const out = [];
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "g");
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

export function grade(briefId, dir) {
  const brief = BRIEFS.briefs.find((b) => b.id === briefId);
  if (!brief) throw new Error(`unknown brief ${briefId}`);
  const state = assemble(dir);
  if (!state) return { brief: briefId, ok: false, fatal: "no state.json / unparseable", score: 0 };
  const proto = state.prototype || {};
  const screens = (proto.screens || []).filter((s) => s && s.id);
  const ids = new Set(screens.map((s) => s.id));
  const resolved = {}; // id -> final body html
  for (const s of screens) {
    try { resolved[s.id] = resolveScreenHtml(proto, s); } catch (e) { resolved[s.id] = ""; }
  }
  const allResolved = Object.values(resolved).join("\n");
  const sheet = designSheet(proto);
  const metrics = {};

  // ── A1 tokens-set ──────────────────────────────────────────────────────────
  const tk = proto.tokens || {};
  const nColors = (tk.colors || []).length;
  const nType = (tk.typography || []).length;
  const nFonts = (tk.fonts || []).length;
  // raw hex used directly in SCREEN bodies (designSystem CSS is allowed hex — that's
  // where tokens live). Hardcoded hex in screens = not using the system.
  const screenRawHex = (allResolved.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  const varUses = (allResolved.match(/var\(--/g) || []).length;
  // Allowance scales with screen count: a few one-off colours per screen (avatar
  // tints, chart series, severity dots) are legitimate and shouldn't read as
  // "ignored the design system". Wholesale hardcoding still fails — and a build with
  // no real token set fails on `tokensDefined` regardless of stray hex.
  const hexAllowance = 4 * Math.max(1, screens.length);
  metrics.tokens = { nColors, nType, nFonts, screenRawHex, varUses, hexAllowance };
  // Split into two behaviours that move independently: (a) a structured token set
  // EXISTS (powers the Design-system tab, compiles to the vars), and (b) screens
  // actually USE it rather than hardcoding hex. Bundling them hid the first win.
  const A1a = nColors >= 4 && (nType >= 2 || nFonts >= 2);
  const A1b = screenRawHex <= hexAllowance;

  // ── A2 shared-layout ─────────────────────────────────────────────────────────
  const layout = typeof proto.layout === "string" ? proto.layout : "";
  const compCount = Object.keys(proto.components || {}).length;
  const compHtml = Object.values(proto.components || {}).join("\n");
  const includeUses = (layout + compHtml + allResolved).match(/\{\{>\s*[\w-]+/g) || [];
  // slot must RESOLVE per screen, the same way resolveScreenHtml does it: the shell is
  // `screen.layout ?? proto.layout`, with components expanded — so a `{{slot}}` that
  // lives INSIDE a component (layout `{{>shell}}` where shell wraps the slot) counts.
  // If the expanded shell has no slot, the screen body is dropped — a real content bug
  // a raw-string check would miss (and that a static "non-empty" check can't catch).
  const dropped = [];
  for (const s of screens) {
    const tpl = s.layout === false || s.layout === "none" ? "{{slot}}" : s.layout ?? proto.layout ?? "{{slot}}";
    const shell = expandFragment(proto, tpl);
    if (!shell.includes("{{slot}}")) dropped.push(s.id);
  }
  // pairwise similarity of authored screen bodies (shared chrome should live in the
  // layout/components, so bodies should NOT look near-identical to each other)
  let maxSim = 0, simPair = null;
  for (let i = 0; i < screens.length; i++)
    for (let j = i + 1; j < screens.length; j++) {
      const sim = similarity(screens[i].html || "", screens[j].html || "");
      if (sim > maxSim) { maxSim = sim; simPair = [screens[i].id, screens[j].id]; }
    }
  metrics.shared = { layout: !!layout, slotResolves: dropped.length === 0, droppedBody: dropped, compCount, includeUses: includeUses.length, maxSim: +maxSim.toFixed(2), simPair };
  const sharedOk = dropped.length === 0 && compCount >= 1 && includeUses.length >= 1;
  const dedupeOk = maxSim < 0.6;
  const A2 = sharedOk && dedupeOk;

  // ── A3 interactivity ──────────────────────────────────────────────────────────
  const navTargets = attrValues(allResolved, "data-to");
  const badNav = [...new Set(navTargets)].filter((t) => t && !ids.has(t));
  // reachability from start over data-to edges
  const start = proto.start && ids.has(proto.start) ? proto.start : (screens[0] && screens[0].id);
  const adj = {};
  for (const s of screens) adj[s.id] = [...new Set(attrValues(resolved[s.id] || "", "data-to"))].filter((t) => ids.has(t));
  const seen = new Set(start ? [start] : []);
  const stack = start ? [start] : [];
  while (stack.length) { const n = stack.pop(); for (const m of adj[n] || []) if (!seen.has(m)) { seen.add(m); stack.push(m); } }
  const unreachable = screens.map((s) => s.id).filter((id) => !seen.has(id));
  // store binds resolve
  const declared = new Set(Object.keys(proto.store || {}));
  const setKeys = attrValues(allResolved, "data-set").flatMap((v) => v.split(";").map((p) => p.split("=")[0].trim())).filter(Boolean);
  const incKeys = attrValues(allResolved, "data-inc").flatMap((v) => v.split(",").map((k) => k.trim())).filter(Boolean);
  const decKeys = attrValues(allResolved, "data-dec").flatMap((v) => v.split(",").map((k) => k.trim())).filter(Boolean);
  const mutated = new Set([...setKeys, ...incKeys, ...decKeys]);
  const bindKeys = [...new Set(attrValues(allResolved, "data-bind"))].filter(Boolean);
  const danglingBinds = bindKeys.filter((k) => !declared.has(k) && !mutated.has(k));
  // wiring coverage vs what the brief expects (reported, soft)
  const present = new Set();
  for (const a of ["data-to", "data-inc", "data-dec", "data-set", "data-bind", "data-show"])
    if (attrValues(allResolved, a).length) present.add(a);
  const wiringCoverage = (brief.expectInteractivity || []).map((a) => ({ a, present: present.has(a) }));
  metrics.interactivity = {
    navCount: navTargets.length, badNav, start, unreachable,
    declaredStore: [...declared], mutated: [...mutated], bindKeys, danglingBinds,
    wiringCoverage,
  };
  const A3 = navTargets.length >= 1 && badNav.length === 0 && unreachable.length === 0 && danglingBinds.length === 0;

  // ── A4 renders-clean (static) ────────────────────────────────────────────────
  const renderIssues = [];
  for (const s of screens) {
    const h = resolved[s.id] || "";
    if (/\{\{[^}]*\}\}/.test(h)) renderIssues.push({ id: s.id, issue: "unexpanded template", sample: (h.match(/\{\{[^}]*\}\}/) || [])[0] });
    if (h.trim().length < 40) renderIssues.push({ id: s.id, issue: "empty/near-empty body" });
    // rough container tag balance
    for (const tag of ["div", "section", "header", "footer", "main", "ul", "button", "nav"]) {
      const open = (h.match(new RegExp(`<${tag}[\\s/>]`, "g")) || []).length;
      const close = (h.match(new RegExp(`</${tag}>`, "g")) || []).length;
      if (Math.abs(open - close) > 1) renderIssues.push({ id: s.id, issue: `tag imbalance <${tag}>`, open, close });
    }
  }
  // blank-prone icons: data-lucide names lucide's core dropped → they paint nothing.
  const blankIcons = [...new Set(attrValues(allResolved, "data-lucide").filter((n) => BLANK_ICONS.has(n)))];
  for (const n of blankIcons) renderIssues.push({ issue: "blank icon (not in lucide set)", name: n });
  metrics.render = { screens: screens.length, minScreens: brief.minScreens, blankIcons, issues: renderIssues };
  const A4 = renderIssues.length === 0 && screens.length >= (brief.minScreens || 1);

  // ── frame / safe-area heuristic (reported, non-gating) ───────────────────────
  // A dark mobile/tablet design with no safeArea and chrome on "floats in white".
  // Reported (not gated) — a light design legitimately needs no safeArea.
  const protoFrame = proto.frame;
  const isDevice = (f) => f === "ios" || f === "android" || f === "ipad";
  const bgTok = (tk.colors || []).find((c) => /^bg$|background/i.test(c.name));
  const bgDark = bgTok ? isDarkColor(bgTok.value) : false;
  const safeAreaMissing = [];
  for (const s of screens) {
    const f = s.frame || protoFrame;
    if (!isDevice(f)) continue;
    const chromeOff = s.chrome === false || proto.chrome === false;
    const hasSafe = (s.safeArea != null && s.safeArea !== "") || (proto.safeArea != null && proto.safeArea !== "");
    if (bgDark && !chromeOff && !hasSafe) safeAreaMissing.push(s.id);
  }
  metrics.frame = { frame: protoFrame || "web", deviceScreens: screens.filter((s) => isDevice(s.frame || protoFrame)).length, bgDark, safeAreaMissing };

  // ── factoring efficiency (matters most for big apps) ─────────────────────────
  // How much markup lives in the SHARED layout+components vs repeated per-screen.
  // A high shared ratio + low cross-screen similarity = the agent factored the chrome
  // instead of pasting it into every screen — the behaviour the granular setters /
  // deep-merge patch encourage, and what keeps a 10+ screen app cheap to edit. (True
  // tool-call/token efficiency needs MCP-call instrumentation — not visible in an
  // artifact, so this is the artifact-side proxy.)
  const sharedBytes = (typeof proto.layout === "string" ? proto.layout.length : 0) + Object.values(proto.components || {}).reduce((n, v) => n + (typeof v === "string" ? v.length : 0), 0);
  const screenBytes = screens.reduce((n, s) => n + (typeof s.html === "string" ? s.html.length : 0), 0);
  metrics.factoring = {
    screens: screens.length,
    sharedBytes,
    screenBytes,
    sharedRatio: sharedBytes + screenBytes ? +(sharedBytes / (sharedBytes + screenBytes)).toFixed(3) : 0,
    maxSim: metrics.shared.maxSim,
  };

  // ── A5 design-review (impeccable detect) ─────────────────────────────────────
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hns-grade-"));
  const tokenCss = compileTokens(proto.tokens);
  for (const s of screens) {
    const doc =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>${tokenCss}\n${sheet}</style></head><body>${resolved[s.id] || ""}</body></html>`;
    fs.writeFileSync(path.join(tmp, sanitize(s.id) + ".html"), doc);
  }
  let findings = [], detectOk = true, detectNote = null;
  try {
    const res = spawnSync("node", [DETECT, "--json", tmp], { encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    const out = (res.stdout || "").trim();
    if (out) findings = JSON.parse(out);
    else { detectOk = false; detectNote = (res.stderr || `exit ${res.status}`).slice(0, 200); }
  } catch (e) { detectOk = false; detectNote = String(e.message || e).slice(0, 200); }
  fs.rmSync(tmp, { recursive: true, force: true });
  const byId = {};
  for (const f of findings) byId[f.antipattern] = (byId[f.antipattern] || 0) + 1;
  const serious = findings.filter((f) => SERIOUS.has(f.antipattern));
  metrics.designReview = { available: detectOk, note: detectNote, total: findings.length, byId, serious: serious.map((f) => ({ id: f.antipattern, file: path.basename(f.file || ""), line: f.line, snippet: f.snippet })) };
  const A5 = detectOk && serious.length === 0;

  const checks = { A1a_tokens_defined: A1a, A1b_tokens_used: A1b, A2_shared: A2, A3_interactivity: A3, A4_render: A4, A5_design: A5 };
  const n = Object.keys(checks).length;
  const passed = Object.values(checks).filter(Boolean).length;
  return { brief: briefId, split: brief.split, score: passed / n, passed, nChecks: n, checks, metrics };
}

// ── CLI ────────────────────────────────────────────────────────────────────────
// Only when run directly (not when imported by gate.mjs / a runner).
if (import.meta.main) {
  const args = process.argv.slice(2);
  const get = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const briefId = get("--brief");
  const dir = get("--dir");
  if (!briefId || !dir) {
    console.error("usage: bun evals/grade.mjs --brief <id> --dir <.harness dir>");
    process.exit(2);
  }
  const result = grade(briefId, path.resolve(dir));
  console.log(JSON.stringify(result, null, 2));
}
