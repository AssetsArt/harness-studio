# UX research & shaping

Load this when you're in the brainstorm, before building — to ground who the prototype is for and the path they take, so the screens you build solve a real journey instead of a generic dashboard.

Arta builds **clickable prototypes**, not research. You have **no users to interview** — so these are **thinking tools**, run lightweight and in your head (or as a line of chat), to shape a sharper prototype. They are **not deliverables**: don't write a research doc, a full persona, or a formal journey map onto the canvas. The whole payoff is one shift — replace *"build a generic `<category>` app"* with *"build the 3 screens that carry THIS user's journey to THIS goal."* That's also the antidote to look-alike apps. This DEEPENS the brainstorm in [SKILL.md → "Start with a brainstorm — don't build on the first message"](../SKILL.md); it doesn't replace its hard-gate.

## The double diamond = the shape of the brainstorm

The classic process — **Discover → Define → Develop → Deliver**, two diamonds that each *diverge then converge* — maps almost one-to-one onto SKILL.md's brainstorm steps. Use it to know which move you're making:

- **Discover (diverge)** — understand the problem before any screen. Resist the dev's first solution; the request usually names a solution, not the problem. *"Let's make sure we're solving the right thing first."* → SKILL.md steps 1–3 (ground yourself, check scope, ask one question at a time).
- **Define (converge)** — name the **one job** this prototype does, in one sentence. A fuzzy problem produces an elegant solution to the wrong thing. → the moment before SKILL.md step 4: a single user-centered problem line.
- **Develop (diverge)** — generate 2–3 approaches with trade-offs; lead with your recommendation and why. Sketch the contested one **lo-fi** on the canvas rather than arguing in prose. → SKILL.md step 4 + the lo-fi sketch guidance.
- **Deliver (converge)** — commit the direction (incl. the one-line visual scene), get an explicit yes, then build the hi-fi prototype. → SKILL.md steps 5–6 and the prototype hard-gate.

Two traps to watch: the dev arrives with a solution already in mind (acknowledge it, then do a quick Discover pass anyway — it might be right, but check the problem first), and the request that's "simple" (that's exactly where the wrong assumption hides — still run Define).

It's a compass, not a conveyor: loop back freely (a sketch in Develop can reopen Define). Don't *narrate* the diamond to the dev — just run it.

## Fast persona (1–3 lines, not a profile)

You're not building a research persona (no photo, no demographics, no "favourite coffee"). You want **just enough to make screen decisions**. One line:

> **Who · their goal · their context/constraint.**
> e.g. *"A night-shift dispatcher, wants to clear the incident queue fast, working one-handed on a phone in a dim ops room."*

- **Relevance test on every word:** would it change a screen decision? Keep it. Else cut it. Device, frequency, environment, expertise, and tech-comfort are usually signal; age, name, and backstory usually aren't.
- That one line already decides things: phone frame, dark theme, big tap targets, queue-first layout — **this is where the prototype stops looking generic.** It's the same "scene sentence" SKILL.md asks for at direction time; write it once, reuse it.
- Read the **context/constraint** hardest — it's the part that bends the UI. *"one-handed, in a dim room, mid-task, interrupted, low-bandwidth, glances not reads"* each forces a different layout. A persona with no constraint isn't shaping anything; push for one.
- One persona per prototype. If the request truly serves two very different users, that's a **scope** signal (split it — SKILL.md step 2), not two personas on one canvas.

## Lightweight journey map = your screen list

Don't draw a formal map. Walk the steps the user takes to their goal, and at each step note **what they do** and **how they feel** (one word). The steps become your **screen list**; the emotion curve tells you **which screen is the crux to nail.**

