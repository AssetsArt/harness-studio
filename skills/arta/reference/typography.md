# Typography

Load this when you're choosing or pairing faces, building a type scale, or a screen's hierarchy reads flat / generic / "an AI made this".

Type carries most of the information on a screen. Distinctiveness here does **not** come from exotic fonts — the iframe loads only five Latin display/text faces (plus two Thai). It comes from picking the face that fits the voice, pairing on a contrast axis, weight/size contrast, and disciplined usage.

## The five faces (the whole palette — no others load)

The prototype iframe loads ONLY these. Any `font-family` you write must resolve to one of them (or a Thai face below); anything else falls back to a system font with different metrics and the layout drifts.

- **Geist** — neutral grotesque sans. The default for UI, body, labels, data. Pairs *under* any of the serifs/Space Grotesk as the quiet body. Reach for it whenever the type should disappear into the task.
- **Geist Mono** — monospace. Code, numerics, IDs, terse uppercase labels, tabular data. Pairs with Geist (its sibling) for a technical/dev voice. Reach for it for data and code — **not** as costume "technical" flavour on a non-technical brand.
- **Instrument Serif** — light, elegant display serif (single weight, ~400). Editorial warmth on a clean reading body. Pairs with Geist body (commerce, lifestyle, hospitality). Reach for it for a graceful, understated headline — large sizes only.
- **Fraunces** — characterful editorial serif with optical sizing + softness axes. More personality than Instrument. Pairs with Geist body (docs, long-form, premium content). Reach for it when the headline itself should have a voice.
- **Space Grotesk** — geometric display sans, technical/brand energy. Pairs with Geist body (launches, campaigns, portfolios, bold heroes). Reach for it for loud, sure, oversized statements; caps on display only.

Two more load for non-Latin: **Noto Sans Thai** / **Noto Serif Thai** (Thai section below). Nothing else.

## Pairing — the contrast-axis rule

- **Pair across an axis, never two of the same kind.** Serif display × sans body (Fraunces/Instrument × Geist). Geometric × humanist (Space Grotesk × Geist). Mono × sans (Geist Mono × Geist). Pairing Geist with Space Grotesk is the weakest move here — two sans, no real contrast.
- **One family is often right.** Geist alone in many weights (400/500/600) carries headings, labels, body, data with cleaner hierarchy than a timid display+body pair. Add a second face only when the voice needs genuine contrast.
- **Two faces max.** A third is almost always a mess. The display face headlines; the body face does everything else.
- **Match the face to the voice, not the category.** "Technical" isn't automatically mono; "elegant" isn't automatically serif. Name the voice in three physical words first, then pick.

## Register split — brand vs product

Two registers want opposite type systems. See [register-brand](register-brand.md) / [register-product](register-product.md).

**Brand** (landing, campaign, portfolio, marketing — design *is* the product):
- Fluid `clamp()` display sizing, so headlines breathe across viewports.
- Modular scale, **≥ 1.25 ratio** between steps. Flat scales (1.1× apart) read as uncommitted.
- Expressive: a display serif or Space Grotesk earns its place; weight/size contrast is loud.

**Product** (app UI, dashboard, settings, data tables — design *serves* the task):
- **Fixed `rem` scale, not fluid.** A clamp h1 that shrinks in a sidebar looks worse, not better; users view at consistent DPI.
- **Tighter 1.125–1.2 ratio.** More type elements here; exaggerated contrast is noise.
- **One family** (Geist). **No display fonts in UI labels, buttons, or data** — that's a slop tell the detector flags.

## Scale & hierarchy

- **5 sizes cover most needs:** caption · secondary · body · subheading · display. Pick one ratio and commit.
- **Make the jump obvious.** Display/hero ≥ ~2× body and heavy; labels small, uppercase, muted, slightly tracked. When h1, card titles, metric values, and body collapse into one narrow band, hierarchy dies and it looks templated.
- **Combine dimensions** — size + weight + colour + space — never size alone.
- **Hero/display ceiling ~6rem.** Above that it shouts; keep `clamp()` max ≤ ~2.5× its min.
- **Body ≥ 16px / 1rem**, in `rem` (respects user zoom). Dense data/labels can go smaller; prose can't.
- **Emphasis via weight/size, not italic headings and not gradient text.** The detector flags italic headings and `background-clip:text` gradient headlines as tells.

