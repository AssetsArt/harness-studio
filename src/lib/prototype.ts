import type { DesignTokens, Prototype, Screen, TemplateVars } from "./types";

// The web-font families preloaded into every freeform screen (and the design-system
// gallery), so the AI can compose brand-grade type pairings — not just one sans.
// A neutral sans + mono (Geist), an elegant display serif (Instrument Serif), a warm
// variable serif (Fraunces), and a geometric display (Space Grotesk). The Latin faces
// above are Latin-only, so Noto Sans/Serif Thai are loaded too — put them in a font-family
// fallback chain (`'Fraunces', 'Noto Serif Thai', serif`) so non-Latin text renders in a
// real designed face instead of a broken system fallback. Kept in sync across the screen
// iframe, the render harness, and the component-preview iframe via this one constant.
export const FONT_LINK =
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=Noto+Serif+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">`;

// Minimal, mustache-flavoured templating for the prototype layer so the AI can
// share a layout and components instead of repeating markup on every screen:
//
//   {{>name}}   include the shared component prototype.components[name]
//   {{slot}}    (layout only) the current screen's body
//   {{name}}    a template variable from screen.vars / prototype.vars
//
// Editing one shared component or the layout updates every screen at once — the
// whole point: change a header in one place, no per-screen drift.

const INCLUDE_RE = /\{\{>\s*([\w-]+)\s*\}\}/g;
const VAR_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

function expand(tpl: string, components: Record<string, string>, vars: TemplateVars, depth = 0): string {
  if (depth > 12) return tpl; // guard against component cycles
  let out = tpl.replace(INCLUDE_RE, (_m, name: string) => {
    const frag = components[name];
    return frag != null ? expand(frag, components, vars, depth + 1) : "";
  });
  out = out.replace(VAR_RE, (m, key: string) => {
    if (key === "slot") return m; // reserved for the layout's body slot
    return vars[key] != null ? String(vars[key]) : "";
  });
  return out;
}

// Expand a standalone fragment (resolve {{>includes}} and {{vars}}) — used to
// preview a component in the design-system gallery the way screens render it.
export function expandFragment(proto: Prototype, html: string): string {
  return expand(html, proto.components || {}, { ...(proto.vars || {}) });
}

