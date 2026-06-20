# Brand-grade design systems

A small library of opinionated, ready-to-adapt design languages — the difference
between output that looks designed and output that looks like "an AI made a webpage."
**Don't start from generic defaults.** Pick the kit closest to the brief, set it as
the prototype's foundation, then build every screen from its tokens.

## How to use a kit

1. **Pick by the brief, not by reflex.** Match the product's register (see each kit's
   *Use for*). If two fit, pick the one whose *voice* matches the brand. Don't default
   to the safe one — a deliberate choice reads as design; a hedge reads as slop.
2. **Adapt, don't copy.** Keep the kit's *structure* (type pairing, spacing rhythm,
   radius/shadow/motion language, density) and swap the **accent + brand name** to the
   project. One kit, infinite brands. Shift the neutral's hue a touch toward the accent
   if it helps cohesion — don't default-tint warm.
3. **Set the foundation first** (before any screen): call `harness_set_design_tokens`
   with the kit's token block (edited), and `harness_set_design_system` with its CSS.
   Then style screens from the vars — `var(--color-…)`, `var(--radius-…)`,
   `font-[var(--font-display)]` / the `.display` class — never ad-hoc values.
4. **Fonts are preloaded** — Geist, Geist Mono, Instrument Serif, Fraunces, Space
   Grotesk are available in every screen. Use the kit's pairing; if you want another
   family, it must be one of these (the iframe only loads these). **These five are
   Latin-only** — for Thai (or other non-Latin) UI text, add the preloaded `'Noto Sans
   Thai'` / `'Noto Serif Thai'` to the font-family chain (e.g. the kit's display
   `'Fraunces', 'Noto Serif Thai', serif`) so headings don't fall back to a broken system
   face. See SKILL.md's non-Latin note.
5. **Then check craft** with `harness_design_review` and fix what it flags.

The tokens compile to CSS custom properties (`--color-<slug>`, `--font-<slug>`,
`--radius-<slug>`, …) injected into every screen, and render as the style guide in
Prototype → **Design system**.

---

## 1 · Ink — monochrome editorial

**Use for:** content, docs, marketing, long-form, anything where the writing is the
product. Premium restraint; Stripe-docs / magazine energy.
**Type:** Fraunces (display serif) × Geist (body sans) — contrast-axis pairing.
**Feel:** near-black on warm-anchored off-white, one hairline rule, big serif heads,
generous air, almost no color. Color strategy: **restrained** (≤1 accent, used rarely).

```json
{
  "fonts": [
    { "name": "display", "value": "'Fraunces', Georgia, serif" },
    { "name": "body", "value": "'Geist', system-ui, sans-serif" }
  ],
  "colors": [
    { "name": "bg", "value": "#fbfaf8", "description": "warm-anchored off-white, not cream" },
    { "name": "ink", "value": "#1a1a18", "description": "near-black body" },
    { "name": "muted", "value": "#6f6d68", "description": "secondary text — still ≥4.5:1" },
    { "name": "line", "value": "#e7e4de", "description": "hairline rules" },
    { "name": "accent", "value": "#b3321a", "description": "rust — used sparingly, links/marks" }
  ],
  "typography": [
    { "name": "display", "sample": "Quietly well made", "family": "'Fraunces', serif", "size": "clamp(2.4rem,5vw,4rem)", "weight": 500, "lineHeight": "1.04", "letterSpacing": "-0.02em" },
    { "name": "heading", "family": "'Fraunces', serif", "size": "1.6rem", "weight": 500, "lineHeight": "1.18" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "1.0625rem", "weight": 400, "lineHeight": "1.65" },
    { "name": "eyebrow", "family": "'Geist', sans-serif", "size": "0.78rem", "weight": 500, "letterSpacing": "0.12em" }
  ],
  "spacing": [
    { "name": "xs", "value": "8px" }, { "name": "sm", "value": "16px" },
    { "name": "md", "value": "32px" }, { "name": "lg", "value": "64px" }, { "name": "xl", "value": "112px" }
  ],
  "radii": [ { "name": "sm", "value": "6px" }, { "name": "md", "value": "10px" } ],
  "shadows": [ { "name": "card", "value": "0 1px 2px rgba(20,18,16,.05)" } ]
}
```

