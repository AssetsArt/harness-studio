# Colour

Load this when you're setting or auditing a prototype's palette — choosing the brand colour, composing the token set, or fixing washed-out / cliché / inaccessible colour.

Colours in Arta are **design tokens**, not paint. You set them once with `arta_set_design_tokens` (they compile to `--color-*` custom properties injected into every screen) and reference them as `var(--color-*)` or a Tailwind class that maps to one. **No raw hex in a screen body** — `style="color:#1a1a1a"`, `bg-[#f5f5f5]`, `text-[#666]` are banned. Need a shade the kit lacks? Add a token, then reference the var. See [typography](typography.md) for the type half of the system and [imagery](imagery.md) for cover/skeleton surfaces.

## Strategy: the commitment axis

Pick ONE strategy before you set a single colour (the four steps, defined in SKILL.md — don't re-derive them here):

- **Restrained** — tinted neutrals + one accent ≤10% of the surface. The **product floor**: tools, dashboards, data-dense apps live here.
- **Committed** — one saturated colour carries 30–60% of the surface. Identity-driven.
- **Full palette** — 3–4 named roles, each used deliberately. Brand work.
- **Drenched** — the surface IS the colour. Campaign, hero, statement.

Product/tool UI floors at **restrained**; a brand / marketing / launch / portfolio surface **earns** committed-or-louder. Beige-plus-one-accent on a bold brief is a hedge, not a decision. Whichever you pick, **restrained still means *few* colours used confidently, not *no* colour** — the accent must visibly show up (below).

## Choose your own accent — the kit hex is an example

The accent hex printed in each `design-systems.md` kit (Ink `#b3321a`, Graphite `#6e7bf2`, Clay `#c0522e`, Mist `#0e8f86`, Signal `#d8fe3e`) is a **worked example, not a default.** Ship it unchanged and every build on that kit shares one palette — `arta_design_review` flags exactly those five literals (`unmodified-kit-default`). **Choose a fresh accent hue per project.** Two builds in the same register must not share a palette just because they share a kit.

Run the **category-reflex check** (SKILL.md) on the palette too: could someone guess it from the category alone — "fintech → navy + gold", "AI tool → cream + purple", "dashboard → dark + indigo"? If yes, it's the training-data reflex. Rework until neither the first-order nor the obvious-anti-move guess lands.

## The seed idea: mood lives in the brand colour, not the surface

Don't pick a frozen 4-colour palette. Pick **one anchor colour** (the seed) for the brand, then compose the rest around it with judgment + the brief. The core principle:

> **The mood lives in the BRAND colour (primary + accent) and the typography — NOT in the surface.** Stripe is warm; its purple does that, its bg is pure white. Linear is cool; its blue does that, its bg is pure. Putting the warmth in BOTH primary AND bg is the AI cliché.

So the background should be **overwhelmingly a true off-white or a true near-black:**

- **Pure white** — `oklch(1 0 0)` / `#ffffff`. Not `#fefcf8`, not chroma `0.005`. The default for product/marketing surfaces.
- **Pure near-black** — L `0.04`–`0.12`, chroma `0`. No hue tint. The default for dark, cinematic, focused surfaces.
- **Tinted** (chroma `0.015`–`0.05`) — ONLY when the mood is genuinely *environmental* (the surface IS part of the brand: a leather library, a ceramic studio, a hotel lobby) **or** the brand colour is so desaturated it needs a tinted ground to read. NOT for "feels warm" / "modern + warm" / "moody" — if your mood says warm but names no specific room, use pure white and let the primary carry the warmth.

This is **why "warm cream bg" is the cliché the detector flags** (`cream-palette`): light + warm-ordered + tinted is the single most saturated AI-default neutral, and it's almost always a reflex, not a decision.

## primary ≠ accent

`--color-primary` and `--color-accent` must be **visually distinct in both hue and lightness** — not two shades of one hue. The accent is a *second* brand colour for badges, links, selected state, key highlights; it has to push against the primary, not echo it. (Aim for clear separation, ~1.7:1 luminance contrast between them at minimum.) Avoid the generic AI purple/indigo entirely — `#6366f1`, `#8b5cf6`, and purple/violet gradients are the loudest colour tell (`ai-color-palette`); choose a distinctive brand hue instead.

## Contrast floors — non-negotiable

| Content | Minimum |
|---|---|
| Body text vs bg | **4.5:1** |
| Large text (18px+, or 14px bold) | **3:1** |
| Placeholder / hint text | **4.5:1** |
| UI components, icons, borders | **3:1** |

The **#1 readability failure is muted gray on a tinted near-white** — it sails under 4.5:1. `--color-muted` (secondary text) is the usual culprit; check it against the *actual* bg, not white.

**Gray text on a coloured background looks washed out.** Don't drop a neutral gray onto a coloured fill or tinted panel — use a **darker shade of the bg's own hue**, or a **transparency of the text colour** over that bg. (e.g. on a tinted brand panel, `color: var(--color-primary-ink)` — a deep version of the brand hue — not `text-zinc-500`.)

## Text on a saturated fill: white wins

A **mid-luminance saturated fill** (primary button, accent badge, status pill, filled callout) wants **white text — even when dark text technically passes contrast.** Saturated colours read brighter than their luminance suggests (Helmholtz-Kohlrausch), so dark text on them reads *muddy*. The convention — Stripe orange CTAs, every fintech orange button, Linear's status pills — is white text on saturated fills.

Dark text is correct only on **pale** fills (very light, L > ~0.85) or **pure-neutral** fills (near-zero chroma). Everything in between: white text. Apply this consistently across every text-on-colour element, not just the primary button.

## Semantic / state tokens — define once, reuse everywhere

This bites hardest in **data-dense apps.** The status / priority / severity palette is part of the design system, not a per-screen decision. The same in-progress colour, done colour, warning colour must appear on **every** screen — as tokens, never inlined. Inlining the same `#hex` 10+ times across screens (even a consistent one) is the classic "has a design system but doesn't use it" miss: define it once as a token, reference the var.

```js
// arta_set_design_tokens — colors (semantic names, brand accent IS the project's own)
[
  { "name": "bg",       "value": "#ffffff" },   // true off-white — NOT a warm cream
  { "name": "fg",       "value": "#16181d" },   // body ink, 4.5:1+ on bg
  { "name": "muted",    "value": "#5b616b" },   // secondary text — verify ≥4.5:1 on bg
  { "name": "border",   "value": "#e6e8ec" },
  { "name": "surface",  "value": "#f6f7f9" },   // cards/panels — bg pulled toward ink
  { "name": "primary",  "value": "#1f6f5c" },   // brand — your OWN hue, not a kit literal
  { "name": "accent",   "value": "#e0742a" },   // second brand colour — distinct hue + lightness
  // semantic state — same token on every screen
  { "name": "status-todo",        "value": "#71747d" },
  { "name": "status-in-progress", "value": "#2563a8" },
  { "name": "status-done",        "value": "#1f7a4d" },
  { "name": "severity-warning",   "value": "#b06a12" },
  { "name": "severity-high",      "value": "#b23a2e" }
]
```

```html
<!-- reference the var — never re-inline the hex -->
<span class="rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style="background:var(--color-status-in-progress)">In progress</span>
<button class="rounded-lg px-4 py-2 font-medium text-white"
        style="background:var(--color-primary)">Save changes</button>
```

(Inline `style` is shown here only for the var binding; prefer Tailwind utilities for layout — see SKILL.md. A repeated badge belongs in a component or a `designSystem` class.)

## Dark theme — a `.dark{}` token block

Light/dark is built in: the runtime puts `.dark` on `<html>` and a `data-theme-toggle` element flips it. Provide a `.dark{}` block in `arta_set_design_system` that **swaps the same semantic tokens** — the body already reads `var(--color-bg)`/`var(--color-fg)`, so the whole screen follows.

```css
:root{
  --color-bg:#ffffff; --color-fg:#16181d; --color-surface:#f6f7f9;
  --color-border:#e6e8ec; --color-muted:#5b616b;
  --color-primary:#1f6f5c; --color-accent:#e0742a;
}
.dark{
  --color-bg:#0c0e10;        /* true near-black — chroma ~0, no tint */
  --color-fg:#f1f2f4;        /* light ink — slightly lighter weight reads correctly */
  --color-surface:#16191c;   /* depth from a LIGHTER surface, not a shadow */
  --color-border:#262a2e;
  --color-muted:#9aa0a8;     /* re-verify ≥4.5:1 on the DARK bg */
  --color-primary:#3a9b82;   /* lift L / trim chroma so it doesn't muddy on black */
  --color-accent:#f08a3e;
}
```

Dark mode is **not** an inversion: depth comes from a lighter surface (not a drop shadow), accents desaturate slightly, and every contrast floor must be re-checked against the dark bg. If you support dark, theme **every** screen — one un-themed white screen in a dark flow reads as a bug. Put the override in the `.dark{}` block (not buried in one screen) so the Design-system sub-view can preview both themes.

## Token naming

Name semantically, never by appearance: `--color-bg` / `-fg` / `-surface` / `-primary` / `-accent` / `-muted` / `-border`, plus semantic state names (`status-*`, `severity-*`, `priority-*`). A token called `--color-green` breaks the moment dark mode or a rebrand changes what "done" looks like; `--color-status-done` survives it.

## Quick audit checklist

- bg is true off-white (chroma ~0) or true near-black — **no warm cream** unless the mood is genuinely environmental.
- Accent is the **project's own** hue, not a kit literal (`#b3321a`/`#6e7bf2`/`#c0522e`/`#0e8f86`/`#d8fe3e`) and not AI purple/indigo.
- primary ≠ accent — distinct in hue **and** lightness.
- Body ≥4.5:1, large ≥3:1, placeholder ≥4.5:1 — muted text re-checked on the **actual** (tinted/dark) bg.
- No gray text on a coloured fill — darker shade of the bg hue, or a transparency of the text colour.
- White text on every saturated fill (button / badge / pill).
- Status/severity colours are **tokens**, identical on every screen — zero inline `#hex` in screen bodies.
- `.dark{}` block swaps the same tokens; every screen themed; floors re-verified dark.
