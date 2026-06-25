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
// A5 (design review) runs Arta's OWN in-process slop detector (mcp/slop-detect.mjs) — no
// `npx`, no network, no install — so it's a real deterministic CI floor alongside A1-A4,
// not skipped. (The legacy a5Skipped path stays as a defensive no-op.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";
import { grade } from "./grade.mjs";
import { compileTokens, tokensFromCss, darkVars, resolveScreenHtml } from "../src/lib/prototype.ts";
import { buildPrototypePreview } from "../src/lib/previewDoc.ts";
import { ThemeProvider } from "../src/lib/theme.tsx";
import { SpecRail } from "../src/components/tabs/SpecRail.tsx";
import { DesignSystemView } from "../src/components/tabs/DesignSystemView.tsx";
import { resolveActive } from "../src/lib/useArta.ts";
import { detectSlop } from "../mcp/slop-detect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKS = ["A1a_tokens_defined", "A1b_tokens_used", "A2_shared", "A3_interactivity", "A4_render", "A5_design"];
const SHORT = { A1a_tokens_defined: "A1a", A1b_tokens_used: "A1b", A2_shared: "A2", A3_interactivity: "A3", A4_render: "A4", A5_design: "A5" };
const GLYPH = { pass: "✓", fail: "✗", skip: "–", off: "·" };
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/thresholds.json"), "utf8"));
const BRIEFS_DOC = JSON.parse(fs.readFileSync(path.join(ROOT, "evals/briefs.json"), "utf8"));
const BRIEFS = BRIEFS_DOC.briefs;
// The serious-tier ids live on the document, NOT the briefs array — reading them off
// BRIEFS (the array) silently yields `undefined`, which made `SERIOUS` an EMPTY set and
// quietly defanged every slop-spec that consults it (they passed vacuously). Pin to the doc.
const SERIOUS_IDS = BRIEFS_DOC.serious_antipatterns;

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