```css
:root { --measure: 68ch; }
body { background: var(--color-bg); color: var(--color-ink); font-family: var(--font-body); }
.display { font-family: var(--font-display); font-weight: 500; letter-spacing: -0.02em; text-wrap: balance; }
.prose { max-width: var(--measure); line-height: 1.65; }
.prose p { text-wrap: pretty; }
.rule { border: 0; border-top: 1px solid var(--color-line); }
.link { color: var(--color-accent); text-underline-offset: 3px; }
```

**Voice:** calm, declarative, specific. No exclamation marks. **Don't:** add an
uppercase eyebrow to every section, or color for decoration. Type size and the serif
carry the hierarchy.

---

## 2 · Graphite — technical dark

**Use for:** developer tools, dashboards, admin, data-dense apps. Linear / Vercel.
**Type:** Geist (UI) × Geist Mono (data, labels, code, numerics).
**Feel:** near-black surfaces, one electric accent, hairline borders, compact density,
fast precise motion. Color strategy: **restrained** on a dark base, accent ≤10%.

```json
{
  "fonts": [
    { "name": "body", "value": "'Geist', system-ui, sans-serif" },
    { "name": "mono", "value": "'Geist Mono', ui-monospace, monospace" }
  ],
  "colors": [
    { "name": "bg", "value": "#09090b" },
    { "name": "surface", "value": "#131316", "description": "cards / panels" },
    { "name": "border", "value": "#26262c" },
    { "name": "text", "value": "#ededee" },
    { "name": "dim", "value": "#9b9ba4", "description": "labels / secondary" },
    { "name": "accent", "value": "#6e7bf2", "description": "electric indigo — focus, primary" }
  ],
  "typography": [
    { "name": "display", "sample": "Ship faster", "family": "'Geist', sans-serif", "size": "clamp(1.8rem,3.5vw,2.6rem)", "weight": 600, "lineHeight": "1.1", "letterSpacing": "-0.025em" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "0.9375rem", "weight": 400, "lineHeight": "1.55" },
    { "name": "mono", "family": "'Geist Mono', monospace", "size": "0.8125rem", "weight": 500, "letterSpacing": "0" },
    { "name": "label", "family": "'Geist Mono', monospace", "size": "0.6875rem", "weight": 500, "letterSpacing": "0.08em" }
  ],
  "spacing": [
    { "name": "xs", "value": "4px" }, { "name": "sm", "value": "8px" },
    { "name": "md", "value": "16px" }, { "name": "lg", "value": "28px" }, { "name": "xl", "value": "48px" }
  ],
  "radii": [ { "name": "sm", "value": "6px" }, { "name": "md", "value": "9px" }, { "name": "lg", "value": "13px" } ],
  "shadows": [ { "name": "panel", "value": "0 1px 0 rgba(255,255,255,.04) inset, 0 1px 3px rgba(0,0,0,.4)" } ]
}
```

```css
body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-body); }
.panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.label { font-family: var(--font-mono); font-size: .6875rem; letter-spacing: .08em; text-transform: uppercase; color: var(--color-dim); }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.btn-primary { background: var(--color-accent); color: #0b0b12; border-radius: var(--radius-sm); font-weight: 500; transition: filter .14s cubic-bezier(.2,.8,.2,1); }
.btn-primary:hover { filter: brightness(1.08); }
```

**Voice:** precise, terse, no marketing fluff. Numbers are mono and tabular.
**Don't:** soft drop-shadows everywhere, or radii > 14px. Density and the single accent
do the work.

---

## 3 · Clay — warm commerce

**Use for:** shopping, lifestyle, food, hospitality. Friendly-premium, tactile.
**Type:** Instrument Serif (display) × Geist (body) — editorial warmth, clean reading.
**Feel:** a saturated terracotta carries the warmth (the *accent* is warm, the surface
is a clean near-white — never cream-as-background). Soft shadows, comfortable radii.
Color strategy: **committed** — the clay accent shows up on 20–40% of surfaces.

