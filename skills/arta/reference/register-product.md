# Product register

Load this when the design SERVES the task — app UIs, dashboards, admin, settings, data tables, tools, authenticated surfaces, anything where the user is mid-task and the interface should disappear into the work.

## The product slop test

The test here isn't "would someone say an AI made this" — familiarity is a *feature*. It's: would a user fluent in the category's best tools (Linear, Figma, Notion, Raycast, Stripe) sit down and trust this prototype, or pause at every subtly-off control?

- Product UI's failure mode isn't flatness — it's **strangeness without purpose**: over-decorated buttons, mismatched form controls, gratuitous motion, display fonts where labels should be, invented affordances for standard tasks.
- The bar is **earned familiarity**. The tool should vanish into the task. Run `arta_design_review`, then look at the screenshot — a control that makes you *notice it* is the tell.
- A clickable prototype earns trust by behaving: every `data-to` lands, every selected row reads as selected, every state the real app has is on the canvas (loading, empty, error), not just the happy path.
- Concrete tell: a "Save" button with a gradient fill and a 28px radius next to a hairline native-looking input — two vocabularies on one form. Pick one shape and hold it everywhere.
- The dev *clicks* this. Wire the believable path with the store (`data-set`, `data-show`, `data-bind`) — a filter that does nothing, a tab that doesn't switch, a submit that goes nowhere all break the trust faster than any pixel.

## Typography

- **One family carries it all.** Product UIs don't need a display/body pairing — a well-tuned sans carries headings, buttons, labels, body, data. **Geist** is the natural default; **Geist Mono** for numbers, IDs, code, log lines. Set it once in tokens (`--font-body`), don't re-pick per screen.
- **No display faces in the UI.** Fraunces / Instrument Serif / Space Grotesk never touch a label, button, metric, table cell, or nav item — that's the loudest product tell. Reserve them (if at all) for a marketing/empty-state *moment*, never the working surface.
- **Fixed rem scale, not fluid.** A clamp-sized `h1` that shrinks inside a sidebar looks worse, not better — users sit at a consistent DPI. Use fixed steps (`--text-xs … --text-3xl`); no `clamp()` in product type. See [interaction](interaction.md).
- **Tighter ratio.** 1.125–1.2 between steps. Far more type elements here than on a brand surface — exaggerated contrast just makes noise. *Make the jump still read*: hero/metric ≥ ~2× body and heavy; labels 11px, muted, slightly tracked.
- **Line length applies to prose** (65–75ch for help text, descriptions). Data and compact UI run denser — a table at 120ch+ is fine; tabular numerals (`tabular-nums`, Geist Mono) for any column you'd sum or compare.

## Colour

Tokens only — never raw hex in a screen body. Product **floors at restrained**: tinted neutrals + one accent ≤10% of the surface. A single screen can earn committed (a report drenched in one category colour, a welcome screen), but restrained is the default. See [colour](color.md).

- **Give the project its own accent.** The kit's example hex is a starting point, not a default — `arta_design_review` flags an unchanged kit accent, cream bg, and AI purple/indigo. Pick a fresh hue and tint the neutrals toward it (a warm off-white, a cool slate); flat grays + pure `#fff`/`#000` read as an unstyled browser.
- **Full semantic STATE vocabulary** — every interactive control standardises: `hover · focus · active · disabled · selected · loading · error · warning · success · info`. Define them as tokens (`--color-accent`, `status-done`, `severity-high`, …) so a status badge is the same green on every screen — inlining the same `#hex` 10+ times is the classic data-app miss.
- **Accent earns its place: actions, selection, and state only — never decoration.** Primary action + active/selected + a key indicator (3+ places), not one lonely button and not a tinted panel for flavour.
- **A second neutral layer** for sidebars, toolbars, and panels — `--color-surface` slightly cooler/warmer than the content `--color-bg`, so chrome separates from content without a hard border everywhere.
- **No heavy/full-saturation colour on inactive states.** An unselected tab, a disabled button, a muted nav row are neutral; saturation means *active*.

## Layout

Responsive here is **structural, not fluid type**. The `web`/`desktop` frame previews at real desktop width, so `md:`/`lg:`/`xl:` fire exactly as in a browser — design the breakpoints, don't clamp the font.

