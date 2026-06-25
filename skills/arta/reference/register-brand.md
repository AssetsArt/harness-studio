# Brand register

Load this when design IS the product: marketing sites, landing & campaign pages, portfolios, long-form / about pages, image-led consumer brands — where a visitor's impression is the deliverable, not a transaction.

## The register

This register spans every genre and they share one stance — *communicate, don't transact* — and diverge wildly in look. A tech brand (Stripe, Linear), a hotel or fashion house, a restaurant or travel site, a studio portfolio, a band's album page. Don't collapse them into one aesthetic. A brand surface earns **committed-or-louder** colour (see SKILL.md's commitment axis) where product UI floors at restrained — here the surface can *be* the brand.

## The brand slop test

The bar is distinctiveness. A visitor should ask **"how was this made?"**, not "which AI made this?" If someone could glance at this and say "AI made that" without hesitation, it failed.

Brand is not a neutral register. AI landing pages have flooded the web and average is no longer findable — restraint *without intent* now reads as mediocre, not refined. A brand surface needs a POV, a named audience, a willingness to risk strangeness. Go big or go home; safe = invisible.

- **Second test — name the aesthetic LANE.** Before committing moves, name the reference out loud: a Klim-style specimen page is one lane; Stripe-minimal another; Liquid-Death acid-maximalism another. Don't drift into editorial-magazine on a brief that isn't editorial. A hiking brand with Fraunces-italic drop caps has the wrong register *within* the register.
- **Inverse-competitor test.** In one sentence, describe what you're about to build the way a *competitor* would describe theirs. If that sentence fits the modal landing page in the category, restart.
- **Reflex-reject aesthetic lanes** (these still apply even though Arta's font list is fixed): **editorial-typographic** — display serif (often italic) + tiny mono labels + ruled separators + monochrome restraint, the Klim/magazine-cover affectation; the fingerprint is three rule-separated columns, an italic-serif headline, lowercase track-spaced metadata, zero imagery. Every Stripe-adjacent brand has landed here. If a brief lands in this lane *without a reason that requires it* (a literal magazine), it's the second-order reflex — the trap one tier past picking a default font. Look further. (Brutalist-utility and acid-maximalism join when they saturate.) When the *existing* brand already committed to a lane, identity-preservation wins — this is for greenfield choices.

## Typography

Arta's iframe loads exactly **five Latin faces** — Geist, Geist Mono, Instrument Serif, Fraunces, Space Grotesk — plus Noto Sans/Serif Thai. You cannot add a sixth. So distinctiveness here is **not** "find a rarer font"; it's the *pairing*, the weight/size contrast, which face fits the voice, and how it's used.

### Font selection procedure — every project, never skip

1. Read the brief. Write **three concrete brand-voice words** — physical-object words, not "modern" / "elegant": "warm and mechanical and opinionated", "calm and clinical and careful".
2. Map the voice onto the five faces as a *physical object*: Instrument Serif is a museum caption / a fashion masthead; Fraunces is a warm letterpress book; Space Grotesk is a concert poster / a spec sheet; Geist is the clean signage; Geist Mono is the receipt / terminal / data label.
3. Pick the **pairing on a contrast axis** — serif display + sans body, geometric + humanist, or **one family in many weights**. The pairing carries the distinctiveness the font catalog would in another tool.
4. Cross-check against reflex: "elegant" is not automatically Instrument Serif; "technical" is not automatically Space Grotesk + mono. If the pick lines up with your first reflex *and* the category default, start over.

### Pairing and voice

- **Two families only when the voice needs it.** A single well-chosen family with committed weight/size contrast beats a timid display+body pair. A category ("restaurant", "fintech") is not a recipe — treating it as one is the first-order reflex.
- **Mono is not free "technical" paint.** Geist Mono as lazy shorthand for "developer / technical" on a brand that isn't technical reads as costume. Earn it (real data, labels, numerics) or drop it.
- **For Thai (or any non-Latin) display text**, append the matching Noto face to the chain — `font-family: 'Fraunces', 'Noto Serif Thai', serif` / `'Geist', 'Noto Sans Thai', sans-serif` — or reserve the Latin display face for genuinely Latin runs. A Thai heading in a bare Latin face renders broken (collided tone-marks). Confirm in the screenshot.

### Scale

- Modular scale, fluid `clamp()` on headings, **≥1.25 ratio** between steps. Flat scales (1.1× apart) read as uncommitted — the #1 tell that "has a type scale but isn't using it". Hero ≥ ~2× body and heavy; labels small, muted, slightly tracked.
- Light text on dark: add **0.05–0.1** to line-height. Light type reads lighter-weight and needs more air.

## Colour

Tokens only — **no raw hex in a screen body**. Every colour is a `var(--color-*)` or a Tailwind class that maps to one; need a shade the kit lacks, add it to the tokens (`arta_set_design_tokens`), don't inline it.

Brand surfaces have permission for **committed / full-palette / drenched** — use it. A single saturated colour across a hero is not excess, it's voice; a beige-and-muted-slate landing page ignores the register.

- **Name a real reference before picking a strategy.** "Klim #ff4500 orange drench", "Stripe purple-on-white restraint", "Liquid Death acid-green full palette", "Vercel pure-black monochrome". Unnamed ambition decays into beige.
- **Give the project its OWN accent.** A kit's accent hex is an *example*; choose a fresh hue per project. The slop detector flags **cream backgrounds, generic AI purple/indigo, and a kit's literal accent left unchanged** — three of the loudest "an AI made this" tells.
- **Palette IS voice.** A calm brand and a restless brand must not share palette mechanics.
- **Committed/drenched → commit.** Don't hedge with neutrals around the edges; let colour carry the brand. Restrained still means *visibly present* — the accent in 3+ places (primary action **and** active state **and** a key highlight), neutrals tinted toward the hue, never flat `#fff`/`#000`.
- **Don't converge across projects.** Each brand surface differentiates from the last. Two builds must not share a palette because they share a register.
- **Reach past the obvious cultural-symbol palette.** Let the cultural reading come from type, imagery, and copy — not from painting the flag.

## Layout

- **Asymmetry is a tool** — break the grid intentionally for emphasis, don't centre everything by reflex.
- **Fluid spacing** with `clamp()` that breathes on larger viewports; vary the rhythm — generous separations, tight groupings.
- **Image-led briefs** (hotel, restaurant, magazine, photography) → full-bleed hero with overlaid nav and a headline set over the photo. Let the photograph *be* the design.
- **Breakpoint-free card grids** when cards are genuinely the right affordance: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`. For a peeking horizontal strip use the built-in `hs-rail`.
- **Build in `web`** (`prototype.frame`) for a marketing site so `md:`/`lg:` fire at desktop width — then make it work down to mobile.

## Imagery — required when the brief implies it

**Zero images on an image-led brief is a bug, not restraint.** A restaurant, hotel, magazine, or product page with no imagery reads as incomplete. A solid-colour rectangle where a hero photo belongs is worse than a representative stock photo — it makes every other decision read as unfinished. "Restraint" is not an excuse.

- **Search for the brand's physical object**, not the category: "handmade pasta on a scratched wooden table" beats "Italian food"; "cypress above a limestone facade at dusk" beats "luxury hotel".
- **Sources that resolve (verify the id):** Unsplash `https://images.unsplash.com/photo-<id>?w=<W>&q=70&auto=format` (a guessed id 404s — verify before shipping), or `https://loremflickr.com/<W>/<H>/<keyword>` when you have no specific id. **`picsum.photos` and `source.unsplash.com` are dead.** A failed `<img>` auto-degrades to a shimmer skeleton (never a flat gray box) — but a screen full of skeletons is still a fail, so use a source that resolves.
- **One decisive photo beats five mediocre ones.** Hero imagery commits to a mood; padding with more stock doesn't rescue an indecisive one. Always size the slot (`aspect-[…]` + `object-cover`) so layout holds.
- **Alt text is part of the voice** — "Coastal fettuccine, hand-cut, served on the terrace" beats "pasta dish".
- "Imagery" is broader than photos — a credible canvas/SVG/WebGL scene or a product mockup counts. A text-only page where type carries the *entire* visual weight is the failure mode.

A full-bleed hero that lets the photograph be the design, token-driven and slop-free:

```html
<section class="relative min-h-[88vh] overflow-hidden">
  <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=2000&q=70&auto=format"
       alt="Candlelit corner table at the pass, copper pans behind"
       class="absolute inset-0 h-full w-full object-cover" />
  <div class="absolute inset-0 bg-[var(--color-ink)]/45"></div>
  <div class="relative mx-auto flex min-h-[88vh] max-w-5xl flex-col justify-end gap-4 px-8 pb-16">
    <h1 class="display max-w-2xl text-[var(--color-bg)] text-[clamp(3rem,7vw,6rem)] leading-[0.95]">Dinner, from the fire</h1>
    <a data-to="reserve" class="inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-6 py-3 font-medium text-[var(--color-accent-ink)]">
      Reserve a table <i data-lucide="arrow-up-right" class="h-4 w-4"></i>
    </a>
  </div>
</section>
```

## Motion

One **well-orchestrated page-load** beats scattered micro-interactions — reveals and typographic choreography that earn their place, not fade-on-scroll on every section. Some brands skip entrance motion entirely; that restraint is the voice. Build it only when the brand invites it.

## Brand bans

- Defaulting to editorial-magazine (display serif + italic + drop caps + broadsheet grid) on a brief that isn't magazine-shaped. Editorial is ONE lane.
- A tiny uppercase tracked eyebrow above *every* section, or `01/02/03` numbered markers as default scaffolding. A single strong kicker can be voice; repeating it as section grammar is AI scaffolding.
- Large rounded-corner icons above every heading — screams template.
- Single-family pages where the family was picked by reflex, not voice. (A single family chosen deliberately is fine.)
- All-caps body copy. Reserve caps for short labels and display headings.
- Timid palettes and average layouts. Plus the shared slop bans (gradient text, side-stripe borders, glassmorphism-by-default, identical card grids, low-contrast text, over-rounded cards) — run `arta_design_review` and fix every **error**.

## Brand permissions — take them

- **Ambitious first-load motion** — typographic reveals that earn their place.
- **Single-purpose viewports** — one dominant idea per fold, long scroll, deliberate pacing.
- **Unexpected colour strategies** — drenched, full-palette; a calm brand and a restless brand should not share palette mechanics.
- **Art direction per section** — different sections can be different visual worlds when the narrative demands it. Consistency of *voice* beats consistency of *treatment*.

See also [colour](color.md), [typography](typography.md), [imagery](imagery.md).