- 4–6 steps, narrative not click-by-click. *Arrive → find → decide → act → confirm*, adapted to the job. Common shapes to borrow: e-commerce *discover → try → buy → use*, tools *purchase → adopt → retain → expand*. If you can't name the phases cleanly, the journey isn't right yet — keep talking.
- Mark the **emotional low** (where it's confusing/risky/tense) and the **high** (the payoff moment). The low is usually the screen worth the most craft — the decision or the empty/error state, not the happy dashboard. If the curve is flat, you haven't dug deep enough.
- **One actor, one path.** A branch is a *separate* journey; pick the primary path for the first prototype and note the branch as out-of-scope.
- Each step also pins a **device + frame** decision (is the dispatcher on a phone or a desktop here?) and tells you the **screen shape** to reach for (a *decide* step → master–detail or a focused choice screen; an *act* step → a form or wizard) — see SKILL.md's "Vary the screen shape."
- Output is mental or a 2-line chat note — never a journey-map artifact on the canvas. It feeds the **spec's `userStories`** and the **`prototype.start` + screen order**.

## Empathy pass — find the real need (one quick sweep)

When the request feels thin or you suspect the dev asked for the *solution* not the *need*, do a 60-second **Says / Thinks / Does / Feels** pass on the persona:

- **Says** what they'd state out loud · **Thinks** what they wouldn't · **Does** the workaround they use today · **Feels** `[emotion]: [why]`.
- **The gold is the contradiction:** *says* "I just want a dashboard" but *does* "exports to a spreadsheet to actually decide" → the real need is the decision view, not the dashboard. Surface that to the dev as a question, not an assumption.
- This is a **thinking sweep**, not a quadrant artifact. It sharpens the one-sentence job (Define) and catches "they didn't really want what they literally asked for."

## Storyboard = the lo-fi sketch sequence on the canvas

The journey's panels are exactly SKILL.md's **lo-fi sketches**: one step = one rough screen, sketched cheap, to agree the *flow* before any hi-fi pixels. This is the canvas-native version of a storyboard.

- Sketch the path as a short clickable sequence (the lo-fi component vocab, or rough freeform blocks wired with `data-to`) — **the story, not the art.** Stick-figure fidelity is the point; it stays disposable and easy to change.
- Wire the panels so the dev can **click through the journey** and feel the sequence. Ask one question ("does this path match how they'd actually do it?"). Get a yes on the *flow*, then build hi-fi.
- Keep it speculative and labelled as such. Lo-fi sketches **don't** count as "building" and don't trip the prototype hard-gate — hi-fi does.
- Start from the **emotional crux** panel if you're unsure where to invest: nail the screen that carries the most feeling first.

## Feature prioritization — what's IN the first prototype

A quick **impact × effort** 2×2 to cut the screen/feature list down to the first build. Pairs with SKILL.md's scope check (`spec.scope.in` / `out`).

```
high impact │  Plan carefully  │  ✅ Build first
            │──────────────────┼──────────────────
low impact  │  Cut             │  Quick win (if time)
            └──────────────────┴──────────────────
                   hard                  easy   (effort)
```

- Plot every candidate screen/feature. **Top-right (high impact, low effort) is the first prototype.** Top-left is "worth it but plan." Bottom row is later or cut.
- Bias the first build toward the **journey's critical path + its emotional crux** — those are high-impact by definition. A settings page or an edge-case flow is almost always *out* of v1.
- It's a **decision tool, not a contract** — re-cut it when the dev's clicks change the picture. Record the result as `scope.in` / `scope.out`, not a matrix artifact.

## A note on real research methods (for when the dev has users)

You can't run these — but when the dev *does* have users and asks "how would I check this for real," point them at the method that fits the question:

- **Why / how to fix it** (qualitative) → **interviews**, **usability test** (5 users tells you *why*, not *how many*).
- **How many / how often** (quantitative) → **survey**, **analytics**, **A/B test**.
- **What they say** vs **what they do** — these diverge; when behaviour matters, prefer **behavioural** methods (analytics, usability test) over **attitudinal** (survey, interview).
- By stage: **early/direction** → interviews, field studies, surveys · **improving a flow** → usability testing, card sort, tree test · **post-launch/compare** → A/B test, analytics, benchmarking.

One line of advice, then back to the prototype — Arta shapes the design, it doesn't run the study.

## Shaping checklist (run in the brainstorm)

Before you ask for the explicit yes and leave the gate:

- [ ] **One-sentence job** — `[user] needs [goal] because [barrier]`, agreed, not a solution restated.
- [ ] **Persona in one line** — who · goal · context/constraint; every word passes the relevance test.
- [ ] **Journey walked** — 4–6 steps; the emotional **crux** screen named.
- [ ] **Screen list = the journey** — start screen + order fall out of the steps, not a category template.
- [ ] **Real-need check** — a quick Says/Thinks/Does/Feels confirms the request isn't a solution hiding the need.
- [ ] **Scope cut** — impact×effort done; v1 = critical path + crux; the rest is `scope.out`.
- [ ] **Visual scene committed** — the one-line who/where/mood (the persona's context doubles as this).
- [ ] **Not generic** — you can name 2–3 ways this build looks unlike the generic version of its category. (See [register-product](register-product.md) / [register-brand](register-brand.md).)

Then build — and at hand-back, judge each screen against the six axes in [critique-rubric](critique-rubric.md). Specificity there is *earned here*: a screen reads as "this product" only when it's solving this persona's journey, not a template.
