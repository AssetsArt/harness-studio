# UX heuristics

Load this when a screen or flow is interactive — to audit it for **usability**, not looks. The six-axis self-critique and `arta_design_review` score craft and distinctiveness; they say nothing about whether the prototype *works*. A screen can be beautiful, detector-clean, score 5 on Specificity — and still leave the dev clicking a dead button, trapped in a flow, or guessing what a control does. This is the layer that catches that. Run it on every flow you'd hand back as clickable. Pairs with [interaction](interaction.md) (the state set), [accessibility](accessibility.md) (the a11y floor), [cognitive-load](cognitive-load.md) (signal vs noise), [critique-rubric](critique-rubric.md) (taste).

## How to run it

Two modes, like the source — same output shape both times:

- **CRITIQUE** — a built screen/flow you just made. Flag only the heuristics **violated or at-risk**; skip the ones that are clearly fine. Screenshot it (`arta_get_screenshot`), then *walk the flow in your head* — click every `data-to`, every control. The tells below are visible in pixels + markup.
- **DESIGN-GUIDANCE** — a new flow before you build. Surface the **few** heuristics that most shape this flow's core action, and translate each into a concrete wiring decision.

**Output shape (both modes):**

```
⚠️ Several usability gaps
H1 Visibility — the "Save" button has no state change; click looks dead. Add data-set + a toast.
H5 Error prevention — "Delete account" fires straight to a destructive data-to with no confirm.
## Priority actions
1. Wire feedback into the three primary data-to actions (dead clicks read as broken).
2. Gate the destructive action behind a confirm screen.
```

One-line verdict → only the relevant heuristics (one bullet each, name the Arta tell + the fix) → **max-3** Priority actions ordered by impact. Verdict scale: ✅ solid · ⚠️ several gaps · 🚨 the flow is broken to click. No essays, no listing heuristics that pass.

## The 10 heuristics — principle + the Arta tell

Each: the one-line rule, then *what to look for in the prototype you just built*.

- **H1 Visibility of system status** — the system always shows what it's doing. **Tell:** a `data-to` / `data-inc` action that produces **no** visible change — no nav, no `data-bind` value moving, no `data-show` toast, no skeleton — reads as a *dead click* and the dev thinks the build is broken. Every action either navigates, mutates the `store`, or flashes feedback. Async-feeling actions (submit, upload, "generating") need a `loading` state, not an instant jump. **Most common Arta usability miss — check it first.**
- **H2 Match the real world** — speak the user's language, not the system's. **Tell:** button/label copy that names the implementation (`Submit`, `Execute`, `Entity`, `Config`) instead of the user's verb (`Send`, `Pay $40`, `Invite`). Icons that don't match the mental model (a gear for "send"). Order things the way the domain orders them.
- **H3 User control & freedom** — a clear exit from anywhere. **Tell:** a flow you can enter but not back out of — a modal/sheet with no close `data-to`, a wizard with Next but no Back, a destructive step with no Cancel. Every overlay needs a dismiss; every step needs a way back; "undo" beats "are you sure" for reversible things.
- **H4 Consistency & standards** — the same action looks and behaves the same everywhere. **Tell:** the primary CTA is a filled accent button on screen A and a text link on screen B; "back" is top-left here, bottom there; two different "card" shapes for the same kind of item. Factor shared controls into a component and reuse it ([interaction](interaction.md)) — divergence here is both a usability and a Variety-axis failure. Follow platform convention (iOS back top-left, FAB bottom-right) unless you mean not to.
- **H5 Error prevention** — stop the error before it happens. **Tell:** a destructive `data-to` (delete, remove, cancel-plan, sign-out) that fires on the **first** click with no confirm screen or undo. Inputs with no constraint (free-text where a select belongs, no good default). Gate destructive actions; constrain inputs; prefer smart defaults over empty fields.
- **H6 Recognition over recall** — show, don't make them remember. **Tell:** a step that asks the user to retype/remember something shown earlier; a chosen value that vanishes from the next screen; options hidden behind a label with no affordance. Surface the selection (carry it via `data-bind` from the `store`), keep choices **visible** not memorized, label icon-only buttons.
- **H7 Flexibility & efficiency** — novice and expert paths both work. **Tell:** only a one-at-a-time path for a list that begs for bulk (no select-all, no batch action); no shortcut for the repeat task; no saved/recent. Don't clutter the novice screen — add the power path as a quiet secondary affordance.
- **H8 Aesthetic & minimalist** — every element competes for attention; cut what doesn't serve the task. **Tell:** the primary action buried under three secondary ones of equal weight; a stat row / search bar / footer that pads the screen without a job. Overlaps [cognitive-load](cognitive-load.md) and the Restraint axis — here judge it by *task*: does this element help the user do the one thing this screen is for?
- **H9 Recognize, diagnose, recover from errors** — plain-language errors with a way out. **Tell:** an `error` state that's a red border with no message, a raw code, or no recovery action. The reserved error slot ([interaction](interaction.md)) should say *what went wrong* in human words and *what to do* — and offer the button that does it. No dead-end errors.
- **H10 Help & documentation** — ideally self-evident; if not, help is in context. **Tell:** a non-obvious control or empty state with no hint — an empty list that's just blank, a complex form field with no helper text. Prefer making it self-explanatory; where you can't, an inline hint or empty-state CTA beats a help link. Most prototype screens should need **no** docs — if one does, that's a sign to simplify.

