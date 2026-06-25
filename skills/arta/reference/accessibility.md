# Accessibility

Load this when you're auditing a screen for WCAG (or the dev asks "is this accessible?"). Arta prototypes render as **real HTML** in the viewer, so you read the actual markup — most of WCAG's "needs a code/AT run" caveats don't apply here. Default to **WCAG 2.1 A/AA**.

Arta's edge over a static screenshot: the source markup is right there. Real `<button>`/`<nav>`/`<h1-6>`, `aria-label`, `alt`, label↔input wiring — all **inspectable in the prototype**, not guessed. So check them. Contrast ratios are owned by [colour](color.md) — point there, don't restate the math.

**Platform floors already in place — build on these, don't re-derive:**
- A `:focus-visible` ring fallback is injected onto **every** control (2px primary outline, offset 2). Don't strip it; don't add `outline:none`.
- A failed/missing `<img>` degrades to a labelled `.hs-img-skeleton` tile — never a broken-glyph. A dead URL won't *crash* a11y, but a screen full of skeletons still fails the craft read.
- Body colour is token-driven (`var(--color-fg)` on `var(--color-bg)`), so the base text pair inherits the contrast you set in tokens.

## What Arta CAN check vs what it CAN'T

- **CAN (it's real HTML):** semantic tags, heading order, `alt` presence, `aria-label` on icon buttons, label↔input association, colour-only signalling, target size, text size, focus-ring presence, reachability of every `data-to`.
- **CAN'T (it's a mock):** real screen-reader announcement, live-region timing, focus *return* after a modal closes, actual responsive reflow on a physical device, anything backend-driven. Flag these as **"needs a real device/AT run"** — don't claim a pass.

## Perceivable

- **Contrast** — body ≥4.5:1, large (≥18px / 14px bold) ≥3:1, icons/borders ≥3:1. Ratios + the gray-on-tint trap live in [colour](color.md). The recurring Arta miss: **`--color-muted` gray on a tinted panel or accent fill** — verify against the *actual* surface, not white.
- **Text ≥~14px** — body floors around 14px; 11px is fine only for an uppercase muted label, never running prose. Don't shrink to fit.
- **Don't encode meaning in colour alone (1.4.1)** — a status dot, a red error, a "done" green must also carry an **icon or text**. A board where only hue separates To-do / In-progress / Done fails for colour-blind users. Add a lucide glyph or a word.
- **`alt` on every meaningful `<img>` (1.1.1)** — describe the content (`alt="Bar chart: revenue up 12% in Q3"`), not `alt="image"`. **Decorative → empty `alt=""`** so AT skips it. A skeleton tile standing in for a real photo still needs an honest `alt`.
- **Thai text needs the Noto chain** — any element overriding the family for a Latin display face must add the Noto Thai fallback, or Thai renders with collided tone-marks / wrong line-height: `font-family:'Fraunces','Noto Serif Thai',serif` (display), `'Geist','Noto Sans Thai',sans-serif` (body). See [typography](typography.md).

## Operable

- **Touch targets ≥~44px** on phone frames (2.5.5). Icon buttons, tab-bar items, row chevrons — pad to ~44×44 even when the glyph is 20px. Two 28px buttons jammed together is a thumb-miss.
- **Visible focus (2.4.7)** — the enforced ring already covers it. **Do not remove it.** If you restyle a control, keep a `:focus-visible` state with ≥3:1 against its background.
- **Every control reachable + labelled** — every `data-to` and form control must be a real focusable element (`<button>`, `<a>` is intercepted — use `data-to` on a `<button>`; see [interaction](interaction.md)) with a discernible name. A clickable bare `<div data-to>` is a keyboard dead-end.
- **No keyboard trap in modals (2.1.2)** — a modal/drawer needs a visible, focusable **close** (`aria-label="Close"`) and an Esc path. Whether focus actually *returns* to the trigger on close is **needs a real AT run** — note it, don't assert it.

## Understandable

- **Real labels, not placeholder-only (3.3.2)** — a placeholder vanishes on input and often fails contrast. Keep a persistent `<label>` above/beside every field. Placeholder is a *format hint* (`placeholder="you@company.com"`), not the label.
- **Inline error text that says how to fix (3.3.1 / 3.3.3)** — "Invalid" is useless; "Enter a date after today" tells the user what to do. Pair the message with an icon, not red alone, and tie it to the field.
- **Consistent control vocabulary (3.2.4)** — the same action looks and reads the same on every screen. A "Save" that's a filled primary on one screen and a ghost link on another reads as two different things.
- **Predictable nav (3.2.3)** — the side rail / tab bar sits in the same place with the same items across the flow. Focusing or changing a field must not silently navigate or submit (3.2.1/3.2.2).

## Robust

- **Real semantic HTML, not `<div>` soup (1.3.1)** — `<nav>` for navigation, `<main>` for the primary region, `<button>` for actions, `<h1>`→`<h2>`→`<h3>` **in order** (no skipping levels for size — size comes from classes). One `<h1>` per screen.
- **`aria-label` on icon-only buttons (4.1.2)** — a button whose only child is a lucide glyph has no accessible name. Label it.
- **Form labels tied to inputs** — `<label for>` ↔ `id`, or wrap the input in the `<label>`. A floating text node next to an input is not a programmatic label.

## Arta-real snippets

Icon-only button — named, real `<button>`, keeps the enforced ring:

```html
<button data-to="settings" aria-label="Open settings"
        class="inline-flex h-11 w-11 items-center justify-center rounded-full
               text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">
  <i data-lucide="settings" class="h-5 w-5"></i>
</button>
```

Labelled input — persistent label, placeholder as hint only, inline fix-it error:

```html
<label for="email" class="block text-sm font-medium text-[var(--color-ink)]">Work email</label>
<input id="email" type="email" placeholder="you@company.com"
       class="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5
              text-[var(--color-ink)]" />
<p class="mt-1 flex items-center gap-1 text-sm" style="color:var(--color-severity-high)">
  <i data-lucide="alert-circle" class="h-4 w-4"></i> Enter a valid email, e.g. name@company.com
</p>
```

Status that isn't colour-only — glyph + word, not just a hue:

```html
<span class="inline-flex items-center gap-1 text-sm text-[var(--color-status-done)]">
  <i data-lucide="check-circle" class="h-4 w-4"></i> Done
</span>
```

Meaningful image with honest alt (decorative → `alt=""`):

```html
<img src="https://images.unsplash.com/photo-…" alt="Team reviewing the Q3 dashboard on a laptop"
     class="h-40 w-full rounded-xl object-cover" />
```

## Output shape (when you report)

Lead with one verdict, then grouped findings, then **max 3** priority fixes.

- **Likely accessible foundation** — semantics real, labels present, no colour-only state, targets and contrast hold.
- **Accessibility risks to fix** — specific A/AA gaps with the screen + element.
- **High accessibility risk** — a keyboard dead-end, an unlabelled critical control, or a primary flow that can't be operated.

Group findings by principle (Perceivable / Operable / Understandable / Robust), each as `[element] — [criterion, level] — [why it matters]`. Then list the three highest-impact fixes — contrast, labels/semantics, and reachability beat polish. Mark anything only a real device/AT run can confirm. Keep it specific to the screens you read; no generic WCAG lectures. WCAG is the floor, not the whole UX — see [interaction](interaction.md) and [ux-heuristics](ux-heuristics.md) for the rest.