```json
{
  "fonts": [
    { "name": "display", "value": "'Instrument Serif', Georgia, serif" },
    { "name": "body", "value": "'Geist', system-ui, sans-serif" }
  ],
  "colors": [
    { "name": "bg", "value": "#fffefb" },
    { "name": "surface", "value": "#f6f1ea", "description": "warm panel" },
    { "name": "ink", "value": "#2a2521" },
    { "name": "muted", "value": "#7a716a" },
    { "name": "accent", "value": "#c0522e", "description": "terracotta — primary, price, CTA" },
    { "name": "accent-ink", "value": "#fdf3ee", "description": "text on accent" }
  ],
  "typography": [
    { "name": "display", "sample": "Everyday objects", "family": "'Instrument Serif', serif", "size": "clamp(2.6rem,6vw,4.5rem)", "weight": 400, "lineHeight": "1.0", "letterSpacing": "-0.01em" },
    { "name": "heading", "family": "'Geist', sans-serif", "size": "1.25rem", "weight": 600, "lineHeight": "1.25" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "1rem", "weight": 400, "lineHeight": "1.6" },
    { "name": "price", "family": "'Geist', sans-serif", "size": "1rem", "weight": 600, "letterSpacing": "-0.01em" }
  ],
  "spacing": [
    { "name": "xs", "value": "8px" }, { "name": "sm", "value": "16px" },
    { "name": "md", "value": "28px" }, { "name": "lg", "value": "56px" }, { "name": "xl", "value": "96px" }
  ],
  "radii": [ { "name": "sm", "value": "10px" }, { "name": "md", "value": "14px" }, { "name": "pill", "value": "999px" } ],
  "shadows": [ { "name": "card", "value": "0 6px 24px -12px rgba(42,37,33,.22)" } ]
}
```

```css
body { background: var(--color-bg); color: var(--color-ink); font-family: var(--font-body); }
.display { font-family: var(--font-display); font-weight: 400; }
.card { background: #fff; border: 1px solid #efe8df; border-radius: var(--radius-md); box-shadow: var(--shadow-card); }
.price { color: var(--color-accent); font-weight: 600; }
.btn-buy { background: var(--color-accent); color: var(--color-accent-ink); border-radius: var(--radius-pill); font-weight: 500; transition: transform .16s cubic-bezier(.2,.8,.2,1); }
.btn-buy:hover { transform: translateY(-1px); }
```

**Voice:** warm, inviting, concrete (real product names, real prices). **Don't:** use a
beige/cream *background* and call it warm — the accent carries warmth. No gradient text.

---

## 4 · Mist — calm SaaS

**Use for:** onboarding, settings, productivity, B2B product UI. Soft, airy, reassuring.
**Type:** Geist throughout, weight + size for hierarchy (one family, many weights).
**Feel:** lots of whitespace, a single calm accent (teal), low-saturation slate
neutrals, soft diffuse shadows, 12px radii. Color strategy: **restrained**.

```json
{
  "fonts": [ { "name": "body", "value": "'Geist', system-ui, sans-serif" } ],
  "colors": [
    { "name": "bg", "value": "#ffffff" },
    { "name": "surface", "value": "#f7f9fb", "description": "section / card fill" },
    { "name": "border", "value": "#e6ecf1" },
    { "name": "text", "value": "#16212e", "description": "ink — high contrast" },
    { "name": "muted", "value": "#5a6b7b" },
    { "name": "accent", "value": "#0e8f86", "description": "teal — primary, links" }
  ],
  "typography": [
    { "name": "display", "sample": "Set up in minutes", "family": "'Geist', sans-serif", "size": "clamp(2rem,4vw,3rem)", "weight": 600, "lineHeight": "1.12", "letterSpacing": "-0.02em" },
    { "name": "heading", "family": "'Geist', sans-serif", "size": "1.125rem", "weight": 600, "lineHeight": "1.3" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "0.9375rem", "weight": 400, "lineHeight": "1.6" }
  ],
  "spacing": [
    { "name": "xs", "value": "8px" }, { "name": "sm", "value": "16px" },
    { "name": "md", "value": "24px" }, { "name": "lg", "value": "48px" }, { "name": "xl", "value": "80px" }
  ],
  "radii": [ { "name": "sm", "value": "8px" }, { "name": "md", "value": "12px" }, { "name": "lg", "value": "16px" } ],
  "shadows": [ { "name": "soft", "value": "0 2px 8px rgba(22,33,46,.06)" }, { "name": "pop", "value": "0 12px 32px -12px rgba(22,33,46,.18)" } ]
}
```