## Run order (critique mode)

1. **Visual-first (H1, H8, H9)** — screenshot tells: dead-looking actions, clutter burying the CTA, error states with no message.
2. **Walk the flow (H3, H5, H6)** — click every `data-to`: can I get out? is the destructive step gated? does my choice carry forward?
3. **Context (H2, H4, H7, H10)** — right words, consistent across screens, a power path, anything needing a hint.
4. Skip every heuristic with nothing to flag. Bullets, not essays.

## Design-guidance mode

1. Name the flow's **core action** (sign up · pay · pick · delete · invite).
2. Surface the 2–4 heuristics that most shape it — e.g. a checkout leans H1 (status) + H5 (prevention) + H2 (real-world price/copy); an onboarding leans H6 (recognition) + H3 (skip/back) + H1.
3. Translate each into a wiring decision — directive: "confirm the delete on its own screen," not "consider confirming."

## Persuasion & conversion (Fogg)

For **brand / marketing / checkout / onboarding** surfaces where the goal is to move the user to act. Fogg's model: **Behavior = Motivation × Ability × Prompt** — a behavior happens only when all three converge. Use these to *reduce friction*, not to coerce.

- **Ability — reduce friction (Reduction · Tunneling).** Cut steps, pre-fill with `data-bind` defaults, remove off-path choices on a conversion flow. The fewer fields and the straighter the path, the higher the completion. A 5-field signup beats a 12-field one.
- **Prompt — right thing, right moment (Suggestion / *kairos*).** Place the CTA where the decision happens, not buried below the fold; trigger the upgrade nudge *after* the user hit the value, not on load.
- **Motivation — make progress visible (Self-Monitoring · Tailoring).** A `data-bind` step counter ("Step 2 of 3"), a filling progress bar, content that reflects the user's earlier choice. Seeing progress pulls people through.
- **Social proof (Surveillance), reward (Conditioning)** — peer/usage signals and a satisfying confirm (a checkmark state, a micro-celebration on the success screen) lift conversion. **Flag the line:** if a recommendation relies on fake scarcity, pressure, or hiding the exit, it's a dark pattern — cut it. Persuasion makes the *good* choice easy; it never traps.

Keep it to a **2–4 item** prioritized list, same output shape — highest-impact first, and prefer the lower-effort change when impact ties.

## Example — a checkout screen

A clean payment screen: accent "Pay" button, card fields, order summary. Detector-clean, scores well on craft. Walk it:

```
⚠️ Several usability gaps
H1 Visibility — "Pay" is a bare data-to to the success screen; no loading state, so a real
   payment delay would look frozen. Add a loading state before the nav.
H5 Error prevention — card number is free-text with no format/constraint and no inline validation.
H2 Match real world — button says "Submit Order"; should name the action + amount: "Pay $48.00".
## Priority actions
1. Give "Pay" a loading→success transition (an instant jump on a payment reads as broken).
2. Constrain + inline-validate the card fields (prevent the error, don't catch it).
3. Relabel the CTA to the user's verb + the real amount.
```

Craft passed; usability didn't. That gap is exactly what this doc exists to catch — run it before you hand back any clickable flow.
