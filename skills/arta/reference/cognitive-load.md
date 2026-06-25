# Cognitive load

Load this when a flow is *pretty but exhausting* — a form with too many fields, a checkout that takes five screens, a layout with five equal buttons. A prototype that looks designed and still tires the dev out has failed.

The dev abandons a flow not because they don't want it, but because thinking is tiring. Every needless decision, unfamiliar pattern, and scrap of visual noise drains a finite budget. When it runs out, they leave. Arta's edge: you can SHOW the low-load version — a pre-filled, defaulted form rendered live from the `store` — instead of arguing for it. Build the easy path, don't describe it.

## The three loads — cut only one

- **Intrinsic** — the thinking the task actually requires (choosing a date, picking a seat). The dev came for this. Don't hide it, just don't add to it.
- **Extraneous** — effort the UI *imposes* that isn't the task: redundant fields, novel controls, five competing CTAs, a step that exists for no one. **This is the whole job. Find it and cut it.**
- **Germane** — effort that helps the dev *learn* the product (a clear empty state that teaches, a step indicator that orients). Keep it; it pays for itself.

Cut extraneous. Never simplify intrinsic into a lie — a smart default must be an *honest* default, and a high-stakes irreversible action *keeps* its confirm (friction is a feature there). See [interaction](interaction.md) for undo-beats-confirm.

## Forms — the biggest load sink

- **Cut fields to the minimum.** Every field is a question; the best field is the one that isn't there. If you can't name why a field earns its place, delete it.
- **Don't ask for what you can derive.** Country from a phone prefix, tax from the line items, the display name from the email. Compute it; don't make the dev type it.
- **Smart defaults in the store** — declare them in `prototype.store` and bind them, so the form arrives *filled*, the dev just confirms. This is the Arta move: render the defaulted state, don't promise it.
- **One column, not two.** A two-column form makes the eye zig-zag and hides the next field. Stack it; the eye runs straight down. (See [layout](layout.md).)
- **Group related fields** into labelled chunks (contact · shipping · payment) — three groups of four read faster than twelve loose fields (chunking beats a wall).
- **Inline validation, not a wall at submit.** Validate per-field with a reserved error slot (`data-show="emailErr"`), never dump twelve red lines after one click. The error appears where the eye already is.
- **Progressive disclosure** — advanced/rare options live behind a toggle (`data-set="advanced=1"` + `data-show="advanced"`), not on screen by default. Most devs never need them; the few who do, ask.
- **Labels above the field, not beside; never placeholders-as-labels** (they vanish on input) — full rationale in [interaction](interaction.md).

A defaulted, single-column, progressively-disclosed form (the load audit's "after"):

```html
<form class="mx-auto flex max-w-sm flex-col gap-4">
  <div>
    <label class="mb-1 block text-sm font-medium text-[var(--color-ink)]">Workspace name</label>
    <input data-bind="wsName"
      class="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)]"
      value="Acme team" />
    <p class="min-h-[1rem] text-xs text-[var(--color-muted)]">You can change this later.</p>
  </div>
  <div>
    <label class="mb-1 block text-sm font-medium text-[var(--color-ink)]">Region</label>
    <div class="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-muted)]">
      <i data-lucide="map-pin" class="h-4 w-4"></i> Europe (detected) · <button data-set="editRegion=1" class="font-medium text-[var(--color-accent)]">change</button>
    </div>
  </div>
  <button data-set="advanced=1" data-show="advanced==0"
    class="flex items-center gap-1.5 self-start text-sm font-medium text-[var(--color-accent)]">
    <i data-lucide="chevron-down" class="h-4 w-4"></i> Advanced options
  </button>
  <div data-show="advanced" class="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
    <!-- the 4 rare fields live here, off the default path -->
  </div>
  <button data-to="created"
    class="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]">
    Create workspace
  </button>
</form>
```

The "before" was the same eleven fields, two columns, every advanced toggle exposed, an empty name field, region as a typed dropdown, and one submit that threw a red wall. Three cuts — default the name from the store, derive the region, fold four rare fields behind one toggle — and the visible task drops from eleven decisions to one confirm.

## Flows — count the hops

- **Fewer screens between intent and done.** Count the `data-to` hops from the first tap to "done" — if it's five, ask which two are real decisions and which exist because someone could imagine a screen there. Cut the rest.
- **A visible step indicator for multi-step** (`data-bind="step"` over a 3-dot spine) — orientation is germane load, keep it. The dev should never wonder "how much is left."
- **Never a dead end.** Every screen has one clear primary next action wired with `data-to`. A confirmation screen routes onward (back to dashboard, to the new item) — not a full stop the dev has to escape.
- **Recognition over recall.** Don't make the dev carry a value forward in their head between steps — re-display what they entered on the summary/confirm screen (`data-bind`). The best decision is the one they don't have to remember.
- **Recommend a default path through the flow.** When a branch splits ("solo / team / enterprise"), mark one as the suggested route and let the store pre-select it (`data-set`) — most devs take the recommendation, and the few who don't still see all options.
- **Defer the optional.** A step that only some devs need (invite teammates, connect an integration) belongs *after* the core flow completes, offered from the done screen — not wedged in as a blocking step everyone must clear.

## Layout — reduce what the eye has to weigh

- **One primary action per screen.** Five equal buttons = five decisions; make ONE the filled accent and demote the rest to text/ghost. The squint test: what reads first should be what to act on.
- **Reduce choices (Hick's law).** A flat 12-item menu is slower than the same items grouped 3×4. More options = longer decision; group, default, or recommend ("Most popular") to shrink the live choice set.
- **Whitespace and grouping chunk the information** — space is the cheapest way to say "these belong together." A dense undifferentiated panel forces the eye to parse structure the layout should have given it. (See [layout](layout.md).)
- **Consistent placement.** The primary action, the back affordance, the title sit in the *same spot* every screen — so the eye doesn't re-hunt on each navigation. Factor shared chrome into `prototype.layout` (it's also how you keep it consistent for free).
- **Recognition over recall, again** — show the option, don't make them remember a code or a prior choice. Surface it; don't quiz them.

## Copy — language is load too

- **Short labels, concrete verbs.** "Create workspace" beats "Submit"; "Delete 3 files" beats "Confirm." Front-load the action.
- **No jargon** unless the audience is expert and the term carries precision. Plain words parse faster.
- **Numbers over vague words** — "Ends in 2 days" beats "Ending soon"; "12 left" beats "Limited stock." Concrete reads in one pass.
- **Avoid negatives** — "Offer ends tonight" is direct; "Don't miss out" makes the brain unwrap a negation first.

## The load audit — run it on a screen

Pull `arta_get_screenshot`, then for each element ask the subtraction test: *remove it — does anything the dev needs break?* If not, it's extraneous. Rank the three highest-cost offenders and cut them before you hand the screen back:

1. **Competing CTAs at one decision point** → keep one filled primary, demote the rest.
2. **Fields you can derive or default** → move them into the `store` (pre-filled) or compute them; delete the input.
3. **Rare options on the default path** → fold behind a `data-show` toggle.

Then re-shoot and confirm the screen now has one obvious thing to do. Tie this to the self-critique's **Restraint** axis — extraneous load is restraint failure you can measure. See [ux-heuristics](ux-heuristics.md) for the recognition/consistency heuristics, [interaction](interaction.md) for form/state mechanics, [layout](layout.md) for the spatial grouping that does the chunking.
