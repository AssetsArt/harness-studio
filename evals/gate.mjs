#!/usr/bin/env bun
// Regression gate for the arta eval. ONE deterministic command:
// grades the COMMITTED artifacts (the shipping .arta/ demo + a deliberately-bad
// fixture) against evals/thresholds.json and exits non-zero on any regression.
// No LLM, no network — safe to run in CI on every push that touches the skill/MCP.
//
//   bun evals/gate.mjs                       # gate the committed targets (CI core)
//   bun evals/gate.mjs --json                # same, machine-readable
//   bun evals/gate.mjs --suite <built-dir>   # grade an LLM-built brief tree (loop arm):
//                                            #   <built-dir>/<briefId>/.arta per brief
//
// A5 (impeccable detect) is enforced only when the detector exists on this machine;
// on a CI runner without ~/.claude/skills/impeccable it is reported as skipped (–),
// never a failure — so A1-A4 are the deterministic CI floor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";
import { grade } from "./grade.mjs";
import { compileTokens } from "../src/lib/prototype.ts";
import { ThemeProvider } from "../src/lib/theme.tsx";
import { SpecRail } from "../src/components/tabs/SpecRail.tsx";
import { resolveActive } from "../src/lib/useArta.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKS = ["A1a_tokens_defined", "A1b_tokens_used", "A2_shared", "A3_interactivity", "A4_render", "A5_design"];
const SHORT = { A1a_tokens_defined: "A1a", A1b_tokens_used: "A1b", A2_shared: "A2", A3_interactivity: "A3", A4_render: "A4", A5_design: "A5" };
const GLYPH = { pass: "✓", fail: "✗", skip: "–", off: "·" };
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/thresholds.json"), "utf8"));
const BRIEFS = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/briefs.json"), "utf8")).briefs;

const a5Up = (r) => r?.metrics?.designReview?.available === true;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

// ── Unit specs: render-layer invariants the grader can't see in artifacts ────
// Guards the snapshot↔live font-parity fix: the preloaded display/text faces are
// Latin-only, so compileTokens must pin a Noto Thai face INTO every --font-* chain.
// Without it, non-Latin text falls to a generic system fallback that resolves to
// different faces in the live iframe vs. the parent-context snapshot — the dev and
// the agent then see different glyph widths (text wraps/overlaps in the snapshot
// only). Real regression observed in a Gemini-built prototype; locked in here.
function runSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const css = (fonts) => compileTokens({ fonts });

  const body = css([{ name: "body", value: "'Geist', system-ui, sans-serif" }]);
  spec("body chain pins Noto Sans Thai", /--font-body:[^;]*'Noto Sans Thai'/.test(body), body.match(/--font-body:[^;]*/)?.[0]);
  spec("Thai face precedes the generic fallback", /'Noto Sans Thai',\s*system-ui/.test(body), body.match(/--font-body:[^;]*/)?.[0]);

  const serif = css([{ name: "display", value: "'Instrument Serif', Georgia, serif" }]);
  spec("serif chain pins Noto Serif Thai (not Sans)", /'Noto Serif Thai'/.test(serif) && !/'Noto Sans Thai'/.test(serif), serif.match(/--font-display:[^;]*/)?.[0]);

  const mono = css([{ name: "mono", value: "'Geist Mono', ui-monospace, monospace" }]);
  spec("mono chain still gets a Thai face", /'Noto (Sans|Serif) Thai'/.test(mono), mono.match(/--font-mono:[^;]*/)?.[0]);

  const already = css([{ name: "x", value: "'Fraunces', 'Noto Serif Thai', serif" }]);
  spec("idempotent — no double-inject when already pinned", (already.match(/Noto Serif Thai/g) || []).length === 1, already.match(/--font-x:[^;]*/)?.[0]);

  return { ok: rows.every((r) => r.ok), rows };
}