// ── Render-layer spec: the Design-system tab reflects a CSS-authored system ──
// The tab reads structured `prototype.tokens`, but the AI often authors the system as raw
// CSS (arta_set_design_system) with a `:root` block and never calls arta_set_design_tokens
// — which left the tab showing "No design system yet" despite a real system on every screen
// (a real defect a dev hit). The fix recovers tokens from the CSS `:root` vars and, failing
// that, shows the stylesheet itself. Lock both: a CSS-only system is never a blank tab.
function runDesignSystemSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const render = (proto) => renderToString(h(ThemeProvider, null, h(DesignSystemView, { prototype: proto })));

  // tokensFromCss recovers tokens from a :root block (the inverse of compileTokens).
  const parsed = tokensFromCss(":root{--color-bg:#fbfaf8;--color-accent:#b3321a;--font-display:'Fraunces',serif;--radius-md:10px}");
  spec("tokensFromCss recovers colours from :root", (parsed.colors || []).some((x) => x.value === "#b3321a"), (parsed.colors || []).map((x) => x.name).join(","));
  spec("tokensFromCss recovers fonts + radii from :root", (parsed.fonts || []).length === 1 && (parsed.radii || []).length === 1);
  spec("tokensFromCss ignores non-:root rules", tokensFromCss(".card{color:red}").colors === undefined);

  // CSS-authored system (no structured tokens) → tab shows the colours, not the empty state.
  const cssOnly = render({ designSystem: ":root{--color-accent:#b3321a;--color-bg:#fbfaf8}", screens: [] });
  spec("CSS-only system renders its tokens (not the empty state)", cssOnly.includes("#b3321a") && !cssOnly.includes("No design system yet"));

  // CSS with no :root vars (class rules only) → the stylesheet itself is shown, not blank.
  const classOnly = render({ designSystem: ".btn{background:#111;color:#fff}", screens: [] });
  spec("class-only system falls back to showing the stylesheet", classOnly.includes("Stylesheet") && !classOnly.includes("No design system yet"));

  // Genuinely nothing → the empty state is correct.
  const nothing = render({ screens: [] });
  spec("truly-empty prototype still shows the empty state", nothing.includes("No design system yet"));

  // Theme support: darkVars recovers the prototype's `.dark{}` token overrides, and the tab
  // offers a light/dark preview toggle ONLY when the system actually has a dark theme (a
  // `.dark{}` block or a component using `dark:`) — a light-only system shows no toggle.
  const dvBasic = darkVars(":root{--color-bg:#fff}.dark{--color-bg:#0b0b0c;--color-fg:#fafafa}");
  spec("darkVars recovers .dark{} token overrides", dvBasic["color-bg"] === "#0b0b0c" && dvBasic["color-fg"] === "#fafafa");
  spec("darkVars is empty for a light-only system", Object.keys(darkVars(":root{--color-bg:#fff}")).length === 0);
  const withDark = render({ designSystem: ":root{--color-accent:#b3321a}.dark{--color-accent:#f0a}", screens: [] });
  spec("tab shows a theme toggle when the system has a dark theme", withDark.includes(">Theme<"));
  const lightOnly = render({ designSystem: ":root{--color-accent:#b3321a}", screens: [] });
  spec("tab hides the theme toggle for a light-only system", !lightOnly.includes(">Theme<"));

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
  // BASE_CSS / the rich-screen kit / buildScreenDoc now live in the Node-safe shared module.
  const doc = fs.readFileSync(path.join(ROOT, "src/lib/screenDoc.ts"), "utf8").replace(/\s+/g, "");
  spec("frame establishes a full height chain (html,body height:100%)", /html,body\{[^}]*height:100%/.test(doc), "html,body height:100%");
  spec("body background defaults to the page colour, not white", doc.includes("background:var(--color-bg,#fff)"), "body background:var(--color-bg,#fff)");
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
  spec("BASE_CSS ships the horizontal rail primitive (.hs-rail)", doc.includes(".hs-rail{"), ".hs-rail");
  spec("BASE_CSS ships a gradient cover, not a gray box (.hs-cover)", doc.includes(".hs-cover{") && doc.includes("linear-gradient"), ".hs-cover gradient");
  // hallmark-derived enforced floors: a screen can't ship a sideways scrollbar (gate 34,
  // `clip` not `hidden` so sticky/fixed survive), a display heading can't overflow on a
  // long compound word (gate 51), and every control has an instant keyboard-focus ring
  // even when the AI forgot one (gate 26). Locked here — a revert silently re-opens them.
  spec("BASE_CSS clips horizontal overflow (no sideways scroll)", doc.includes("html,body{overflow-x:clip}"), "overflow-x:clip");
  spec("BASE_CSS lets long heading words wrap (no viewport overflow)", doc.includes("h1,h2,h3{overflow-wrap:anywhere}"), "overflow-wrap:anywhere");
  spec("BASE_CSS gives every control a focus-visible ring fallback", doc.includes(":focus-visible{outline"), ":focus-visible ring");
  // Body text colour is token-driven so a `.dark{--color-fg:…}` block (or any theme) swaps it
  // along with the bg — not a hardcoded near-black that stays dark on a dark background.
  spec("BASE_CSS body colour is token-driven (theme/dark can swap it)", doc.includes("color:var(--color-fg,#18181b)"), "color:var(--color-fg)");
  // The shared screen document is built ONE way (live iframe + PDF + headless all use it).
  spec("buildScreenDoc assembles the standalone screen (shared render)", doc.includes("functionbuildScreenDoc"), "buildScreenDoc");
  // modern-screenshot can't render backdrop-filter (frosted glass), so a `bg-white/90
  // backdrop-blur` bar smears the content behind it. The capture neutralizes it (blur off +
  // opaque bg) so bars render solid. Lock the helper in for both the framed and full shots.
  spec("snapshot neutralizes backdrop-filter (no frosted-glass smear)", src.includes("neutralizeBackdropBlur") && src.includes('backdropFilter="none"'), "backdrop-blur neutralize");

  // White-screen regression (hit in a real project that shipped `layout: ""`): resolveScreenHtml
  // wrapped every screen in an EMPTY layout shell — `??` keeps `""` (not nullish), so the body
  // was dropped and the screen rendered blank. A blank layout (at screen OR proto level) must
  // be treated as "no layout" → the body renders. And a malformed layout with no {{slot}} must
  // fall back to the body, never a blank page.
  const scr = { id: "s", title: "S", html: "<h1>HELLO-BODY</h1>" };
  spec("empty proto.layout still renders the screen body (not blank)", resolveScreenHtml({ layout: "", components: {} }, scr).includes("HELLO-BODY"));
  spec("empty screen.layout still renders the screen body (not blank)", resolveScreenHtml({}, { ...scr, layout: "   " }).includes("HELLO-BODY"));
  spec("a layout with no {{slot}} falls back to the body (never blank)", resolveScreenHtml({ layout: "<div>chrome</div>" }, scr).includes("HELLO-BODY"));
  spec("a real layout still wraps the body in its {{slot}}", (() => { const r = resolveScreenHtml({ layout: "<main>{{slot}}</main>" }, scr); return r.includes("<main>") && r.includes("HELLO-BODY"); })());
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Render-layer spec: the full-screenshot → PDF export ──────────────────────
// The viewer exports every freeform screen's FULL-length screenshot as one PDF (a page per
// screen) for the dev to save. It must reuse captureFullPng — the same helper the live loop
// uses — with `always` (capture every screen, even ones that already fit), so the export
// carries the same fixes (inner-scroll length, bars dropped to the true bottom). Lock the wiring.
function runExportSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const exp = fs.readFileSync(path.join(ROOT, "src/lib/exportPdf.ts"), "utf8");
  const tab = fs.readFileSync(path.join(ROOT, "src/components/tabs/PrototypeTab.tsx"), "utf8");
  spec("export reuses captureFullPng (shared with the live shot) with always", exp.includes("captureFullPng") && exp.includes("always: true"), "always:true");
  spec("export renders each screen offscreen at its device width", exp.includes("FRAME_W") && exp.includes("srcdoc"), "offscreen iframe");
  spec("export returns a PDF blob for the in-app modal (no auto-open)", exp.includes("jsPDF") && exp.includes('output("bloburl")') && !exp.includes("window.open"), "blob URL, not auto-opened");
  spec("Prototype tab wires the Export PDF button + result modal", tab.includes("exportPrototypePdf") && tab.includes("runExport") && tab.includes("pdfResult") && tab.includes('target="_blank"'), "button + modal w/ Open");
  // The prototype preview surfaces: an "Open preview" button (live /preview, via previewHref) — the
  // light/airy redesign moved this into the top bar — and an "Export prototype HTML" download
  // (client-side buildPrototypePreview) still in the prototype tab. Lock both halves of the wiring.
  const bar = fs.readFileSync(path.join(ROOT, "src/components/Topbar.tsx"), "utf8");
  spec("Top bar wires Open preview (live /preview)", bar.includes("openPreview") && bar.includes("previewHref"), "topbar preview");
  spec("Prototype tab wires Export HTML (self-contained prototype)", tab.includes("buildPrototypePreview") && tab.includes("exportHtml"), "export html");
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Headless-Chrome snapshot: the render IS the browser, not a re-serialisation ──
// The agent's screenshot is a REAL headless-Chrome render — pixel-identical to the dev's
// browser, ending the per-CSS-feature drift (fonts, backdrop-filter, …) a DOM→canvas
// serializer needs patched case by case. The dev server renders + captures; the MCP triggers a
// fresh capture before reading; modern-screenshot stays as the fallback when no Chrome exists.
function runHeadlessSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const hs = fs.readFileSync(path.join(ROOT, "vite/headless-snapshot.ts"), "utf8");
  const plugin = fs.readFileSync(path.join(ROOT, "vite/arta-watch.ts"), "utf8");
  const mcp = fs.readFileSync(path.join(ROOT, "mcp/server.mjs"), "utf8");
  spec("headless reuses the dev's installed Chrome (no 300MB download)", hs.includes("findChrome") && hs.includes("puppeteer-core") && hs.includes("executablePath"), "findChrome + puppeteer-core");
  spec("headless full shot unclamps inner scroll, then fullPage", hs.includes("UNCLAMP_IN_PAGE") && hs.includes("fullPage"), "unclamp + fullPage");
  spec("dev server serves /__arta/render + /__arta/capture", plugin.includes('"/__arta/render"') && plugin.includes('"/__arta/capture"') && plugin.includes("snapshotWithChrome"), "render + capture routes");
  spec("MCP triggers a fresh Chrome capture before reading the shot", mcp.includes("/__arta/capture") && mcp.includes("lastViewerPort"), "capture trigger");
  spec("arta_get_screenshot lets the caller pick the engine (chrome | client)", mcp.includes('["chrome", "client"]') && mcp.includes('engine !== "client"'), "engine param");
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Slop detector: the offline anti-slop engine behind A5 + arta_design_review ──
// mcp/slop-detect.mjs is now BOTH the live craft eye (arta_design_review) and the
// A5 grader — replacing the external `npx impeccable`, so A5 is a real CI floor
// instead of skipped when impeccable isn't installed. These specs lock the
// detector's discrimination: the serious-tier gates fire on the canonical tells and
// the warn gates surface the softer ones, while a clean snippet stays silent AND
// emits nothing in the serious set (a false positive there would red the demo).
function runSlopDetectorSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const SERIOUS = new Set(SERIOUS_IDS);
  const ids = (doc) => detectSlop(doc).map((f) => f.antipattern);
  const has = (doc, id) => ids(doc).includes(id);

  // Serious-tier gates (id ∈ serious set → these GATE A5).
  spec("flags gradient-text (Tailwind bg-clip-text + text-transparent)", has('<h1 class="bg-clip-text text-transparent bg-gradient-to-r">Hi</h1>', "gradient-text"));
  spec("flags gradient-text (CSS background-clip:text + transparent)", has('<h1 style="background-clip:text;color:transparent">Hi</h1>', "gradient-text"));
  spec("flags side-stripe border (border-l-4)", has('<div class="border-l-4 border-blue-500 p-4">x</div>', "side-tab"));
  spec("flags stripe-gradient background (repeating-linear-gradient)", has('<style>.bg{background:repeating-linear-gradient(45deg,#000,#000 2px,#fff 2px)}</style>', "repeating-stripes-gradient"));
  spec("flags cramped tracking (tracking-tighter)", has('<h1 class="tracking-tighter">x</h1>', "extreme-negative-tracking"));
  spec("flags cramped tracking (letter-spacing:-0.06em)", has('<style>h1{letter-spacing:-0.06em}</style>', "extreme-negative-tracking"));
  spec("flags nested cards (card inside card)", has('<div class="rounded-xl shadow-lg p-4"><div class="rounded-xl shadow p-2">y</div></div>', "nested-cards"));

  // Warn-tier gates (NOT in serious set → enrich the review, never gate A5).
  spec("flags transition:all (warn)", has('<div class="transition-all">x</div>', "transition-all"));
  spec("flags emoji-as-icon (warn)", has("<button>🚀 Launch</button>", "emoji-icon"));
  spec("flags italic heading (warn)", has('<h2 class="italic">Title</h2>', "italic-heading"));
  spec("flags placeholder name (warn)", has("<p>Jane Doe, CEO</p>", "placeholder-name"));
  spec("flags dead image host picsum.photos (warn)", has('<img src="https://picsum.photos/seed/x/600/400">', "dead-image-host"));
  spec("a real Unsplash url is NOT flagged (it is the recommended source now)", !has('<img src="https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=700">', "dead-image-host"));
  spec("flags brand lucide icon that renders blank (warn)", has('<i data-lucide="instagram"></i>', "brand-lucide-icon"));

  // Convergence-tier gates (warn) — the "two different briefs come back identical" tells,
  // ported from impeccable. These catch a design that defaulted to the saturated AI palette
  // instead of committing to its own identity.
  spec("flags unmodified kit accent (Mist teal #0e8f86)", has('<style>:root{--color-accent:#0e8f86}</style>', "unmodified-kit-default"));
  spec("flags cream / warm off-white bg (hex)", has('<style>:root{--color-bg:#f5f0e6}</style>', "cream-palette"));
  spec("flags cream Tailwind bg (bg-amber-50)", has('<div class="bg-amber-50">x</div>', "cream-palette"));
  spec("flags generic AI purple palette (#8b5cf6)", has('<style>.x{color:#8b5cf6}</style>', "ai-color-palette"));
  spec("flags purple/violet gradient", has('<div class="bg-gradient-to-r from-violet-500 to-fuchsia-500">x</div>', "ai-color-palette"));
  spec("flags marketing buzzword copy", has("<p>Supercharge your workflow today</p>", "marketing-buzzword"));
  spec("flags em-dash overuse (>=5)", has("<p>a — b — c — d — e — f</p>", "em-dash-overuse"));
  // Discrimination: the kits' own non-cream off-whites + pure white DON'T trip cream; the kit
  // indigo is not the AI purple set; CSS custom props (`--`) are not counted as em-dashes.
  spec("pure white bg is not cream", !has('<style>:root{--color-bg:#ffffff}</style>', "cream-palette"));
  spec("Ink/Clay barely-warm off-white is not cream", !has('<style>:root{--color-bg:#fbfaf8}</style>', "cream-palette") && !has('<style>:root{--color-bg:#fffefb}</style>', "cream-palette"));
  spec("kit indigo #6e7bf2 is not the AI purple set", !has('<style>:root{--color-accent:#6e7bf2}</style>', "ai-color-palette"));
  spec("CSS custom props (--) are not counted as em-dashes", !has('<style>:root{--a:#fff;--b:#000;--c:#111;--d:#222;--e:#333;--f:#444}</style>', "em-dash-overuse"));
  // The genuinely-soft convergence nudges (judgment, not a hard error) never gate A5; but
  // cream-palette + ai-color-palette ARE the saturated AI-default tells we DO gate on (they
  // sit in the serious set), so a build that defaults its surface/accent reds A5 — by design.
  spec("soft convergence nudges stay out of the serious set (never gate A5)", ["unmodified-kit-default", "marketing-buzzword", "em-dash-overuse"].every((id) => !SERIOUS.has(id)));
  spec("cream-palette + ai-color-palette DO gate A5 (in the serious set)", SERIOUS.has("cream-palette") && SERIOUS.has("ai-color-palette"));

  // Discrimination: clean markup is silent, AND emits nothing in the serious set.
  const clean = '<section class="p-6"><h1 class="font-bold text-2xl">Welcome</h1><p class="text-zinc-700">A real, readable sentence.</p><button class="rounded-lg bg-blue-600 text-white px-4 py-2">Continue</button></section>';
  spec("clean markup yields zero findings", detectSlop(clean).length === 0, `${detectSlop(clean).length} findings`);
  spec("clean markup emits nothing in the serious set (no false A5 fail)", detectSlop(clean).every((f) => !SERIOUS.has(f.antipattern)));
  // A single card and sibling cards are fine — only NESTING is the smell.
  spec("single card is not flagged as nested", !has('<div class="rounded-xl shadow-lg p-4">one card</div>', "nested-cards"));
  spec("sibling cards are not flagged as nested", !has('<div class="grid"><div class="rounded-xl shadow p-4">a</div><div class="rounded-xl shadow p-4">b</div></div>', "nested-cards"));

  return { ok: rows.every((r) => r.ok), rows };
}