```css
body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-body); }
.surface { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.btn { background: var(--color-accent); color: #fff; border-radius: var(--radius-sm); font-weight: 500; transition: background .16s ease-out, transform .16s cubic-bezier(.2,.8,.2,1); }
.btn:hover { transform: translateY(-1px); }
.chip { background: color-mix(in srgb, var(--color-accent) 12%, #fff); color: var(--color-accent); border-radius: var(--radius-sm); }
```

**Voice:** friendly, reassuring, plain. Short sentences. **Don't:** stack five different
shadows, or pair a 1px border *and* a wide blurry shadow on the same element (ghost
card). Pick one. Whitespace is the main tool.

---

## 5 · Signal — bold display

**Use for:** launches, campaigns, portfolios, landing heroes. High-contrast, loud, sure.
**Type:** Space Grotesk (geometric display) × Geist (body).
**Feel:** flat color blocks, oversized type, sharp-ish corners, mono-free. Either a
near-black canvas or a single drenched brand color. Color strategy: **drenched /
committed** — the surface *is* the brand.

```json
{
  "fonts": [
    { "name": "display", "value": "'Space Grotesk', sans-serif" },
    { "name": "body", "value": "'Geist', system-ui, sans-serif" }
  ],
  "colors": [
    { "name": "bg", "value": "#0a0a0a" },
    { "name": "surface", "value": "#161616" },
    { "name": "text", "value": "#fafafa" },
    { "name": "muted", "value": "#a3a3a3" },
    { "name": "accent", "value": "#d8fe3e", "description": "acid lime — one bold accent" },
    { "name": "accent-ink", "value": "#0a0a0a" }
  ],
  "typography": [
    { "name": "display", "sample": "LAUNCH DAY", "family": "'Space Grotesk', sans-serif", "size": "clamp(3rem,9vw,6rem)", "weight": 700, "lineHeight": "0.98", "letterSpacing": "-0.03em" },
    { "name": "heading", "family": "'Space Grotesk', sans-serif", "size": "1.5rem", "weight": 600, "lineHeight": "1.15" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "1.0625rem", "weight": 400, "lineHeight": "1.55" }
  ],
  "spacing": [
    { "name": "xs", "value": "8px" }, { "name": "sm", "value": "16px" },
    { "name": "md", "value": "32px" }, { "name": "lg", "value": "72px" }, { "name": "xl", "value": "128px" }
  ],
  "radii": [ { "name": "sm", "value": "2px" }, { "name": "md", "value": "4px" } ],
  "shadows": [ { "name": "none", "value": "none" } ]
}
```

```css
body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-body); }
.display { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.03em; text-transform: uppercase; text-wrap: balance; }
.block { background: var(--color-surface); border-radius: var(--radius-md); }
.btn-loud { background: var(--color-accent); color: var(--color-accent-ink); border-radius: var(--radius-sm); font-family: var(--font-display); font-weight: 600; }
.mark { color: var(--color-accent); }
```

**Voice:** confident, punchy, short. Caps on display only. **Don't:** add gradients or
soft shadows — flatness is the point. Keep it to one accent; loud + many colors = noise.

---

## If none fit

Compose your own with the same discipline: **commit to one color strategy** (restrained
/ committed / drenched), **pair fonts on a contrast axis** (serif + sans, geometric +
humanist, or one family in many weights), **pick a spacing rhythm and stick to it**, and
**keep radius / shadow / motion consistent** across every screen. Then set it via
`harness_set_design_tokens` + `harness_set_design_system` before building. The point is
the same: decide the language first, then every screen inherits it.