// ── Render-layer spec: SpecRail must survive object-shaped data ──────────────
// The AI writes .arta/state.json freely, so a spec array item can arrive as an
// OBJECT (e.g. a user as { name, need }) instead of a string. Before the guard,
// SpecRail passed that object straight to JSX → React threw "Objects are not valid
// as a React child" and, with no error boundary, took down the WHOLE viewer (blank
// screen). Real regression observed in a Carfe (queue-SaaS) build. Locked in here:
// the rail renders the richer shape, never crashes, and never leaks "[object Object]".
function runSpecRailSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const badSpec = {
    goal: "queue system",
    users: [{ name: "Host", need: "call the next ticket" }, "Walk-in customer"],
    userStories: ["As a host, I want to call the next queue", { broken: "object" }],
    scope: { in: ["Live board"], out: ["Billing"] },
    constraints: ["readable at distance", { broken: "object" }],
  };
  let html = "";
  try {
    html = renderToString(h(ThemeProvider, null, h(SpecRail, { spec: badSpec, open: true, onToggle: () => {} })));
    spec("renders object-shaped spec without throwing", html.length > 0);
  } catch (e) {
    spec("renders object-shaped spec without throwing", false, e?.message);
  }
  spec("object user renders its name", html.includes("Host"));
  spec("object user renders its need", html.includes("call the next ticket"));
  spec("string user still renders", html.includes("Walk-in customer"));
  spec("no raw [object Object] leaks into markup", html.length > 0 && !html.includes("[object Object]"));
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Render-layer spec: the device frame fills to the bottom edge ─────────────
// A screen whose content is shorter than the device viewport must still paint to
// the bottom — otherwise the body shows through as a dead WHITE band below the
// content (the #1 recurring prototype defect; the AI fixes it inconsistently, so the
// frame must enforce it). FreeformDevice's BASE_CSS guarantees it two ways: a full
// height chain (so min-h-full/h-full roots actually fill) and a page-coloured body
// background (so any gap is the design's bg, never raw white). Lock both in — a
// revert silently brings the white band back. Verified live in a browser; here we
// just guard that the enforcing rules stay present (whitespace-insensitive).
function runFrameSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const src = fs.readFileSync(path.join(ROOT, "src/components/proto/FreeformDevice.tsx"), "utf8").replace(/\s+/g, "");
  spec("frame establishes a full height chain (html,body height:100%)", /html,body\{[^}]*height:100%/.test(src), "html,body height:100%");
  spec("body background defaults to the page colour, not white", src.includes("background:var(--color-bg,#fff)"), "body background:var(--color-bg,#fff)");
  // A stray <a href> in a srcdoc frame would load the viewer into itself (nested Arta);
  // the runtime must intercept href clicks and inject the screen list to recover them.
  spec("runtime intercepts raw <a href> navigation", src.includes("closest('a[href]')") && src.includes("functionwarnHref"), "a[href] interceptor + warnHref");
  spec("screen list injected so href can resolve to a real screen", src.includes("window.__SCREENS__"), "__SCREENS__");
  // Full-length snapshot must capture screens that scroll inside an INNER overflow region
  // (the fixed-height shell: header + scroll-body + tabbar), not just document-level
  // scroll. Before the fix, `full` fell back to the framed shot for those (documentElement
  // didn't scroll). The capture finds real scroll regions and unclamps them to natural
  // height, then restores — lock that mechanism in (whitespace-insensitive).
  spec("full snapshot detects inner scroll regions", src.includes("el.scrollHeight>el.clientHeight+4"), "scroll-region detection");
  spec("full snapshot unclamps to natural height then restores", src.includes('height:"auto"') && src.includes("saved.push"), "unclamp + restore");
  // A screen's own `absolute/fixed bottom-0` tabbar must re-root to the full document, not
  // the viewport — else it lands mid-image and whites out content. The capture makes <html>
  // a position:relative containing block and converts fixed bars to absolute.
  spec("full snapshot re-roots viewport-anchored bars to full doc", src.includes('position:"relative"') && src.includes('position:"absolute"'), "fixed/absolute bar re-root");
  // The rich-screen kit must stay shipped in BASE_CSS: a horizontal rail (peek/snap, no
  // scrollbar) and a gradient cover (so an image slot is never a bare gray box).
  spec("BASE_CSS ships the horizontal rail primitive (.hs-rail)", src.includes(".hs-rail{"), ".hs-rail");
  spec("BASE_CSS ships a gradient cover, not a gray box (.hs-cover)", src.includes(".hs-cover{") && src.includes("linear-gradient"), ".hs-cover gradient");
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Multi-project spec: which canvas the one viewer shows ────────────────────
// One viewer (one port) can host several projects; the active one is remembered in
// localStorage. The agreed rule: use the stored project if it still exists, else fall
// back to the FIRST project — never a blank canvas. Lock that resolution.
function runProjectSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const list = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  spec("stored project that exists is honoured", resolveActive(list, "b") === "b", `→ ${resolveActive(list, "b")}`);
  spec("unknown stored project falls back to the first", resolveActive(list, "zzz") === "a", `→ ${resolveActive(list, "zzz")}`);
  spec("no stored project falls back to the first", resolveActive(list, null) === "a", `→ ${resolveActive(list, null)}`);
  spec("empty project list resolves to nothing (no crash)", resolveActive([], "x") === "", `→ "${resolveActive([], "x")}"`);
  return { ok: rows.every((r) => r.ok), rows };
}

