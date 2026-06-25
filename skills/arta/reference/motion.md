# Motion

Load this when a screen needs to move — a press needs feedback, a panel needs to open, a list needs to arrive, or a brand surface earns a real entrance. Motion is part of the build, not a polish pass bolted on at the end.

## The one rule that comes first here

Arta captures screens as **headless / snapshot renders** (`arta_get_screenshot`, the export, a hidden tab). Transitions and animations **pause** on a hidden tab and in a headless render, so anything that *gates content visibility* on a class firing ships **blank** in the snapshot — the dev opens the screen and sees nothing.

- **Reveals ENHANCE an already-visible default. They never hide content until a class fires.** Default state = the content, fully visible, in place. The animation moves it *from* there (a few px up, a touch of opacity), it doesn't create it.
- ❌ `opacity-0 translate-y-4` baked into the markup, waiting for an `.in` class — that's a blank screenshot.
- ✅ content visible by default; a keyframe nudges it on load. If JS adds the class late, the worst case is "no animation," never "no content."
- This is non-negotiable on every screen the dev reviews via screenshot — which is all of them.

## Register — how much motion, and when

- **Product (most Arta builds):** motion conveys **state**, never decoration. Four jobs only — **state change · feedback · loading · reveal**. Nothing else moves. **150–250 ms** on most transitions; users are mid-task and won't wait for choreography. **No page-load sequence** — the screen loads *into* a task, not into a show. See [register-product](register-product.md).
- **Brand:** can afford **one** well-orchestrated page-load or typographic choreography — when the surface invites it (a landing, a launch, a hero). One rehearsed entrance beats scattered micro-interactions. The tell is the uniform reflex: fade-and-rise on *every* scrolled section. That's not choreography, it's scaffolding. See [register-brand](register-brand.md).
- Either way: spend the budget on the moments that need it. Animation fatigue is a real cost.

## Easing — exponential ease-out, never bounce

- **Ease-out with an exponential curve.** It decelerates into place: confident, decisive, done. Define once in tokens, reference everywhere.

```css
:root {
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);   /* smooth */
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);  /* snappier */
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);   /* most decisive */
}
```

- **No bounce, elastic, spring, or overshoot on UI.** They draw attention to the animation itself and read dated. `arta_design_review` flags `cubic-bezier(…, 1.5+)` overshoot and `animate-bounce` — they fire on a real screen, fix every one.
- Plain `ease-out` is acceptable for a quick state flip; reach for the exponential curves for anything the eye tracks (a panel, a reveal, a moving indicator).
- **Exits run faster than entrances** — ~75% of the enter duration.

## Duration

| Window | Use | Example |
|---|---|---|
| 100–150 ms | instant feedback | button press, toggle, color shift |
| 150–250 ms | state change | menu open, tab switch, hover, tooltip |
| 250–400 ms | layout-ish change | accordion, drawer, modal |
| 400–600 ms | brand entrance only | hero reveal, page-load choreography |

Under ~80 ms reads as instant — aim there for micro-feedback. Over 500 ms on feedback reads laggy.

## Animate the right properties

- **Animate `transform` and `opacity`.** They're composited — smooth at 60fps. Add **`filter`/`blur`**, **`clip-path`/`mask`**, **`box-shadow`**, **color** when they *materially* help (a focus pull, a wipe, an affordance lift) and you've verified they're smooth on the frame.
- **Never animate layout properties** — `width`, `height`, `top`, `left`, `padding`, `margin`. They trigger reflow and jank. Expand/collapse via `grid-template-rows: 0fr → 1fr` or a `transform: scaleY`, not `height`.
- **Name the properties in every transition.** `transition: all` / `transition-all` animates unknown properties and is jank-prone — `arta_design_review` flags it. Spell out what moves.

```html
<!-- ✅ named properties, composited, exponential ease-out -->
<button class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-white
               transition-[transform,opacity] duration-150 ease-out
               active:scale-[0.97] active:opacity-90">
  Save changes
</button>
```

## Reveal that survives the snapshot

Content visible by default; the keyframe moves it *from* an offset *to* its resting place. If the animation never runs (headless, reduced-motion), the resting state is what's already on screen.

```css
@keyframes rise {
  from { opacity: 0.6; transform: translateY(8px); }
  to   { opacity: 1;   transform: none; }
}
.reveal { animation: rise 250ms var(--ease-out-quart) both; }

/* REQUIRED — every animation needs a reduced-motion alternative */
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; }            /* instant; content was already visible */
}
```

The `from` starts at `opacity: 0.6`, not `0` — even mid-animation the content reads. Never start a reveal at `opacity-0` baked into the markup.

## Staggering a list

- **Staggering items in ONE list is legitimate** — cards in a grid, rows arriving. Drive it with a custom property, cap the total:

```html
<li class="reveal" style="--i:0">…</li>
<li class="reveal" style="--i:1">…</li>
```
```css
.reveal { animation-delay: calc(var(--i, 0) * 50ms); }
```

- **Cap it:** 10 items × 50 ms = 500 ms total. More items → smaller per-item delay or cap the staggered count. The same reduced-motion guard kills the delay too.
- **The tell is the uniform reflex** — one identical fade-and-rise on *every* section of *every* screen. A list arriving is motion with a job; a whole page fading in on scroll is decoration wearing its costume.

## prefers-reduced-motion is required, not optional

- **Every** animation needs a `@media (prefers-reduced-motion: reduce)` alternative — a crossfade or an instant cut. Omitting it is an accessibility failure, not a stylistic choice.
- A blanket guard at the top of the design system covers transitions you'd otherwise miss:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Per-animation overrides (a clean crossfade instead of a slide) still beat the blanket cut where the motion carried meaning.

## Hover, and the things that should sit still

- **No `hover:scale-*` repeated uniformly across elements.** One card lifting on hover is fine; the same `hover:scale-105` on every card, button, and tile is the uniform reflex — `arta_design_review` flags two or more. Vary the affordance or drop it.
- **Imagery sits still.** A hover transform on a photo / cover / thumbnail is a tell — let the image be the image. Lift the *card* (a subtle shadow or 1–2px translate) if anything, never zoom the picture.
- Press feedback is the highest-value micro-interaction: `active:scale-[0.97]` on a button, 100–150 ms, costs nothing and makes the prototype feel real. See [interaction](interaction.md).

## Quick checklist before handoff

- Reveals enhance a visible default — nothing gated on a class, no `opacity-0` waiting in the markup (it'd snapshot blank).
- Easing is exponential ease-out; **no** bounce / elastic / overshoot.
- Durations: 150–250 ms product; a single longer entrance only on a brand surface.
- `transform`/`opacity` (+ blur/clip-path/shadow where they earn it); **no** layout-property animation.
- Properties named in every transition — **no** `transition: all`.
- A `prefers-reduced-motion: reduce` alternative exists for every animation.
- No uniform `hover:scale-*` across elements; no image hover-transform.
- Run `arta_design_review` and clear every motion finding it surfaces.
