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
  add("font", tokens.fonts);
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