// ── CI core: gate the committed targets ─────────────────────────────────────
function runGate(json) {
  const rows = [];
  const a5Skipped = new Set();
  let regressed = false;
  const specs = runSpecs();
  if (!specs.ok) regressed = true;
  const railSpecs = runSpecRailSpecs();
  if (!railSpecs.ok) regressed = true;
  const frameSpecs = runFrameSpecs();
  if (!frameSpecs.ok) regressed = true;
  const projectSpecs = runProjectSpecs();
  if (!projectSpecs.ok) regressed = true;

  for (const t of TH.targets) {
    const r = grade(t.brief, path.join(ROOT, t.dir));
    const checks = r.checks || {};
    const detectorUp = a5Up(r);
    const cells = {};
    const fails = [];

    if (r.fatal) {
      regressed = true;
      rows.push({ id: t.id, kind: t.kind, score: 0, cells: {}, ok: false, fails: [`fatal: ${r.fatal}`] });
      continue;
    }

    if (t.kind === "ship") {
      for (const c of CHECKS) {
        const required = t.require?.[c] === true;
        const got = checks[c] === true;
        if (c === "A5_design" && required && !detectorUp) { cells[c] = "skip"; a5Skipped.add(t.id); continue; }
        if (!required) { cells[c] = got ? "pass" : "off"; continue; }
        cells[c] = got ? "pass" : "fail";
        if (!got) fails.push(SHORT[c]);
      }
    } else {
      // guard: must STAY failing (proves the grader still discriminates)
      for (const c of CHECKS) cells[c] = checks[c] === true ? "pass" : "fail";
      if (r.score > (t.maxScore ?? 1)) fails.push(`score ${r.score.toFixed(2)} > ${t.maxScore}`);
      for (const c of t.mustFail || []) {
        if (c === "A5_design" && !detectorUp) { cells[c] = "skip"; a5Skipped.add(t.id); continue; }
        if (checks[c] === true) fails.push(`${SHORT[c]} unexpectedly passed`);
      }
    }

    const ok = fails.length === 0;
    if (!ok) regressed = true;
    rows.push({ id: t.id, kind: t.kind, score: r.score, cells, ok, fails });
  }

  if (json) {
    console.log(JSON.stringify({ mode: "gate", ok: !regressed, a5Skipped: [...a5Skipped], rows, specs: specs.rows, railSpecs: railSpecs.rows, frameSpecs: frameSpecs.rows, projectSpecs: projectSpecs.rows }, null, 2));
    return !regressed;
  }

  console.log("\n  REGRESSION GATE — committed targets (deterministic, no LLM)\n");
  const head = "  " + pad("target", 14) + CHECKS.map((c) => padL(SHORT[c], 5)).join("") + "    score  verdict";
  console.log(head);
  console.log("  " + "─".repeat(head.length - 2));
  for (const r of rows) {
    const cells = CHECKS.map((c) => padL(GLYPH[r.cells[c]] || "?", 5)).join("");
    const verdict = r.ok ? "PASS" : "REGRESS";
    console.log("  " + pad(r.id, 14) + cells + "    " + padL(r.score.toFixed(2), 5) + "  " + verdict + (r.fails.length ? `  (${r.fails.join("; ")})` : ""));
  }
  console.log("\n  legend: ✓ pass   ✗ fail   – skipped (detector n/a)   · not required");
  if (a5Skipped.size) console.log(`  note: A5 (impeccable detect) skipped for ${[...a5Skipped].join(", ")} — detector not on this machine (expected in CI).`);

  console.log("\n  RENDER-LAYER SPECS — font parity (snapshot ↔ live)\n");
  for (const s of specs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 44) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  RENDER-LAYER SPECS — spec rail tolerates object-shaped data\n");
  for (const s of railSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 44) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  RENDER-LAYER SPECS — device frame: fills, blocks stray <a href> nav, full snapshot + rich-screen kit\n");
  for (const s of frameSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 60) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  RENDER-LAYER SPECS — multi-project: which canvas the viewer shows\n");
  for (const s of projectSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 52) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  " + (regressed ? "GATE FAILED — a committed target or render-layer spec regressed." : "GATE PASSED — all committed targets hold the baseline.") + "\n");
  return !regressed;
}

