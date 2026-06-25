# AI product patterns

Load this when the prototype IS an AI product — a chat/copilot/assistant, a generator, an AI-feature surface — and you need the UX to design the AI *interaction*, not just drop a chat box. Pattern catalog: principle → the concrete Arta move → when to reach for it. Pairs with [interaction](interaction.md) (the six wires + states), [ux-heuristics](ux-heuristics.md) (the general bones), [register-product](register-product.md) (a tool serves a task — earned familiarity, every state shipped).

The through-line across all six clusters: **never a bare textarea on an empty page.** Scaffold the input, kill the blank slate, disclose what the AI is and isn't sure of, gate the consequential actions, let the user steer, and give the AI a deliberate character. Mock all of it with the store (`data-set` / `data-show` / `data-bind`) — these are *interactions to walk*, not screenshots.

## Inputs — pick the right input, then scaffold it

The input is a decision, not a default textarea. Match it to the task:

- **Open text** — free-form chat / composer. For discovery, exploration, open-ended Q&A. Never ship it bare: surround it with suggestions, a model/mode selector, attachments, a caveat line. After the first turn, **make scope explicit** (acting on *this section*, not the whole doc).
- **Structured prompt (madlibs)** — a template with named fields. For *repeatable* structured generation (PRD, release note, outreach email, brief). 3–5 fields beat a 12-field wall; mark critical vs optional; show the assembled prompt to power users. **Prefer this over open text whenever the task has a predictable shape** — it shifts the work from prompt-engineering to filling blanks.
- **Autofill / suggestions** — AI populates fields/rows from context, or inline ghost text. For repetitive data, forms, spreadsheets. **Always sample 2–3 first, let the user verify, then bulk-fill.** Visually mark AI-filled vs human-written until accepted; never silently overwrite human content.
- **Templates / example gallery** — pre-built prompts and sample generations as one-click starters. For complex/long prompts and "I don't know what's possible." Each tile is an *entry point* (Start from this · Remix · See prompt), not a showcase.
- **Voice** — when hands/eyes are busy or it's genuinely conversational. Needs a recording indicator and a caveat spoken/shown, not just a mic glyph.

Decision: scratch + repeatable → **structured prompt**; scratch + open → **open text + suggestions**; existing content, one region → inline action; existing content, many rows → autofill-with-sample.

A structured-prompt input (madlibs), not a bare textarea — fields assemble the prompt, the user fills blanks:

```html
<section class="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
  <div class="mb-4 flex items-center gap-2">
    <i data-lucide="sparkles" class="h-4 w-4 text-[var(--color-accent)]"></i>
    <h2 class="text-sm font-semibold text-[var(--color-ink)]">Draft a release note</h2>
  </div>
  <p class="text-[15px] leading-7 text-[var(--color-ink)]">
    Announce
    <button class="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 font-medium text-[var(--color-accent)]">Billing v2 <i data-lucide="chevron-down" class="ml-0.5 inline h-3 w-3"></i></button>
    to
    <button class="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 font-medium text-[var(--color-accent)]">existing customers <i data-lucide="chevron-down" class="ml-0.5 inline h-3 w-3"></i></button>
    in a
    <button class="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 font-medium text-[var(--color-accent)]">concise, warm <i data-lucide="chevron-down" class="ml-0.5 inline h-3 w-3"></i></button>
    tone.
  </p>
  <div class="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-3">
    <button class="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]">See full prompt</button>
    <button data-set="gen=1" class="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:opacity-90">
      <i data-lucide="sparkles" class="h-3.5 w-3.5"></i> Generate
    </button>
  </div>
</section>
```

## Wayfinding — kill the blank slate, teach on first run

A bare AI box on an empty state is the #1 reason users bounce: most people can't prompt from scratch. **Don't surface the empty box — surround it with scaffolding** that shifts work toward selection. Ties straight to Arta empty states (centered content, no dead band — see [interaction](interaction.md)).

