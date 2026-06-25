# Critique rubric

Load this when you run the pre-emit self-critique — the deep version of SKILL.md's "score before you look": the per-screen scorecard you self-run on every screen you touch, *before* you hand it back.

This is **taste**, not the detector. `arta_design_review` catches the absolute tells (gradient text, side-stripe, cream bg…) — black-and-white, fix-every-error gates. The rubric catches the thing the detector *can't*: a screen that passes every gate and is still **competent-but-generic** — clean, on-spec, and indistinguishable from any other build of its category. The detector says "no slop"; the rubric says "is this *designed*, and is it *this* product." Run both, every screen.

## How to score

- Six axes, each **1–5**. Score the build you just made, **honestly, BEFORE you open the screenshot** — you're scoring your own intent and execution, not grading on a curve.
- **Anything < 3 triggers a revision pass.** A 3 is "fine"; a 4 is "designed"; a 5 is "this couldn't be anyone else's product." Aim for 4s.
- Most first drafts score 2–3 on Specificity and Variety and 3–4 on the rest. That's normal — that's what the revision pass is for.
- Be the design director, not the author. "Would I ship this as the reference example for this category?" If no, find the axis dragging it down.

## Philosophy — is there a *why*, or just a layout?

Does the design take a position, or did you assemble defaults that happen to render?

- **1** — no point of view. Generic shell: nav + hero + cards + CTA because that's what pages have. Nothing about it argues for anything.
- **3** — a coherent layout that serves the task, but the *why* is implicit. It works; it doesn't say anything.
- **5** — a clear stance you could state in one sentence ("a dense ops console that trusts an expert," "an editorial product that reads like a magazine, not an app"). Every big choice traces back to it.
- **Arta tells:** you can't name the design's position in one line → it has none. The one-line **visual direction** / scene sentence from the brainstorm should be *visible* in the pixels; if the screen would fit any scene sentence, it has no philosophy. Register mismatch is a philosophy failure — a task surface dressed as a marketing page, or vice versa ([product](register-product.md) / [brand](register-brand.md)).
- **Fast fix:** re-read the scene sentence; pick the *one* thing this product believes (speed? trust? craft? density?) and make the loudest element on the screen serve it. If nothing changes, the layout had no thesis.

## Hierarchy — primary / secondary / tertiary in 2 seconds?

Squint at the screenshot. Can you tell what matters most before you can read it?

- **1** — one flat band. H1, card titles, metric values and body all collapse into one size; everything is equally loud, so nothing leads.
- **3** — a primary element reads, but secondary vs tertiary blur; the eye finds *a* anchor but then wanders.
- **5** — instant three-level read: one clear focal point, a supporting tier, a muted rest. The layout walks your eye.
- **Arta tells:** type-scale jump too timid (hero < ~2× body, not heavy) — the #1 flattener; labels not small/uppercase/muted/spaced; the accent on five things so it ranks nothing; equal-weight card grid with no size variation. Fix by widening the scale's extremes and cutting competing emphasis ([typography](typography.md)).
- **Fast fix:** push the display size up (48px+ hero over an 11px muted label is a real scale) and *demote* everything that isn't primary — mute it, shrink it, or remove it. Hierarchy is as much about what you quiet as what you amplify.

## Execution — are the details in spec, or sloppy?

The bones can be right and the craft still cheap. This is the floor the detector enforces — but the rubric goes past "no tells" to "actually clean."