// ── Loop arm: grade an LLM-built brief tree (<dir>/<briefId>/.arta) ───────
function runSuite(dir, json) {
  const base = path.resolve(dir);
  const rows = [];
  for (const b of BRIEFS) {
    if (b.split === "ship") continue;
    const hdir = path.join(base, b.id, ".arta");
    if (!fs.existsSync(path.join(hdir, "state.json"))) { rows.push({ id: b.id, split: b.split, missing: true }); continue; }
    const r = grade(b.id, hdir);
    rows.push({ id: b.id, split: b.split, score: r.score, checks: r.checks, detector: a5Up(r), kit: b.designKit || null });
  }
  const built = rows.filter((x) => !x.missing);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x.score, 0) / a.length : 0);
  const train = built.filter((x) => x.split === "train");
  const held = built.filter((x) => x.split === "heldout");
  const summary = {
    built: built.length, missing: rows.length - built.length,
    meanAll: +mean(built).toFixed(3), meanTrain: +mean(train).toFixed(3), meanHeldout: +mean(held).toFixed(3),
    worst: built.length ? +Math.min(...built.map((x) => x.score)).toFixed(3) : 0,
  };
  const f = TH.suite;
  const ok = built.length > 0 && summary.meanAll >= f.meanFloor && summary.worst >= f.worstFloor && summary.meanHeldout >= f.heldoutMeanFloor;

  if (json) { console.log(JSON.stringify({ mode: "suite", dir: base, ok, floors: f, summary, rows }, null, 2)); return ok; }

  console.log(`\n  SUITE — graded build tree: ${path.relative(ROOT, base) || base}\n`);
  const head = "  " + pad("brief", 18) + pad("split", 9) + CHECKS.map((c) => padL(SHORT[c], 5)).join("") + "    score";
  console.log(head);
  console.log("  " + "─".repeat(head.length - 2));
  for (const r of rows) {
    if (r.missing) { console.log("  " + pad(r.id, 18) + pad(r.split, 9) + "  (not built)"); continue; }
    const cells = CHECKS.map((c) => padL(r.checks[c] ? "✓" : (c === "A5_design" && !r.detector ? "–" : "✗"), 5)).join("");
    console.log("  " + pad(r.id, 18) + pad(r.split, 9) + cells + "    " + padL(r.score.toFixed(2), 5));
  }
  console.log(`\n  mean ${summary.meanAll}  (train ${summary.meanTrain} · heldout ${summary.meanHeldout})   worst ${summary.worst}   built ${summary.built}/${summary.built + summary.missing}`);
  console.log(`  floors: mean ≥ ${f.meanFloor} · heldout ≥ ${f.heldoutMeanFloor} · worst ≥ ${f.worstFloor}`);
  console.log("\n  " + (ok ? "SUITE PASSED" : "SUITE BELOW FLOOR") + "\n");
  return ok;
}