- **Example prompts / suggestions** — 3–6 clickable starters near the input; clicking *fills or runs* (no dialog). **Contextual beats static** — draw from what's on screen (the open doc, the selected row) over a generic "Ask me anything."
- **Prompt gallery** — curated sample generations organized by use case, each one-click actionable, the prompt visible behind it (learn by reverse-engineering).
- **Starter templates** — the structured-prompt inputs above, surfaced as named cards on the empty state.
- **Inline tips / nudges** — contextual hints at the moment of leverage: "Summarize" appears on a long doc, not an empty page. Engagement flags unlock richer AI once there's enough content to act on.
- **First-run empty state that teaches** — model a good prompt, don't just label the box. Every suggestion is a worked example that builds the user's prompting intuition.

When: empty state with nothing yet → CTA + suggestions + gallery. Has content, hasn't used AI → contextual nudges + follow-ups. After first output → follow-ups (2–4, anchored to what just happened: "Draft an email from this?").

A first-run empty state that teaches — example-prompt gallery instead of a lonely textarea (centered, fills the frame):

```html
<section class="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-12 text-center">
  <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-accent-soft)]">
    <i data-lucide="sparkles" class="h-5 w-5 text-[var(--color-accent)]"></i>
  </div>
  <h1 class="text-2xl font-semibold text-[var(--color-ink)]">What should Aria draft today?</h1>
  <p class="mt-1.5 text-sm text-[var(--color-muted)]">Pick a starting point — or just start typing below.</p>
  <div class="mt-6 grid gap-2 text-left sm:grid-cols-2">
    <button data-set="seed=1" class="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-accent)]">
      <div class="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]"><i data-lucide="megaphone" class="h-4 w-4 text-[var(--color-accent)]"></i> Release note</div>
      <p class="mt-1 text-xs leading-5 text-[var(--color-muted)]">"Announce Billing v2 to existing customers in a warm tone."</p>
    </button>
    <button data-set="seed=1" class="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-accent)]">
      <div class="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]"><i data-lucide="list-checks" class="h-4 w-4 text-[var(--color-accent)]"></i> Extract action items</div>
      <p class="mt-1 text-xs leading-5 text-[var(--color-muted)]">"Pull the decisions and owners from this meeting transcript."</p>
    </button>
  </div>
  <p class="mt-6 text-xs text-[var(--color-muted)]">Aria can make mistakes — check important info.</p>
</section>
```

## Trust — caveats, sources, disclosure, consent, footprints

Users who don't trust the system disengage; users who over-trust get burned. Match intensity to stakes (a consumer toy ≠ a healthcare tool).

- **Caveat** — "AI can be wrong" at the *moment of decision* (beneath the input, above a generated block), plain language ("Check dates for accuracy"), specific where possible. It's a warning label, not a safety net — pair with citations, never lean on it alone (users go blind to ubiquitous caveats).
- **Citations / sources** — link claims back to source. Inline numbered markers for sentence-level facts; a sources drawer/panel for research. Hover-preview so the user judges relevance without leaving. **Broken/missing source → say so, never substitute filler.**
- **Confidence / disclosure** — label *when* it's AI and *what it did* ("Summarized with AI", not just "AI"). Distinct visual styling for AI-generated content (tint / lower-opacity / persistent header) that's never mistaken for human-authored. Separate factual statements from inferred insights visually; expose uncertainty ("limited support", "conflicting data") rather than flattening everything to equal confidence.
- **Consent + data ownership** — opt-in before recording/processing (especially when others are captured); silence isn't consent. In settings, **separate "retain my data" from "train on my data"** as independent toggles, default to the privacy-protective one, state the default in the panel (not a linked policy). If you don't train on user data, say so — the absent toggle confuses.
- **Watermarks / footprints** — a visible badge on AI output that's shared/exported; an expandable "how this was made" trail (model, sources, steps) for verify/replay. Footprints double as branch points — click a prior one to repopulate the prompt.

When: users don't know AI is involved → disclosure + caveat. Output might be wrong → caveat + citations. Recording others → consent + disclosure. "Is my data trained on?" → data-ownership toggles.

## Governors — keep the human in the loop

Autonomy without oversight causes irreversible harm; **calibrate friction to the blast radius** (every confirm adds friction, and prompt-fatigue makes users click through reflexively). Two questions: *worst case if this goes wrong?* (reversible vs not) and *how often?* (one-off vs repeated).

