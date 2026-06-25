# Interaction & state

Load this when a screen has interactive parts — buttons, forms, nav, selectable items, anything the dev clicks.

Arta builds **clickable** prototypes: interactivity is the whole point, but there is no backend. Believable interaction comes from **mock state** — `data-to` to move between screens, `data-bind`/`data-show` reading a flat `store`, `data-inc`/`data-set` to bump it. Wire the real flow so the dev can *walk* it, not poke a dead mock. See [motion](motion.md) for timing, [layout](layout.md) for where controls sit, [product](register-product.md) for what the flow is.

## The state set — ship the whole thing, not half

Every interactive component carries its full state set. The common miss is shipping default + hover and forgetting the rest.

- **default** — base, at rest.
- **hover** — pointer only; keyboard users never see it. Subtle: a tint shift, not a transform jump.
- **focus** — keyboard ring. The platform enforces a `:focus-visible` fallback ring — **rely on it, never `outline:none` it away.** Don't fight it.
- **active** — pressed; darker/inset.
- **disabled** — `disabled:opacity-55 disabled:cursor-not-allowed`, no pointer.
- **selected / active-item** — see below; this is the one most often shipped broken.
- **loading** — skeleton for content, inline spinner for an action button. Never a centred page spinner over a layout you could skeleton.
- **error** — red border + inline message + icon, in a reserved slot so it doesn't shove the layout.

Hover and focus are *different states*. Design both. A row with a hover tint and no focus style is half-built.

## The selected state must be genuinely filled

The self-review calls this out by name: a selected item needs an **unmistakable** change — shift the **fill** (a real tint), use a **solid control** (a filled radio/check, a filled chip), never a faint ghost-outline. A border-only or pale-outline "selected" is nearly invisible on dark themes — the dev can't tell what's chosen.

- **Never** mark selection/active with a thick coloured `border-left` stripe — that's the banned side-stripe, and an active nav row / list row is exactly where the reflex sneaks in. Tint the background instead (optionally a 1px full border or `box-shadow: inset`).
- Nav active state comes for free: `data-nav="screenId"` adds `.is-active` to the matching link — style it with a filled tint, not a stripe.

A selected chip (filled, not outlined):

```html
<button class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-[var(--color-accent-ink)]">
  <i data-lucide="check" class="h-3.5 w-3.5"></i> Online
</button>
<button class="rounded-full border border-[var(--color-line)] px-3 py-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">In person</button>
```

## A button, all states, wired

The whole state set lives in the class list; `data-to` makes it actually go somewhere:

```html
<button data-to="checkout"
  class="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-55">
  <i data-lucide="arrow-right" class="h-4 w-4"></i> Continue
</button>
```

- `transition-colors`, never `transition-all` (slop tell). Keep the move quick — see [motion](motion.md).
- Don't remove the focus ring; the platform's fallback handles keyboard focus for you.

## Wire the real flow — make it click

A prototype the dev can't walk is a dead mock. The six attributes are the **entire** interactivity contract:

- `data-to="screenId"` — the **only** navigation. Put it on any clickable element (button, card, row, nav link). Do **not** use `<a href>` (the runtime intercepts it back to the screen list), `onclick`, or any router.
- `data-inc="cart"` / `data-dec="cart"` — bump a numeric store key ±1.
- `data-set="step=2;open=1"` — set store keys on click (numbers auto-parse).
- `data-bind="cart"` — element's text mirrors the live store value.
- `data-show="cart"` / `data-show="step==2"` — show only when truthy/equal.

Wire `data-to` between the **key screens** of the primary flow (home → detail → checkout → confirm) so the dev walks it end to end. A live store value, end to end:

```html
<button data-inc="cart" class="...">Add to cart</button>
<a data-to="cart" class="relative ...">
  <i data-lucide="shopping-cart" class="h-5 w-5"></i>
  <span data-bind="cart" data-show="cart" class="absolute -right-1 -top-1 rounded-full bg-[var(--color-accent)] px-1.5 text-xs font-semibold text-[var(--color-accent-ink)]">0</span>
</a>
```

Cheap stateful UI without a backend: a tab switch is `data-set="tab=runs"` + `data-show="tab==runs"`; a "show more" is `data-set="expanded=1"` + `data-show="expanded"`.

## Forms

- **Labels, not placeholders.** A `<label>` is visible; a placeholder disappears on input. Placeholders show *format* ("northwind"), never the field name.
- **Reserve the helper/error slot** (`min-h-[1rem]`) so an inline error doesn't shove the layout. Error = `border-red-500` + `text-red-600` helper + icon; keep border width 1px (colour carries the state, not a width jump).
- **Believable states over a real backend** — show the error / empty / loading state inline with mock state (`data-show="error"`), don't pretend to submit.
- **Skeletons over centre spinners** — a skeleton previews content shape and reads faster.
- Touch targets **≥44px** on phone frames (`py-2.5`+); buttons on a form share the input's height.

Field with focus / error / disabled built in — see the cookbook's F1; reuse it rather than re-deriving the focus ring.

## Navigation patterns

Pick deliberately, don't repeat the same one everywhere (see the [cookbook](../component-cookbook.md) § 1 for ready parts):

- **Side rail** (icon+label) — the app default, desktop apps with 4–9 destinations.
- **Bottom tab bar** — `ios`/`android` frames; pad for the home indicator; active tab = accent icon+label.
- **Command palette / ⌘K** — power tools; a pill that *reads* like a shortcut, not a fake search bar.
- **Top bar** — marketing/content only.

Factor shared nav into `prototype.layout` + `prototype.components` — never paste it onto each screen.

## Dropdowns & overlays — the clipping trap

Arta sets `overflow-x: clip` globally, and device frames clip too. A dropdown rendered `position: absolute` inside an `overflow:hidden`/`clip` ancestor **gets clipped** — the single most common overlay bug here. Escape the stacking context:

- **Native `<dialog>`** — `showModal()` traps focus, Escape closes, it lands in the top layer above all clipping.
- **Popover API** — `<button popovertarget="menu">` + `<div id="menu" popover>` puts the menu in the top layer; light-dismiss, no z-index wars, no clipping.
- **`position: fixed`** — escapes ancestor `overflow` clipping; set coordinates from the trigger.

Don't reach for `position:absolute` inside a card and hope.

## Modals are usually laziness

Exhaust the inline / progressive alternatives first:

- A confirm? **Undo beats confirm** — remove from the UI immediately, show an undo affordance (`data-set` a toast on), keep confirmation only for the truly irreversible.
- A detail? Try a **master–detail split** or an expand-in-place (`data-show`) before a modal.
- A form? Often it's a **step** in a stepped flow (a `data-set="step="` spine), not a popup.

When a modal *is* right (a focused destructive confirm, a genuine interrupt), use native `<dialog>` so focus and dismiss are handled and it clears the frame clipping.

## Micro-interactions

Convey state, stay quick. A press, a tint shift, a check appearing — fast and purposeful, never decorative. Use `transition-colors` and short durations; full guidance in [motion](motion.md). A uniform hover-scale on every card is a slop tell — let the state read through colour/fill, not a wobble.

---

**Avoid**: removing the focus-visible ring · placeholders as labels · ghost-outline "selected" state · side-stripe active rows · `position:absolute` dropdowns inside clipped containers · `<a href>` for nav (use `data-to`) · centre spinners where a skeleton fits · touch targets <44px · a mock that doesn't actually click through.