// ── Parity: same skeleton, one kit each — measure worst-of-5, not the mean ───
function runParity(dir, json) {
  const base = path.resolve(dir);
  const rows = [];
  for (const b of BRIEFS) {
    if (b.split !== "parity") continue;
    const hdir = path.join(base, b.id, ".arta");
    if (!fs.existsSync(path.join(hdir, "state.json"))) { rows.push({ id: b.id, kit: b.designKit, missing: true }); continue; }
    const r = grade(b.id, hdir);
    if (r.fatal) { rows.push({ id: b.id, kit: b.designKit, fatal: r.fatal, score: 0, checks: {}, detector: false, serious: [] }); continue; }
    const a5 = r.metrics?.designReview;
    rows.push({ id: b.id, kit: b.designKit, score: r.score, checks: r.checks, detector: a5Up(r), serious: (a5?.serious || []).map((s) => s.id) });
  }
  const built = rows.filter((x) => !x.missing);
  const scores = built.map((x) => x.score);
  const worst = scores.length ? +Math.min(...scores).toFixed(3) : 0;
  const best = scores.length ? +Math.max(...scores).toFixed(3) : 0;
  const mean = scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(3) : 0;
  const spread = +(best - worst).toFixed(3);
  const f = TH.suite;
  const ok = built.length > 0 && worst >= f.worstFloor;

  if (json) { console.log(JSON.stringify({ mode: "parity", dir: base, ok, worstFloor: f.worstFloor, summary: { worst, best, mean, spread, built: built.length }, rows }, null, 2)); return ok; }

  console.log(`\n  PARITY — one brief skeleton, one design language each: ${path.relative(ROOT, base) || base}\n`);
  const head = "  " + pad("kit", 11) + CHECKS.map((c) => padL(SHORT[c], 5)).join("") + "    score   A5 findings";
  console.log(head);
  console.log("  " + "─".repeat(head.length + 6));
  for (const r of rows) {
    if (r.missing) { console.log("  " + pad(r.kit || r.id, 11) + "  (not built)"); continue; }
    if (r.fatal) { console.log("  " + pad(r.kit, 11) + "  FATAL: " + r.fatal); continue; }
    const cells = CHECKS.map((c) => padL(r.checks[c] ? "✓" : (c === "A5_design" && !r.detector ? "–" : "✗"), 5)).join("");
    console.log("  " + pad(r.kit, 11) + cells + "    " + padL(r.score.toFixed(2), 5) + "   " + (r.serious.length ? r.serious.join(",") : (r.detector ? "clean" : "—")));
  }
  console.log(`\n  worst ${worst}   best ${best}   mean ${mean}   spread ${spread}   (floor: worst ≥ ${f.worstFloor})`);
  console.log("\n  " + (ok ? "PARITY OK — weakest language holds the floor." : "PARITY BELOW FLOOR — a language lags.") + "\n");
  return ok;
}