- **Action plan before acting** — for a long/expensive/multi-step task, the AI lays out its steps *before committing resources*. Skimmable, editable (fix the plan, don't regenerate), collapsible for experts. Advisory (orientation) or contractual (gated on approval).
- **Verification / confirm step** — a required human OK before a consequential action: loss of money, reputation (email sent as the user), security (shared data), work (overwritten records). **Not** for cheap reversible things (a search) — that's just fatigue. High-impact + irreversible → strong confirm; offer "don't ask again" after the first confirmed run.
- **Undo** — beats confirm for most reversible actions. Remove from the UI immediately, show an undo affordance (`data-set` a toast), keep confirm only for the truly irreversible (see [interaction](interaction.md) — "modals are usually laziness").
- **Cost / usage estimates** — surface compute/credits/tokens *before* the run, where the decision is made (inline at the prompt, on the action button). Show ranges for unknowns; offer a cheaper path (draft mode, lighter model).
- **Editable memory** — when the AI remembers across sessions, show it ("Saved to memory" chip when added); make every memory viewable, editable, deletable, with a clean reset. Separate personal vs work scope; support memory-off for sensitive work.
- **Show the citations / stream of thought** — the visible trace (plan → execution → evidence), depth matched to context (chat needs little, an agent needs the full trace). Steps as states: queued → running → waiting-for-approval → done/error.

When: long/expensive action → action plan + verification + cost. Background agent → stream of thought + stop/pause controls. Destructive action → verification (or undo if reversible).

A confirm/verify step before a consequential AI action — the plan is shown, the cost is on the button, the destructive verb is gated:

```html
<div class="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
  <div class="flex items-start gap-3">
    <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-warn-soft)]">
      <i data-lucide="alert-triangle" class="h-4 w-4 text-[var(--color-warn)]"></i>
    </div>
    <div>
      <h3 class="text-sm font-semibold text-[var(--color-ink)]">Send 142 outreach emails?</h3>
      <p class="mt-0.5 text-sm text-[var(--color-muted)]">Aria will send on your behalf. This can't be undone once sent.</p>
    </div>
  </div>
  <ol class="mt-4 space-y-1.5 border-l border-[var(--color-line)] pl-4 text-sm text-[var(--color-ink)]">
    <li class="flex items-center gap-2"><i data-lucide="check" class="h-3.5 w-3.5 text-[var(--color-accent)]"></i> Personalize each from the CRM record</li>
    <li class="flex items-center gap-2"><i data-lucide="check" class="h-3.5 w-3.5 text-[var(--color-accent)]"></i> Skip the 8 contacts who opted out</li>
    <li class="flex items-center gap-2"><i data-lucide="check" class="h-3.5 w-3.5 text-[var(--color-accent)]"></i> Send from hello@northwind.co</li>
  </ol>
  <div class="mt-5 flex items-center justify-between">
    <span class="text-xs text-[var(--color-muted)]">Est. ~12,000 tokens · ~$0.40</span>
    <div class="flex gap-2">
      <button data-set="confirm=0" class="rounded-[var(--radius-md)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]">Review first</button>
      <button data-to="sending" class="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:opacity-90">Send 142 emails</button>
    </div>
  </div>
</div>
```

## Tuners — let the user steer

Controls between intent and output. **Make the active state always visible** (hidden model/mode/style = broken trust); progressive-disclose the advanced ones; support natural language over a dropdown of 12 radios.

- **Model / mode switch** — show the active model at the point of generation; switch mid-conversation without losing context. Modes are *contracts* (research mode = rigor + citations; creative = looser) — show the current mode, reconfigure the surface to match, allow toggling mid-chat. Describe models in human terms (accuracy / recency / cost / speed), not bare names.
- **Filters** — scope what the AI draws from (source filters: "only academic", "this workspace") or down-weights (token/negative: "no jargon"). Keep active filters visible; if a filter zeroes out results, offer to relax it — never a silent empty.
- **Parameters** — the knobs (tone toggle, length dropdown, temperature slider, aspect ratio). Always-visible for the ones that affect cost/speed/format; drawer for the rest. Sensible transparent defaults; show what a preset sets under the hood. Treat AI autonomy (suggest / ask / execute) as an *explicit* parameter, never hidden.
- **Voice & tone** — how the AI writes *the user's* output (distinct from the AI's own personality). Preset styles (browsable, with previews) → saved styles (the user's reusable profile). Lightweight inline ("more formal / casual") + a fuller voice panel. Show which voice is active ("Using: Team Brand Voice"); always a "reset to default."
- **Regenerate / variations** — re-run for a new result (single-click for convergent work; branch for creative). **Make overwrite-vs-branch clear before the click**; keep prior results recoverable. Variations = a grid/inline set to compare and pick; never overwrite the original without explicit confirm.

A visible mode/model bar above the input (the active one is filled, not outlined — see [interaction](interaction.md)):

```html
<div class="flex items-center gap-1.5 px-1 pb-2">
  <button class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]"><i data-lucide="message-circle" class="h-3.5 w-3.5"></i> Chat</button>
  <button class="rounded-full px-3 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">Research</button>
  <button class="rounded-full px-3 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]">Build</button>
  <div class="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
    <i data-lucide="cpu" class="h-3.5 w-3.5"></i> Sonnet <span class="text-[var(--color-faint)]">· fast</span> <i data-lucide="chevron-down" class="h-3 w-3"></i>
  </div>
</div>
```

## Identity — make the AI a deliberate character

The AI's presentation isn't decoration — name, avatar, colour, iconography, and personality together decide whether it feels *owned by this product* or generic. Tie every choice to the design tokens and the chosen register ([register-brand] for a brand-led AI, [register-product](register-product.md) for a tool). "Neutral" isn't an option — every model ships with default tendencies; choose them on purpose.

- **Name** — sets expectations before a word is said. Persona ("Aria" — warm, risks overpromising), company ("Acme AI" — clean, can feel generic), entity ("Copilot", "Navigator" — honest about role), or bare ("AI" — for AI-native defaults). **Disclosure stays unambiguous whatever the name** — never let the user mistake it for human.
- **Avatar** — communicates state (listening / generating / idle), anchors identity, mediates trust. Minimal mark for a utility, branded character for warmth, voice avatar in voice mode. **Make state changes unmistakable** (glow / motion / a filled vs pulsing dot); avoid deceptive photorealism that implies human competence the AI lacks.
- **Colour** — the most ambient identifier; signals AI presence without text. Purple/green is the industry reflex — **dodge it** unless it's genuinely your brand (it's a slop tell; `arta_design_review` flags the AI-purple default). Make the AI accent a real token (`--color-accent`), used as an *affordance* that distinguishes AI content from human, never as the only signal (pair with icon + label for accessibility).
- **Iconography** — a consistent set for AI actions. `sparkles` = generate, `wand` = magic action, sparkly pencil = inline edit, `dices` = randomize. **Pair icons with text** (the conventions aren't universal yet), anchor one set, don't scatter sparkles everywhere (they lose meaning). For an AI-native tool with expert users, heavy wands/sparkles read dated — restrain them.
- **Personality** — tone, pacing, how much it hedges or pushes back. Warm invites exploration; terse signals reliability. Keep a recognizable core, flex by mode. **Separate empathy from authority** (a warm tone must not imply more accuracy). Guard against sycophancy; when memory + a sycophantic persona compound, add transparency and off-ramps.

The five identifiers must *cohere* — a playful warm personality on a cold abstract avatar with a bare-technical name reads as dissonance the user feels but can't name. Set the AI's accent + iconography as tokens once, reuse everywhere.

---

**Avoid**: a bare textarea on an empty page · AI-purple/green accent left as the default (slop tell) · a caveat doing the whole trust job alone · silent bulk-fill / silent overwrite of human content · a confirm step on cheap reversible actions (fatigue) and *none* on the irreversible one · hidden model/mode/voice state · sparkles scattered as decoration · a generated-content style indistinguishable from human-authored · faking a human in a support chat · regenerate that overwrites without saying so.