// ── Cookbook integrity: the reference must practise what it preaches ─────────
// skills/arta/component-cookbook.md hands the agent ready-to-paste app components. If a
// snippet itself carried a slop tell (a gradient headline, a side-stripe active state, a
// nested card), the skill would be *teaching* slop. Extract every ```html block and assert
// the detector finds ZERO error-level tells — a guard that the cookbook can't drift.
function runCookbookSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const md = fs.readFileSync(path.join(ROOT, "skills/arta/component-cookbook.md"), "utf8");
  const blocks = [...md.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
  spec("cookbook ships html component snippets", blocks.length >= 10, `${blocks.length} snippets`);
  const findings = blocks.flatMap((b, i) => detectSlop(b, { file: "snippet#" + (i + 1) }));
  const errors = findings.filter((f) => f.severity === "error");
  spec("every cookbook snippet is slop-free (0 error findings)", errors.length === 0, errors.length ? errors.map((f) => f.file + ":" + f.antipattern).join(", ") : "clean");
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Reference library integrity: the on-demand craft docs the skill routes to ─────
// SKILL.md points the agent at skills/arta/reference/*.md for deep craft (the two register
// refs + typography/color/layout/motion/interaction/imagery/critique-rubric). Lock: every
// referenced file exists and is substantial, no cross-link dangles, no source leaks
// (impeccable mentions / {{placeholders}}), and any ```html example is itself slop-free —
// a reference that taught slop would poison every build that follows it.
function runReferenceLibrarySpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const REF_DIR = path.join(ROOT, "skills/arta/reference");
  const EXPECTED = ["register-brand", "register-product", "typography", "color", "layout", "motion", "interaction", "imagery", "critique-rubric", "ux-heuristics", "accessibility", "cognitive-load", "ai-product-patterns", "ux-research"];
  const present = EXPECTED.filter((n) => fs.existsSync(path.join(REF_DIR, n + ".md")));
  spec("all 14 craft + UX references exist", present.length === EXPECTED.length, present.length + "/" + EXPECTED.length + " present");
  const files = EXPECTED.filter((n) => fs.existsSync(path.join(REF_DIR, n + ".md")));
  const texts = Object.fromEntries(files.map((n) => [n, fs.readFileSync(path.join(REF_DIR, n + ".md"), "utf8")]));
  spec("each reference is substantial (≥60 lines)", files.every((n) => texts[n].split("\n").length >= 60), files.map((n) => n + ":" + texts[n].split("\n").length).filter((s) => +s.split(":")[1] < 60).join(", ") || "ok");
  spec("no reference leaks a {{placeholder}} or an impeccable mention", files.every((n) => !/\{\{|impeccable/i.test(texts[n])), files.filter((n) => /\{\{|impeccable/i.test(texts[n])).join(", ") || "clean");
  // SKILL.md's reference/ links all resolve.
  const skill = fs.readFileSync(path.join(ROOT, "skills/arta/SKILL.md"), "utf8");
  const skillLinks = [...skill.matchAll(/\(reference\/([a-z-]+\.md)\)/g)].map((m) => m[1]);
  spec("SKILL.md links to the register refs", skillLinks.includes("register-brand.md") && skillLinks.includes("register-product.md"));
  spec("every reference/ link in SKILL.md resolves", skillLinks.every((f) => fs.existsSync(path.join(REF_DIR, f))), skillLinks.filter((f) => !fs.existsSync(path.join(REF_DIR, f))).join(", ") || "all resolve");
  // Sibling cross-links inside the refs resolve (relative to REF_DIR, or ../ for parent docs).
  const dangling = [];
  for (const n of files) for (const m of texts[n].matchAll(/\]\((\.\.\/)?([a-z-]+\.md)\)/g)) {
    const rel = (m[1] || "") + m[2];
    if (!fs.existsSync(path.join(REF_DIR, rel))) dangling.push(n + "→" + rel);
  }
  spec("no reference cross-link dangles", dangling.length === 0, dangling.join(", ") || "all resolve");
  // Any ```html example in a reference must itself be slop-free (error tier) — refs can't teach slop.
  const refErrors = files.flatMap((n) => [...texts[n].matchAll(/```html\n([\s\S]*?)```/g)].flatMap((b) => detectSlop(b[1], { file: n }).filter((f) => f.severity === "error")));
  spec("every reference html example is slop-free (0 error findings)", refErrors.length === 0, refErrors.map((f) => f.file + ":" + f.antipattern).join(", ") || "clean");
  return { ok: rows.every((r) => r.ok), rows };
}

// ── Prototype preview: one self-contained clickable page (live /preview + export) ──
// buildPrototypePreview embeds every screen body + a runtime into ONE document (iframe
// swaps srcdoc on data-to nav, store persists in the parent). It backs BOTH the live
// /preview route and the "Export prototype (HTML)" download, so it must: embed all screens,
// wire data-to navigation, render a switcher, honour `start`, escape `</script>` in screen
// bodies (or a screen with inline script breaks the whole file), and degrade to a clear
// empty page. Lock it — a regression here ships a blank or broken preview.
function runPreviewSpecs() {
  const rows = [];
  const spec = (name, ok, detail) => rows.push({ name, ok, detail });
  const proto = {
    start: "alpha",
    frame: "web",
    layout: "{{slot}}",
    screens: [
      { id: "alpha", title: "Alpha", html: '<h1>Alpha screen</h1><a data-to="beta">go beta</a>' },
      { id: "beta", title: "Beta", html: '<h1>Beta screen</h1><button data-inc="n">+</button><span data-bind="n"></span>' },
    ],
    store: { n: 0 },
  };
  const html = buildPrototypePreview(proto, { name: "T" });
  spec("embeds every screen body", html.includes("Alpha screen") && html.includes("Beta screen"));
  spec("wires data-to navigation in the in-frame runtime", html.includes("arta-frame") && html.includes("type:'nav'"));
  spec("renders the parent shell (show + buildDoc)", html.includes("function show(") && html.includes("function buildDoc("));
  spec("renders a screen switcher for each screen", html.includes('data-goto="alpha"') && html.includes('data-goto="beta"'));
  spec("honours the start screen", html.includes('var START = "alpha"'));
  spec("ships the image safety net (failed <img> → skeleton)", html.includes("data-hs-fallback") && html.includes("hs-img-skeleton"));
  spec("ships Iconify alongside lucide (brand + non-core sets)", html.includes("iconify-icon@2") && html.includes("lucide@latest"));
  spec("ships the icon safety net (blank lucide name → fallback glyph)", html.includes("?'globe':'circle'"));
  // Regression guard: lucide REPLACES a resolved <i data-lucide> with an <svg data-lucide>, so
  // a blank icon is one whose tag is still NOT 'svg'. The net must key off that — NOT a nested
  // <svg> (which no rendered icon has either, so it matched every icon and turned whole pages
  // to circles: the v0.1.80 + v0.1.81 bug). Verified live against the lucide UMD build.
  spec("icon net detects blanks by non-svg tag (not nested svg)", html.includes("tagName.toLowerCase()!=='svg'") && !html.includes("!el.querySelector('svg')"));
  // Theme switching: a toggle the AI marks `data-theme-toggle` must actually work. Needs both
  // halves shipped in every render: (1) Tailwind's `dark:` made class-based (else it tracks the
  // OS, not the toggle), and (2) the runtime that flips `.dark` on click + restores the saved
  // theme. Verified live in Chrome — class-based `dark:` + `.dark{--token}` swap both reacted.
  spec("ships class-based Tailwind dark variant (toggle, not OS-only)", html.includes("@custom-variant dark") && html.includes("text/tailwindcss"));
  spec("ships the theme runtime (data-theme-toggle flips .dark + persists)", html.includes("data-theme-toggle") && html.includes("'arta-theme'") && html.includes("classList.toggle('dark'"));
  spec("default preview shows the navigator (floating button + sidebar)", html.includes('class="pv-fab"') && html.includes('class="pv-side"'));

  // The static export (chrome:false) is a client demo: SAME screens + data-to navigation,
  // but the Arta navigator (floating button / sidebar) is gone — and so is its JS wiring,
  // so the parent script can't throw on a missing #pv-fab.
  const exp = buildPrototypePreview(proto, { name: "T", chrome: false });
  spec("export drops the navigator chrome (no pv-fab / pv-side)", !exp.includes('class="pv-fab"') && !exp.includes('class="pv-side"'));
  spec("export keeps the screens + data-to runtime", exp.includes("Alpha screen") && exp.includes("function show(") && exp.includes("arta-frame"));
  spec("export omits navigator wiring (no getElementById('pv-fab'))", !exp.includes("getElementById('pv-fab')"));

  // A screen with inline </script> must not close the parent <script>. The body's </script>
  // is neutralised to <\/script> (harmless inside script data — only a literal </script ends
  // a script element), so the document has exactly ONE real closing </script> (the parent's).
  const evil = buildPrototypePreview({ start: "x", frame: "web", layout: "{{slot}}", screens: [{ id: "x", title: "X", html: "<script>var a=1<\/script>ok" }] }, {});
  const realCloses = (evil.match(/<\/script>/g) || []).length; // the escaped <\/script> is NOT matched
  spec("escapes </script> in screen bodies (parent script not closed early)", realCloses === 1 && evil.includes("<\\/script"), `real </script>: ${realCloses}`);

  // No screens → a clear empty page, never a broken document.
  const empty = buildPrototypePreview({ screens: [] }, {});
  spec("degrades to a clear empty page when there are no screens", empty.includes("No screens to preview"));
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
  const exportSpecs = runExportSpecs();
  if (!exportSpecs.ok) regressed = true;
  const headlessSpecs = runHeadlessSpecs();
  if (!headlessSpecs.ok) regressed = true;
  const slopSpecs = runSlopDetectorSpecs();
  if (!slopSpecs.ok) regressed = true;
  const cookbookSpecs = runCookbookSpecs();
  if (!cookbookSpecs.ok) regressed = true;
  const referenceSpecs = runReferenceLibrarySpecs();
  if (!referenceSpecs.ok) regressed = true;
  const designSystemSpecs = runDesignSystemSpecs();
  if (!designSystemSpecs.ok) regressed = true;
  const previewSpecs = runPreviewSpecs();
  if (!previewSpecs.ok) regressed = true;

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
    console.log(JSON.stringify({ mode: "gate", ok: !regressed, a5Skipped: [...a5Skipped], rows, specs: specs.rows, railSpecs: railSpecs.rows, frameSpecs: frameSpecs.rows, projectSpecs: projectSpecs.rows, exportSpecs: exportSpecs.rows, headlessSpecs: headlessSpecs.rows, slopSpecs: slopSpecs.rows, cookbookSpecs: cookbookSpecs.rows, referenceSpecs: referenceSpecs.rows, designSystemSpecs: designSystemSpecs.rows, previewSpecs: previewSpecs.rows }, null, 2));
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

  console.log("\n  RENDER-LAYER SPECS — export every full screenshot to one PDF\n");
  for (const s of exportSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  RENDER-LAYER SPECS — headless-Chrome snapshot (render = the browser)\n");
  for (const s of headlessSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  SLOP-DETECTOR SPECS — Arta's own anti-slop engine (A5 + design review)\n");
  for (const s of slopSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  COOKBOOK SPECS — component-cookbook.md practises what it preaches\n");
  for (const s of cookbookSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  REFERENCE LIBRARY SPECS — skills/arta/reference/*.md integrity\n");
  for (const s of referenceSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  DESIGN-SYSTEM TAB SPECS — reflects a CSS-authored system (no blank tab)\n");
  for (const s of designSystemSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

  console.log("\n  PREVIEW SPECS — one self-contained clickable prototype (/preview + export)\n");
  for (const s of previewSpecs.rows) console.log("  " + (s.ok ? GLYPH.pass : GLYPH.fail) + " " + pad(s.name, 58) + (s.detail ? "  " + s.detail : ""));

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