- **1** — visible slop and sloppiness: misalignment, dead white band, inconsistent spacing, broken contrast, gray placeholder boxes, the detector lighting up.
- **3** — detector-clean and roughly aligned, but the rhythm is off: spacing not on one scale, accent footprint random, focus rings missing, radius/shadow drifting between screens.
- **5** — tight: one spacing rhythm, consistent radius/shadow/motion, contrast ≥4.5:1, real images, accent present in 3+ places on purpose, alignment to a grid, states (hover/focus/active/selected) all read.
- **Detector floor (every one of these is a fix-it `error` or `warn` — score can't exceed 2 while any `error` stands):** gradient text, coloured side-stripe border, stripe-gradient bg, cramped tracking (`tracking-tighter`), nested cards, 1px-border+wide-shadow ghost card, cream/warm-off-white background, AI purple/indigo palette, unchanged kit accent, emoji-as-icon, italic heading, over-rounded card (≥24px), `transition:all`, uniform hover-scale, placeholder names, dead image host, brand-icon-in-lucide (blank), mixed icon libs, em-dash overuse, marketing-buzzword copy. **`arta_design_review` finds these — but passing it is the floor, not the ceiling.** A detector-clean screen still routinely scores 3 here.

## Specificity — *this* product, or anyone's?

The core axis. Could you drop this screen into a competitor's app and have no one notice? Then it's generic. This is where the **category-reflex check** lives — run it before you commit the design system, and re-confirm per screen.

- **The reflex check (both must be NO):**
  - **First-order** — could someone guess the palette + type from the **category alone**? "fintech → navy + gold," "AI tool → cream + purple," "dashboard → dark + indigo," "wellness → sage + rounded sans." If yes, it's the training-data reflex — rework it.
  - **Second-order** — could they guess it from the category **plus the obvious anti-move**? "the AI tool that's *not* cream → editorial italic-serif," "the fintech that's *not* navy → brutalist mono." If yes you only dodged the first reflex; keep going until **neither** is predictable.
- **1** — first-order guessable. The category template with the brand name swapped in.
- **3** — dodged the first reflex but landed on the obvious anti-move (second-order guessable), or distinctive tokens that the screen layout doesn't actually express.
- **5** — neither reflex predicts it. Anchored to a concrete **scene sentence** (who uses it, where, in what light/mood — "a night-shift dispatcher in a dim ops room," never "modern and clean"), and you can name **2–3 ways this build looks unlike the generic version of its category**, visible in the pixels.
- **Arta tells:** kit set but only the brand name swapped (same skin every build); kit's literal example accent left unchanged (the detector flags this one); beige-plus-one-accent on a bold brief (a hedge, not a decision); tokens are distinctive but every screen is still the category's default chrome. Pick the colour strategy on purpose — restrained / committed / full-palette / drenched — and give the project its **own** accent hue ([color](color.md)).
- **Fast fix:** name the generic version of this category out loud, then change three concrete things away from it — the accent hue, the type pairing, and one structural move. If you can't name three, you haven't escaped the template.

## Restraint — has everything not earning its place been cut?

More is the easy default. The discipline is subtraction.

- **1** — decoration everywhere: gratuitous gradients, glassmorphism, eyebrow + number markers on every section, redundant chrome, padding-for-padding, three weights of shadow.
- **3** — nothing egregious, but elements are present "because pages have them" — a footer the app doesn't need, a search bar that searches nothing, a stat row that pads the hero.
- **5** — every element earns its pixel; remove any one and the screen is worse. Generous whitespace, one confident accent, no scaffolding-for-its-own-sake.
- **Arta tells:** tiny uppercase tracked eyebrow above every section; 01/02/03 section numbers as default scaffolding; identical card grid repeated to fill space; a marketing footer (4 columns + social row) bolted onto an app screen; decorative blur with no purpose. App screens usually need **no** footer — a slim status strip at most.
- **Fast fix:** go element by element and ask "does removing this make the screen worse?" — delete every "no." Then add whitespace where you deleted; restraint reads as confidence, not emptiness.

## Variety — does this screen share a *structural* fingerprint with another?

Measured in **structural distance, not colour**. The #1 reason a multi-screen build reads "templated" is that every screen is the same shape (hero → 3 cards → CTA, or six identical vertical card-lists).

- **1** — every screen is the same shape; you can't tell two apart from their wireframes.
- **3** — screens differ in content but two or more share a skeleton (same header + same single-column card list).
- **5** — each screen's **shape matches its job** and consecutive screens differ structurally: a dashboard is a bento of varying tiles, a list is a feed of heterogeneous items, a detail is a hero + sections, a flow is a stepped spine, an empty/focused screen is centered with no dead band.
- **Arta tells:** **name the shape before you build each screen** — dashboard/bento · master–detail · feed · index/browse · detail/profile · workbench · stepped flow · focused/empty · table/data-dense · marketing. If you'd name the same shape twice in a row, change one. Same nav on every screen is fine (factor it into a component); same *body skeleton* on every screen is the failure.
- **Fast fix:** for the repeated screen, pick a different shape from the menu that still fits its job — a list that was a card-grid becomes a feed or a table; a confirmation that was top-aligned becomes a centered focused state. Vary the *skeleton*, not the paint.

## Workflow — score, then look, then fix

The order is load-bearing. Score blind first so you're judging *intent*, not rationalizing pixels.

1. **Score blind.** Rate all six axes 1–5 from what you *meant* to build — before any screenshot. Honesty here is the whole game; a generous blind score just hides the work.
2. **Read the pixels.** `arta_get_screenshot` (default `chrome` engine = content; `client` engine only for the device-fit / safe-area question). Actually read the image — hierarchy, contrast, spacing, images, overlap, dead band. Re-score any axis the pixels contradict.
3. **Run `arta_design_review`.** The detector is your Execution floor. Fix every `error`; judge `warn`/`info` in context. A standing `error` caps Execution at 2.
4. **Fix anything < 3, then re-check.** Revise the offending axis and re-shoot. **Two passes is normal.** A **third pass means the DIRECTION is wrong** — you're polishing pixels on a flawed premise. Stop tweaking; rethink the philosophy/specificity (re-run the scene sentence and reflex check), or take it back to the dev. Don't grind a 2 into a 3 on a design that shouldn't exist.
5. **Only hand back a screen that clears the bar.** Then one line on what to react to.

## Rubric vs `arta_design_review` — division of labour

- **`arta_design_review` = absolute tells.** Deterministic, offline, no judgment. A finite list of things that are *always* wrong (the Execution-floor list above). Binary: present or not. It cannot see "generic."
- **This rubric = taste & distinctiveness.** Judgment across six axes. It catches the competent-but-generic screen that passes every gate — the one that's clean, on-spec, and could be anyone's. Specificity and Variety especially have **no detector equivalent**; they're yours to score.
- **Both run every screen.** Detector first as the floor (nothing slips), rubric as the ceiling (is it *designed*). A screen that's detector-clean and rubric-flat is the exact failure mode this doc exists to catch.

## Worked example — a settings screen that passes the detector and still fails

A dark settings page: indigo accent, clean card list of toggles, consistent spacing, no detector findings. Looks fine. Score it:

- Philosophy **2** — no position; it's "settings, dark." Hierarchy **3** — readable but flat, every row equal weight. Execution **4** — detector-clean and tidy. Specificity **1** — "dashboard → dark + indigo" is the first-order reflex; this is the template. Restraint **3** — a search bar that searches six toggles. Variety **2** — same single-column card-list as three other screens.
- Two axes < 3 → revise. Specificity drives it: dark+indigo is the guess, so change the accent hue and tint the neutrals to the brand; re-score after. Variety: make settings a master–detail split (categories rail + detail pane) so it stops echoing the feed screens. Restraint: cut the search bar. Re-shoot, re-score. If Specificity still won't clear 3 after a colour+structure pass, the *direction* is the dark-indigo template — rethink it, don't keep nudging.

## The scorecard (run per screen)

```
Screen: <id>
  Philosophy   _/5   — clear position, or just a layout?
  Hierarchy    _/5   — 3-level read in 2 seconds?
  Execution    _/5   — detector-clean AND tight (rhythm, states, alignment)?
  Specificity  _/5   — reflex check: 1st-order NO · 2nd-order NO?
  Restraint    _/5   — everything earns its pixel?
  Variety      _/5   — shape matches job, differs from neighbours?
Any axis < 3 → revise that axis, re-shoot. Pass 3 → rethink the direction, not the pixels.
```
