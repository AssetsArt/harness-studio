# Layout & spacing

Load this when the screen feels *off* even though colour and type are fine — monotone spacing, a flat hierarchy, the same header+grid on every screen, or a dead white band below short content.

Space is the most underused tool. Find the structural problem and fix the bones, not the surface. The viewport is part of the design: the same markup must hold at phone width *and* web frame.

## Lean on the floors — don't re-derive them

The platform enforces these inside the device frame. Rely on them; don't waste markup re-solving them:

- `html`/`body` fill the frame — short content gets **no dead white band below**. (Still *center* a short/empty/confirmation screen; the floor stops the gap, it doesn't compose the screen.)
- `overflow-x: clip` kills sideways scroll. Note: **clip, not hidden** — so `position: sticky`/`fixed` bars still work (a `hidden` ancestor would trap them). Sticky headers and bottom CTAs survive.
- Long heading words wrap (`overflow-wrap: anywhere`) — no single word blows out the width.
- A focus-visible ring fallback exists for keyboard users (see [interaction](interaction.md) before restyling it).

What you still own: composing the screen to fill its frame, the spacing rhythm, the hierarchy, and the safe-area padding under chrome (status bar / notch / home indicator — see SKILL.md device notes).

## Register split

- **Brand** can break the grid — asymmetry, full-bleed hero imagery with the headline overlaid on the photo, fluid `clamp()` spacing that breathes on larger viewports. The surface *is* the brand. See [register-brand](register-brand.md).
- **Product** responsive is **structural**, not fluid — collapse the sidebar, make the table responsive, switch column counts at a breakpoint. Consistency is the affordance; predictable grids and steady density beat fluid type. Density tightens when the data earns it. See [register-product](register-product.md).

## Pick the layout tool

- **Flex for 1-D** — rows of items, a nav, a button group, card internals, a tab bar. Most component interiors are flex.
- **Grid for 2-D** — page structure, a dashboard, anything where rows *and* columns need coordinated control. **Don't default to grid** when `flex-wrap` is simpler.
- **Breakpoint-free responsive grids** — let the grid reflow itself instead of writing breakpoints:

```html
<div class="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
  <!-- cards reflow from 1 → 2 → 3 across with zero media queries -->
</div>
```

- For a peeking horizontal strip use the built-in **`hs-rail`** (snaps, hides its scrollbar, the next item peeks). For an image slot use **`hs-cover`**, never a flat gray box.

## Spacing rhythm — vary it

Monotonous uniform spacing is a tell — the detector reads even gaps as a generic fingerprint. Rhythm comes from *contrast*:

- **Tight groupings** (`gap-1`/`gap-2`, ~8–12px) for related siblings — a label and its value, an icon and its text.
- **Generous separations** (`gap-12`+ / `py-16`+) between distinct sections.
- **Vary within a section** — not every row needs the identical gap. Use `gap` for sibling spacing, not margins.
- Stay on a scale (Tailwind's, or your `--space-*` tokens) — arbitrary `mt-[13px]` values break the system.
- Brand earns `clamp()` for spacing that opens up at desktop width; product holds a steady, predictable rhythm.

## Hierarchy

Squint test: with blurred vision can you still name the primary, secondary, and the groupings? If it's one flat band, fix it.

- Use the **fewest dimensions** that read — space and weight alone often carry it. Generous whitespace around an element draws the eye before any colour does.
- The strongest hierarchy stacks 2–3 at once: a heading that is larger, heavier, **and** has more space above it reads primary without trying. Make the type jump obvious — hero ≥ ~2× body and heavy; labels small, muted, slightly tracked.
- Group by proximity and separation, not by wrapping everything in a box.

## Cards are the lazy answer

- Use a card only when it's genuinely the best affordance — content that's truly distinct and individually actionable. Spacing, dividers, and alignment group things just as well, without the chrome.
- **NEVER nest a card inside a card** — the detector flags it. Use spacing and a hairline divider for hierarchy *within* a card.
- Don't ship the **identical card grid** everywhere (same icon + heading + text, cloned). Vary sizes, span columns, or mix cards with non-card content.
- Cap card radius ~12–16px (pills fine); ≥24px reads as over-rounded slop.

## Z-index — a semantic scale, never 9999

Stack on named layers so overlays compose predictably. Define once in tokens / design-system CSS and reference the var:

```css
:root {
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-modal-backdrop: 30;
  --z-modal: 40;
  --z-toast: 50;
  --z-tooltip: 60;
}
```

`z-[var(--z-sticky)]` on the header, `z-[var(--z-modal)]` on a dialog. A reflexive `z-[9999]` is a guess that collides with the next one — never reach for it.

## Device-frame awareness

The screen lives in a phone / tablet / web frame inside an iframe. Design for the frame, not an abstract page:

- **Fill the frame.** A list/feed fills top-down; a short / confirmation / empty-state screen **centers** its content (the floor stops the dead band, but you still compose it centered).
- **Sticky/fixed bars survive `overflow-x: clip`** (clip, not hidden) — a sticky top bar or a fixed bottom CTA holds. On `ios`/`android`/`ipad` with chrome, the bar must carry the safe-area inset (≈48/28px ios) or it hides under the clock / home pill.
- **A web/desktop prototype at phone size gets browser chrome** (Safari-style, not a native status bar) — so a responsive site must work all the way down to mobile width. Its `safeArea` colour paints that browser status bar.
- **Test at phone AND web.** `web`/`desktop` render at ~1280px so `md:`/`lg:` fire; phone frames at ~390px. The same screen must hold at both — a `lg:grid-cols-4` that collapses to `grid-cols-1` on phone, not a desktop layout crammed into 390px.

## No text overflow

The viewport is part of the design — test heading copy at every frame width.

- A long heading wraps (the floor guarantees it won't blow out sideways), but verify it doesn't shove a button off-screen or collide with an adjacent element at 390px.
- Truncate where wrapping is wrong (`truncate` on a single-line label, `line-clamp-2` on a card title) — decide per slot, don't let it run.
- Test real copy, not "Title" — a real product name is longer than the placeholder you wrote it with.

## Vary the screen shape

The biggest "templated" tell across a multi-screen build is **structural**, not colour — every screen shares the same header+grid fingerprint. Arta's self-review scores Variety by *structural* distance. Match each screen's shape to its job, and make consecutive screens differ in shape:

- Dashboard/bento, master–detail/split, feed/timeline, index/browse, detail/profile, workbench/canvas, stepped flow/wizard, focused/empty-state, table/data-dense.
- **Name the shape before you build the screen.** Two feed screens back to back is the trap; a feed then a detail then a split reads as a real product. See the shape menu and component archetypes in SKILL.md and [component-cookbook](../component-cookbook.md).

## Verify

- **Squint** — primary / secondary / groupings legible blurred?
- **Rhythm** — a beat of tight and generous spacing, not one even gap?
- **Fill** — no dead band; short screens centered, lists top-down?
- **Frame** — holds at phone *and* web; sticky bars clear the chrome; no copy overflow at 390px?
- **Variety** — does this screen share a fingerprint with another? Rework if so.
- **Slop** — no nested cards, no side-stripe, no identical card grid, no `z-[9999]`.

When rhythm and hierarchy land, the [motion](motion.md) pass earns its place.