// ── Handoff completeness: is the design buildable by a subagent? ─────────────
// The grader's A1-A5 only inspect the prototype. But subagent-driven-development reads
// spec/dataModel/api too — so a "designed" canvas that's missing them can't be built.
// This scores those structured sections deterministically (no LLM).
function gradeHandoff(state) {
  const checks = [];
  const add = (id, ok, note) => checks.push({ id, ok: !!ok, note });
  const spec = state.spec || {};
  add("spec.goal", typeof spec.goal === "string" && spec.goal.trim().length > 8, "one-sentence goal");
  add("spec.users", Array.isArray(spec.users) && spec.users.length >= 1, "≥1 user");
  add("spec.userStories", Array.isArray(spec.userStories) && spec.userStories.length >= 1, "≥1 story");
  add("spec.scope", spec.scope && (Array.isArray(spec.scope.in) && spec.scope.in.length >= 1), "scope.in");
  add("spec.constraints", Array.isArray(spec.constraints) && spec.constraints.length >= 1, "≥1 constraint");

  const dm = state.dataModel || {};
  const entities = Array.isArray(dm.entities) ? dm.entities : [];
  add("data.entities", entities.length >= 1, "≥1 entity");
  add("data.fields", entities.length >= 1 && entities.every((e) => Array.isArray(e.fields) && e.fields.length >= 1), "every entity has fields");
  add("data.pk", entities.some((e) => (e.fields || []).some((f) => f.pk)), "≥1 primary key");
  add("data.relationships", Array.isArray(dm.relationships) && dm.relationships.length >= 1, "≥1 relationship");

  const api = state.api || {};
  const paths = api.paths && typeof api.paths === "object" ? api.paths : {};
  const ops = Object.values(paths).flatMap((p) => Object.entries(p).filter(([m]) => ["get", "post", "put", "patch", "delete"].includes(m)).map(([, o]) => o));
  const screenIds = new Set((state.prototype?.screens || []).map((s) => s.id));
  const xScreens = ops.flatMap((o) => o["x-screens"] || []);
  add("api.paths", Object.keys(paths).length >= 1, "≥1 route");
  add("api.responses", ops.length >= 1 && ops.every((o) => o.responses && Object.keys(o.responses).length >= 1), "every op has responses");
  add("api.xScreens", xScreens.length >= 1 && xScreens.every((id) => screenIds.has(id)), "x-screens tie routes to real screens");

  const passed = checks.filter((c) => c.ok).length;
  return { score: +(passed / checks.length).toFixed(3), passed, total: checks.length, checks, missing: checks.filter((c) => !c.ok).map((c) => c.id) };
}

function runHandoff(dir, json) {
  const state = JSON.parse(fs.readFileSync(path.join(path.resolve(dir), "state.json"), "utf8"));
  const r = gradeHandoff(state);
  if (json) { console.log(JSON.stringify({ mode: "handoff", dir, ...r }, null, 2)); return r.score >= (TH.handoff?.floor ?? 0.8); }
  console.log(`\n  HANDOFF COMPLETENESS — can a subagent build from this canvas? ${path.relative(ROOT, path.resolve(dir)) || dir}\n`);
  const groups = { spec: [], data: [], api: [] };
  for (const c of r.checks) groups[c.id.split(".")[0]].push(c);
  for (const [g, cs] of Object.entries(groups)) {
    console.log("  " + pad(g, 6) + cs.map((c) => `${c.ok ? "✓" : "✗"} ${c.id.split(".")[1]}`).join("   "));
  }
  const floor = TH.handoff?.floor ?? 0.8;
  const ok = r.score >= floor;
  console.log(`\n  ${r.passed}/${r.total} complete  (score ${r.score}, floor ${floor})` + (r.missing.length ? `  missing: ${r.missing.join(", ")}` : ""));
  console.log("\n  " + (ok ? "HANDOFF READY" : "HANDOFF INCOMPLETE — fill the missing sections before 'design approved'.") + "\n");
  return ok;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const json = args.includes("--json");
const si = args.indexOf("--suite");
const pi = args.indexOf("--parity");
const hi = args.indexOf("--handoff");
const ok =
  hi >= 0 ? runHandoff(args[hi + 1], json)
  : pi >= 0 ? runParity(args[pi + 1], json)
  : si >= 0 ? runSuite(args[si + 1], json)
  : runGate(json);
process.exit(ok ? 0 : 1);