## Tracking & wrapping

- **Display tracking floor: ≥ -0.04em.** Tighter than that (≤ -0.05em / Tailwind `tracking-tighter`) makes letters touch — Arta's slop detector flags it as a tell. Tighten large display a little; leave body at default.
- **ALL-CAPS / labels need +0.05–0.12em** (`tracking-wide`+). Capitals sit too close at default spacing.
- **`text-wrap: balance` on h1–h3** — even headline line lengths.
- **`text-wrap: pretty` on long prose** — kills orphans/runts.
- **Line length 65–75ch for prose** (`max-width: 65ch`). Data and tables can run denser (120ch+ is fine).
- **Light text on dark needs +0.05–0.1 line-height** (and a touch of tracking, optionally one weight up): light type reads lighter and needs the air. See [colour](color.md).
- **`font-variant-numeric: tabular-nums`** on numbers that must align (tables, metrics) — Geist Mono is the natural home.

## Thai (and any non-Latin) — the font-chain rule

The five display/text faces are **Latin-only**. Set a Thai heading in `'Instrument Serif'` / `'Fraunces'` / `'Space Grotesk'` and the Thai glyphs fall back to a broken system serif: tone-marks and vowels collide, line-height goes wrong, it reads broken.

- **Append the matching Noto Thai face to every chain where you override the family for a Latin display face:**
  - Serif display → `font-family: 'Fraunces', 'Noto Serif Thai', serif;`
  - Sans/body → `font-family: 'Geist', 'Noto Sans Thai', sans-serif;`
  - Space Grotesk → `font-family: 'Space Grotesk', 'Noto Sans Thai', sans-serif;`
- Body text already gets `'Noto Sans Thai'` by default — but any element that overrides the family for a Latin display face loses it. Add it back, **or** reserve the Latin display face for genuinely Latin runs (a brand name, a queue number `A14`) and set the Thai heading in a sans.
- **Confirm in the screenshot:** garbled diacritics = wrong font chain.

## Tokens — how it's wired

Type lives in `arta_set_design_tokens` (the source of truth) and compiles to `--font-*` / `--text-*` CSS vars injected into every screen. Reference the vars — never hard-code a family in a screen body.

```json
{
  "fonts": [
    { "name": "display", "value": "'Fraunces', 'Noto Serif Thai', serif" },
    { "name": "body", "value": "'Geist', 'Noto Sans Thai', system-ui, sans-serif" }
  ],
  "typography": [
    { "name": "display", "family": "'Fraunces', serif", "size": "clamp(2.4rem, 5vw, 4rem)", "weight": 500, "lineHeight": "1.05", "letterSpacing": "-0.02em" },
    { "name": "body", "family": "'Geist', sans-serif", "size": "1.0625rem", "weight": 400, "lineHeight": "1.65" },
    { "name": "label", "family": "'Geist Mono', monospace", "size": "0.6875rem", "weight": 500, "letterSpacing": "0.08em" }
  ]
}
```

In the shared `designSystem` CSS, give the display face a class and reference the vars:

```css
.display {
  font-family: var(--font-display);
  font-weight: 500;
  letter-spacing: -0.02em;   /* floor is -0.04em; never tighter */
  text-wrap: balance;
}
.prose { max-width: 68ch; line-height: 1.65; }
.prose p { text-wrap: pretty; }
.num { font-variant-numeric: tabular-nums; }
```

In a screen body, reach for the vars via Tailwind arbitrary values or the class — never raw families:

```html
<h1 class="display text-[var(--text-display)]">Quietly well made</h1>
<p class="font-[var(--font-body)] text-[var(--color-ink)]">…</p>
<span class="font-[var(--font-mono)] num">฿1,490</span>
```

## Don't

- Pair two sans with no contrast (Geist + Space Grotesk as the "pairing"); pick an axis or use one family in many weights.
- Use `tracking-tighter` / ≤ -0.05em on display — letters touch; the detector flags it.
- Put a display face in UI labels, buttons, or data (product register).
- Use fluid `clamp()` headings in product UI — fixed `rem` scale there.
- Italic headings or gradient text for emphasis — use weight/size.
- Override the family for a Latin display face on Thai text without appending the Noto Thai fallback.
- Set body below 16px, or size it in `px`.
- Collapse the scale into one narrow band — make the display ≥ 2× body.
