# Imagery

Load this when you're deciding what goes in an image slot — a hero, a card cover, an avatar, a gallery — or fixing a screen that's all text-and-cards where photos belong.

A prototype that *implies* imagery and ships none reads as unfinished, not restrained. A flat gray rectangle where a photo belongs is the loudest "an AI made this" tell — it makes every other decision look provisional. The platform gives you a safety net (a failed `<img>` degrades to a brand-tinted shimmer skeleton, never the broken-image glyph), but the net is for the rare 404, not a design strategy. The agent decides each slot deliberately: a real photo, or an *intentional* skeleton/cover surface. See [colour](color.md) for the tokens these surfaces tint from, and [brand](register-brand.md) for when the surface IS the design.

## Ship imagery when the brief implies it

- **Restaurant, hotel, travel, food, fashion, product, photography, real-estate, hobbyist** — these briefs *imply* imagery. Zero images is a bug, not restraint. "Clean and minimal" is not an excuse to ship a text-only page where a photo carries the mood.
- **A flat `bg-[#…]` block standing in for a photo is banned.** Either a real image, or a deliberate brand-tinted surface (below). Never a lone solid fill — `arta_design_review` reads it as slop.
- **"Imagery" is broader than stock photos** — a product screenshot, a generated SVG scene, a canvas gradient, a custom data-viz all count. A text-only screen where typography carries the entire visual weight is the failure mode, not the goal.
- **One decisive photo beats five mediocre ones.** A hero commits to a mood; padding it with more stock doesn't rescue an indecisive choice. Vary real cards (real titles, prices, alt) — never the same card cloned five times.

## Real images — sources that actually resolve

Verified working (June 2026). Always size the slot (`w`/`h` or an `aspect-[…]` wrapper) + `object-cover` so layout doesn't shift when the image loads.

- **Unsplash — the default.** `https://images.unsplash.com/photo-<REAL-id>?w=<W>&q=70&auto=format`. Needs a *real* photo id — a guessed id (even a plausible-looking one) 404s. If you have a browser or fetch tool, **verify the id resolves** before shipping it.
- **loremflickr — when you have no specific id.** `https://loremflickr.com/<W>/<H>/<keyword>` returns a live keyword-relevant photo. Add `?lock=<n>` to keep the same image across reloads.
- **Dead — the detector flags these.** `picsum.photos` and `source.unsplash.com` are both retired; every URL times out into a blank/skeleton tile. `arta_design_review` raises `dead-image-host` on either. Don't reach for them out of habit.
- **The safety net is not a strategy.** A failed `<img>` swaps to `.hs-img-skeleton` automatically — so a single dead URL never shows a broken glyph. But a *screen full* of skeletons is still a failing screen. Pick sources that resolve.

## Search the physical object, not the category

The keyword decides whether the photo looks chosen or stock-bin generic.

- **"hand-cut pasta on a scratched walnut table"** beats "Italian food". **"cypress above a limestone hotel facade at dusk"** beats "luxury hotel". Name the object, the surface, the light.
- **Alt text is part of the voice**, not an afterthought. `alt="Coastal fettuccine, hand-cut, on the terrace"` beats `alt="pasta dish"`. Write it like a caption the brand would ship.

```html
<figure class="overflow-hidden rounded-2xl">
  <img
    src="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=70&auto=format"
    alt="Hand-cut tagliatelle resting on a flour-dusted walnut board"
    class="aspect-[4/3] w-full object-cover"
    loading="lazy" />
</figure>
```

## Intentional placeholders — when a real photo isn't right

Avatars, logos, an icon slot, or a subject that must match where you have no trustworthy URL. Make the placeholder *read as a decision*, not an empty box.

- **`.hs-cover`** — a brand-tinted gradient surface for an image slot (a card cover, a hero band). It reads `--color-primary` / `--color-brand` / `--color-accent` from your tokens, so it's on-brand by construction. Lay a real `<img>` over it when you have one; on its own it's a deliberate surface, never a flat gray rectangle. Drop a centred lucide glyph or a monogram on it if the slot needs a hint of subject.
- **`.hs-img-skeleton`** — a brand-tinted shimmer loading tile. The same surface the safety net degrades a failed `<img>` to; use it deliberately for a known-loading state.

```html
<!-- card cover: brand-tinted surface, badges layered on top -->
<article class="w-64 overflow-hidden rounded-2xl bg-white shadow-sm">
  <div class="hs-cover relative h-32">
    <span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-medium text-white">
      <i data-lucide="play" class="h-3 w-3"></i>Online
    </span>
  </div>
  <div class="p-3">…</div>
</article>
```

- **Avatars = initials on a tinted chip**, never a broken headshot or a gray circle. Initials on a brand-tinted disc beat both every time.

```html
<span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-sm font-semibold text-[var(--color-primary)]">
  AB
</span>
```

## Icons are not images

- **UI glyphs = lucide.** `<i data-lucide="search" class="h-5 w-5 text-[var(--color-primary)]"></i>`. The SVG inherits `currentColor`. Never an emoji, never an `<img>` standing in for an icon.
- **Brand / social logos = Iconify simple-icons.** `<iconify-icon icon="simple-icons:instagram"></iconify-icon>` — lucide's core has no brand marks, so a `data-lucide="instagram"` renders a blank gap (the classic empty-footer-row tell).
- **Decorative "imagery" can be generated** — a tuned SVG scene or a canvas gradient is real imagery and ships zero network risk. Reach for it when a stock photo would only be filler.

## Bans

- Zero imagery on a brief that implies it (restaurant, hotel, food, travel, fashion, photography, hobbyist).
- A flat `bg-[#…]` / gray block where a hero photo belongs — the loudest slop tell.
- `picsum.photos` or `source.unsplash.com` — dead hosts; the detector flags them.
- A guessed Unsplash id shipped unverified when a browser/fetch tool was available to check it.
- A screen of skeleton tiles passed off as a finished design — the net catches 404s, it doesn't design the screen.
- A broken headshot or gray-circle avatar; an emoji or `<img>` doing an icon's job.