// Compose the final HTML for one screen: expand its body, expand the layout,
// then drop the body into the layout's {{slot}}.
export function resolveScreenHtml(proto: Prototype, screen: Screen): string {
  const components = proto.components || {};
  const vars: TemplateVars = { ...(proto.vars || {}), ...(screen.vars || {}) };
  const body = expand(screen.html ?? "", components, vars);

  const layoutTpl = screen.layout === false || screen.layout === "none" ? "{{slot}}" : screen.layout ?? proto.layout ?? "{{slot}}";

  const shell = expand(layoutTpl, components, vars);
  return shell.replace(/\{\{\s*slot\s*\}\}/g, body);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// The preloaded display/text faces (Geist, Instrument Serif, Fraunces, Space Grotesk)
// are Latin-only, so a token like `'Geist', system-ui, sans-serif` leaves Thai (and any
// other non-Latin) to the generic system fallback. That fallback resolves to DIFFERENT
// faces in the live screen iframe than in a snapshot — modern-screenshot repaints the
// cloned iframe inside the viewer's PARENT document (see FreeformDevice.capture), where
// `system-ui` / `sans-serif` map to other Thai faces with different metrics. The dev and
// the agent then saw different glyph widths and long strings wrapped/overlapped only in
// the snapshot. Pinning a loaded Noto Thai face IN the chain ties non-Latin text to one
// webfont that paints identically in both contexts. Injected automatically so EVERY
// prototype gets snapshot↔live parity even when the authored token omits it (e.g. a build
// from a harness that never loaded the skill's font guidance).
function withThaiFallback(value: string): string {
  if (/Noto\s+(?:Sans|Serif)\s+Thai/i.test(value)) return value; // already pinned
  const serif = /\bserif\b/i.test(value) && !/sans-serif/i.test(value);
  const thai = serif ? "'Noto Serif Thai'" : "'Noto Sans Thai'";
  const generic = /^(?:serif|sans-serif|monospace|system-ui|ui-serif|ui-sans-serif|ui-monospace|cursive|fantasy)$/i;
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  const gi = parts.findIndex((p) => generic.test(p));
  if (gi >= 0) parts.splice(gi, 0, thai);
  else parts.push(thai);
  return parts.join(", ");
}

// Compile structured design tokens into CSS custom properties (a :root block) so
// screens reference them — var(--color-primary), var(--space-4), var(--radius-lg),
// var(--shadow-md), var(--text-h1), var(--font-sans) — keeping the design system
// the single source of truth.
export function compileTokens(tokens?: DesignTokens): string {
  if (!tokens) return "";
  const lines: string[] = [];
  const add = (prefix: string, items?: { name: string; value: string }[]) =>
    (items || []).forEach((t) => {
      if (t?.name && t.value != null) lines.push(`  --${prefix}-${slug(t.name)}: ${t.value};`);
    });
  add("color", tokens.colors);
  add("space", tokens.spacing);
  add("radius", tokens.radii);
  add("shadow", tokens.shadows);
  (tokens.fonts || []).forEach((t) => {
    if (t?.name && t.value != null) lines.push(`  --font-${slug(t.name)}: ${withThaiFallback(String(t.value))};`);
  });
  (tokens.typography || []).forEach((t) => {
    if (t?.name && t.size) lines.push(`  --text-${slug(t.name)}: ${t.size};`);
  });
  return lines.length ? `:root{\n${lines.join("\n")}\n}` : "";
}

// The full stylesheet injected into every freeform screen: compiled token vars
// first (so custom CSS can reference them), then the authored designSystem CSS.
export function designSheet(proto: Prototype): string {
  return [compileTokens(proto.tokens), proto.designSystem || ""].filter(Boolean).join("\n");
}

// Recover displayable tokens from the `:root` custom properties in a stylesheet — the
// inverse of compileTokens. The Design-system tab reads structured `prototype.tokens`, but
// the AI often sets up the system as raw CSS (arta_set_design_system) with a `:root` block
// and never calls arta_set_design_tokens — which left the tab blank even though a real
// design system existed. Parsing the authored CSS's `:root` vars back into tokens makes the
// tab reflect the system whichever way it was authored. Reads ONLY `:root` blocks, so
// per-component custom properties don't leak in.
export function tokensFromCss(css?: string): DesignTokens {
  const out: DesignTokens = {};
  if (!css || !css.trim()) return out;
  const body = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join(";");
  const seen = new Set<string>();
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) {
    const name = m[1].trim();
    const value = m[2].trim();
    if (!value || seen.has(name)) continue;
    seen.add(name);
    if (name.startsWith("color-")) (out.colors ||= []).push({ name: name.slice(6), value });
    else if (name.startsWith("font-")) (out.fonts ||= []).push({ name: name.slice(5), value });
    else if (name.startsWith("radius-")) (out.radii ||= []).push({ name: name.slice(7), value });
    else if (name.startsWith("shadow-")) (out.shadows ||= []).push({ name: name.slice(7), value });
    else if (name.startsWith("space-") || name.startsWith("spacing-")) (out.spacing ||= []).push({ name: name.replace(/^spac(?:e|ing)-/, ""), value });
    else if (name.startsWith("text-")) (out.typography ||= []).push({ name: name.slice(5), size: value });
  }
  return out;
}

// The prototype's dark-theme token overrides: every custom property declared under a `.dark`
// rule (e.g. `.dark{--color-bg:#0b0b0c}`), keyed by the raw var name (without the `--`). The
// Design-system tab uses this to show a colour's dark value when previewing the dark theme.
// Returns {} when the system has no `.dark` block (light-only prototype).
export function darkVars(css?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!css || !css.trim()) return out;
  const body = [...css.matchAll(/\.dark\b[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join(";");
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) {
    const name = m[1].trim();
    if (!(name in out)) out[name] = m[2].trim();
  }
  return out;
}