- **Collapse the sidebar** to icons (or a sheet) below `lg`; the side rail (cookbook N1) is the app default — `data-nav` gives the active row for free, so it lives in `prototype.layout`, never pasted per screen.
- **Responsive tables** — stack to cards or hide non-essential columns at narrow widths; don't let a table scroll the whole page sideways.
- **Breakpoint-driven columns** — a bento dashboard reflows `grid-cols-1 → md:grid-cols-2 → xl:grid-cols-4`; tiles vary in size, not a uniform card grid.
- **Density when users need it.** Tables with many rows, panels with many labels — product can afford dense information the moment the user is comparing or scanning. Match the screen *shape* to its job (master–detail for settings, table for data, bento for a dashboard) — don't ship six identical card-lists.

## Components

**Every interactive control ships ALL its states** — don't hand over a button with only `default`. Assemble from [`component-cookbook.md`](../component-cookbook.md) so they're slop-free by construction.

- **Field** (cookbook F1): default · focus (an `outline` ring, not a width change) · error (red border + helper, layout reserved so it doesn't jump) · disabled. Focus is non-negotiable — Arta enforces a focus-visible ring fallback, so don't fight it.
- **Selected/active reads via FILL, not a border.** Tint the row/tab background (`bg-[var(--color-accent)]/10`); a filled radio/check, not a ghost outline. **Never a thick `border-left` accent stripe** — that's the banned side-stripe, and the active nav/list row is exactly where it sneaks in.
- **Skeletons, not centre spinners.** Loading shows the *shape* of what's coming (tinted `hs-img-skeleton` tiles, greyed rows), not a spinner floating in an empty pane. Mock it with `data-show` on a loading state.
- **Empty states that teach** (cookbook S1): centred (no dead band), a lucide glyph in a tinted disc (never a gray box), one sentence of what goes here, one clear action — not "Nothing here."
- **Consistent affordances across the surface.** Same button shape, same form-control vocabulary, same icon style — **lucide is the one stroke set** for UI glyphs (Iconify only for brand logos). If the "Save" button looks different on two screens, one is wrong.
- **Segmented control / filter row** (cookbook F2): selected segment is a filled tint, the rest are muted ghosts — not three outlined boxes.
- **Inline alert** (cookbook S3): a full subtle tint + icon for a contextual message — **not** a thick coloured side-stripe down the edge.
- **Status badge** (cookbook S2): a semantic-token tint + lucide glyph, identical across every screen the status appears on.
- **Failed images degrade to a skeleton** (Arta swaps a dead `<img>`), but a screen full of skeletons still fails — use a real Unsplash image or an intentional `hs-cover`, never a bare `bg-[#…]` block.

## Motion

Motion conveys **state, not decoration**. See [motion](motion.md).

- **150–250ms** on most transitions. Users are in flow — don't make them wait for choreography.
- **State change, feedback, loading, reveal — nothing else.** A hover tint, a panel sliding in, a row settling after a sort. Use `transition-colors`, **never `transition-all`** (a flagged tell).
- **No page-load choreography.** Product loads *into* a task — no staggered fade-up sequence on every screen; users don't want to watch it load. (And there's no real page-load on the canvas anyway — `data-to` swaps screens.)
- **Theme is built in** — `data-theme-toggle` flips `.dark`; if you support dark, give *every* screen dark styling, or one white screen reads as a bug.

## Product bans (on top of the shared absolute bans)

- Display fonts (Fraunces / Instrument Serif / Space Grotesk) in labels, buttons, data, nav.
- Decorative motion that conveys no state; `transition:all`; uniform hover-scale on cards.
- Inconsistent component vocabulary across screens — two "Save" buttons that disagree.
- Reinventing standard affordances for flavour — custom scrollbars, weird form controls, a non-standard modal where inline would do.
- **Modal as first thought.** Modals are usually laziness — exhaust inline / progressive / side-panel alternatives first (and Arta has no modal primitive; you'd fake it, which is a sign to reconsider).
- Heavy colour or full-saturation accents on inactive/disabled states.
- The category reflex: dashboard → dark + indigo, AI tool → cream + purple. Pick the palette on purpose, not from the training-data default.

## Product permissions

Product affords what brand surfaces can't — lean in.

- **Familiar system-grade sans** (Geist) as the default; the user *wants* it to feel like the tools they trust.
- **Standard navigation patterns** — side rail + content, top bar + sections, breadcrumbs, tabs, a ⌘K command palette (cookbook N1–N4). Familiar is correct here.
- **Density** — many rows, many labels, real tables, compact toolbars when the user is scanning or comparing.
- **Consistency over surprise.** The same visual vocabulary screen to screen is a virtue; delight is saved for *moments* (an empty state, a success confirmation), not sprayed across every page.
