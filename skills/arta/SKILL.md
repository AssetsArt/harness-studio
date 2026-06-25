---
name: arta
description: Use during the DESIGN phase of building a new app/feature, instead of dumping a wall of text. ALWAYS brainstorm the idea into an agreed direction first (questions one at a time, like superpowers:brainstorming) — never jump straight to a spec or prototype. Then drive Claude Code to build a shared, live design canvas (.arta/state.json) that the dev watches in the Arta viewer — spec, prototype, data model, flow, plan — iterating from the dev's clicks and feedback. Trigger when the user wants to "design", "wireframe", "prototype", "sketch the data model/flow", "plan a feature visually", or says "open Arta / let's design this in the studio".
---

# Arta — prototype-based design loop

You are designing **with a picture, not a wall of text.** The dev has the Arta
viewer open (`bun run dev`). Everything you write to `.arta/state.json`
appears on their screen instantly with a cyan flash. You see what they're looking
at and read their feedback through the MCP server. Design is one tight loop.

## The loop

```
  you write state.json  ──▶  viewer repaints (the dev sees it)
          ▲                              │
          │                              ▼
  arta_get_feedback  ◀──  dev clicks the prototype, leaves a note
```

Never describe a screen in prose when you could render it. Show, ask, adjust.

## Tools (MCP server: arta)

- `arta_start_viewer` — **call this once at the very start of a session** to open
  the viewer for the dev. It launches the viewer that ships **inside the installed
  plugin** (so it always matches the plugin version — no stale `npx`/`bunx` cache),
  pointed at this project's `.arta/`. It's idempotent (re-running just returns the
  URL) and installs the viewer's deps on first run. Tell the dev the URL it returns
  (default `http://localhost:7317/?project=<id>`) — the `?project` deep-link opens the
  viewer straight onto **this** project even when one viewer hosts several; the viewer
  consumes it and tidies the address bar. The dev can drop a project from the switcher
  there too (the launched project stays pinned).
- `arta_restart_viewer` — stop the running viewer and relaunch it from the
  installed plugin, so it serves the **latest** build. Use this after the plugin
  updates (the `/arta update` / `/arta restart` flow calls it): an already-open viewer
  keeps serving the old assets until it's restarted. The dev no longer clears caches
  or kills processes by hand.
- `arta_get_state` — read the canvas before editing. Always start here. Whole
  state by default; in a **large** project pass `{ outline: true }` for a cheap index
  (which sections exist, their counts + byte sizes, and the screen manifest), then
  pull only what you need with `{ sections: ['spec','dataModel'] }` or a named getter.
- `arta_get_view` — see what the dev is looking at right now (active tab +
  prototype screen). Check this before changing a screen so you edit what they see.
- `arta_set_state` — write the whole canvas. Use for the first build or a full rewrite.
- `arta_patch_state` — merge one top-level section (`spec`, `dataModel`,
  `flow`, `plan`, or the prototype manifest). Your workhorse for the structured tabs.
  Top-level keys replace; **`meta` and `prototype` deep-merge**, so a slim
  `{ prototype: { … } }` patch keeps the keys it omits (tokens, components, screens)
  instead of wiping them. Even so, edit prototype pieces with the granular setters
  (`arta_set_screen` / `arta_set_component` / `arta_set_design_tokens`) —
  they touch one file and keep the manifest clean.
- `arta_set_phase` — record the current phase (`prototype → data → flow → architecture → plan`), shown in the status bar. Tabs are free routes the dev can revisit in any order, so this just marks where you're working.
- `arta_get_spec` — read just the `spec` (goal, users, userStories, scope,
  constraints) without pulling the whole state. Write it via `arta_patch_state`.
- `arta_get_data_model` — read just the `dataModel` (entities + relationships,
  the Data tab) on its own. Write it via `arta_patch_state`.
- `arta_get_api` / `arta_set_api` — read/write the `api` section (the Flow
  tab) as an OpenAPI 3 document: routes, middleware (`x-middleware`), and
  per-operation params (path/query/header), request body, and responses. Tie a
  route to the prototype screens that call it with `x-screens: ["screenId"]` — the
  Flow graph then draws screen → API edges (which screen hits which endpoint,
  through which middleware).
- `arta_get_architecture` / `arta_set_architecture` — read/write the
  `architecture` section (the Architecture tab): the C4-style `nodes`/`edges` (system
  diagram), `decisions` (ADRs), `nfrs`, `security` notes, and `stack`.
- `arta_get_plan` / `arta_set_plan` — read/write the `plan` Kanban board:
  `statuses` (columns), `milestones` (swimlanes), and tasks (`status` id +
  `priority`). `arta_set_task` adds/updates one card by milestone + title —
  use it to **move a card** (set its `status`) without resending the whole plan.
- `arta_get_feedback` — drain notes the dev left in the viewer. Check it after
  every meaningful change and act on what you find. Notes may include an `element`
  (tag/text/selector) when the dev clicked a specific element to comment on it —
  use it to target the exact thing they mean.
- `arta_get_screenshot` — get a PNG of how a screen actually renders. Use it to
  **check your own work visually**, not just from the HTML — after building or
  changing a screen, look at it. By default it's a **real headless-Chrome render**
  (pixel-identical to the browser, no font/effect drift) rendered **on demand**, so
  you do NOT need the dev to have opened the screen first; it's the screen content at
  its device width (no device bezel). Pass **`full: true`** to capture the WHOLE
  screen at its content length (the entire scroll in one tall image, including a
  screen that scrolls inside an **inner region** — header + scroll-body + tabbar).
  Pass **`engine: "client"`** to instead get the viewer's own capture **with the
  device bezel + status bar** (what the dev literally sees) — handy to check the
  safe-area/notch fit, though it only exists for screens the dev has opened and can
  drift on some CSS. (No Chrome on the machine → it auto-falls back to the client shot.)
- `arta_get_view` also returns `errors`: console/runtime errors from the
  prototype. If something you wrote is broken, you'll see it here — fix it without
  waiting for the dev.
- `arta_design_review` — run Arta's **own** deterministic anti-slop detector over a
  screen's HTML and get craft findings ranked **error → warn → info** (gradient text,
  side-stripe borders, stripe backgrounds, cramped tracking, nested cards, transition:all,
  emoji-as-icon, italic headings, over-rounded cards…). Offline and instant — no `npx`, no
  network. A design-quality eye to pair with the screenshot; fix the **error**s first.

Granular prototype edits — **touch one piece, not the whole design** (this is how
you keep big prototypes cheap to edit):

- `arta_get_screen` / `arta_set_screen` — read/write ONE screen body. `set`
  writes `prototype/screens/<id>.html` and upserts its manifest entry (title/url/frame).
- `arta_delete_screen` — remove ONE screen (manifest entry + its file), repointing
  `start` if needed. Use it to clear a stray / leftover screen — above all the seed
  `home` placeholder once the real screens exist (a leftover blank screen is what the
  dev sees if you don't).
- `arta_get_component` / `arta_set_component` — read/write ONE shared fragment.
- `arta_get_design_system` / `arta_set_design_system` — the shared CSS.
- `arta_get_design_tokens` / `arta_set_design_tokens` — the structured design
  system (colors, typography, spacing, radii, shadows, fonts). Shown as a style guide
  in the Prototype → **Design system** sub-view; tokens compile to CSS custom
  properties (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--text-*`,
  `--font-*`) injected into every screen.
- `arta_set_frame` — set the device frame, `safeArea` colour, and/or `chrome`
  (prototype default or per screen). Phone/tablet content is ALWAYS full-screen
  (edge-to-edge). `chrome` (default **true**) overlays the iOS-style status bar (with
  the **real** time) + notch + home indicator ON TOP of the content — so the screen
  must pad its own top/bottom to clear them (see "Device frame & safe area" below).
  `safeArea` is the screen's top-edge colour, used so the clock/icons auto-contrast.
  `chrome:false` drops the status bar/notch/home-indicator entirely for true
  edge-to-edge (splash / login / media). There is no on/off toggle — it's saved state.
- `arta_export` — pack the WHOLE clickable prototype into a static, deployable folder
  for a **client demo**. Writes `<project>/dist/index.html` (override with `dir`): one
  self-contained page, the same faithful render as the live `/preview`, but **without
  the Arta navigator** — no floating button, no sidebar. It's navigated only by the
  prototype's own `data-to` clicks, so it reads as a finished site, not the editor.
  Returns ready-to-run deploy commands (Cloudflare Pages `npx wrangler pages deploy`,
  Netlify, local serve). Needs the viewer running (it does the assembling), so call
  `arta_start_viewer` first if it isn't up. The `.arta/` source is never touched. The
  page loads Tailwind + lucide from a CDN, so the deployed demo needs internet; re-run
  after design changes to refresh it.

## Storage layout (.arta/)

The canvas is split so each piece stays small:

```
.arta/state.json                     meta/spec/plan/dataModel/api + prototype MANIFEST (no HTML)
.arta/prototype/design-system.css    shared CSS
.arta/prototype/components/<name>.html   shared fragments ({{>name}})
.arta/prototype/screens/<id>.html        each screen body
```

`arta_get_state` returns the small manifest (screen ids/titles/frames, not the
markup) — so reading the design stays cheap as it grows. Pull actual HTML only when
you need it via `arta_get_screen` / `arta_get_component`. To edit a screen,
call `arta_set_screen` (one file); to change something shared, edit the component
or design system (one file) — never rewrite every screen. The dev server re-assembles
the files into one state for the viewer automatically.

You can also `Write` files directly (`.arta/prototype/screens/<id>.html`,
`.arta/state.json`) — the watcher picks any of them up. The MCP tools add
validation, manifest upkeep, and the feedback channel, so prefer them.

## Start with a brainstorm — don't build on the first message

When the dev asks to design something, **do NOT immediately write the spec or build
the prototype.** First brainstorm the idea into a shape you both agree on. Jumping
straight to a hi-fi prototype bakes in unexamined assumptions and wastes work — it's
the #1 complaint about this tool. Brainstorm first, the way `superpowers:brainstorming`
does, then build. For the shaping tools — a fast persona, a journey map that becomes your
screen list, an impact×effort scope cut — load
[`reference/ux-research.md`](reference/ux-research.md); building *this user's* journey to
*this* goal (not a generic <category> app) is also the antidote to look-alike output.

> **HARD-GATE:** no committed spec and no hi-fi prototype build until the dev has
> approved a direction. (Throwaway *lo-fi* sketches **during** the brainstorm are
> fine and encouraged — see below.) Every request goes through this, even a "simple"
> one — that's exactly where wrong assumptions hide. The direction can be short.

The brainstorm, in order:

1. **Open the viewer & ground yourself** — `arta_start_viewer` (so the dev can
   see, and so your lo-fi sketches land somewhere visible), then `arta_get_state`
   / `arta_get_view` and skim the project (files, recent work) so you don't ask
   what you could read.
2. **Check scope.** If the request is really several independent products
   (chat + billing + analytics…), say so first and help split it — don't refine the
   details of something that needs decomposing. Brainstorm the first piece, then build.
3. **Ask one question at a time.** Purpose, users, success criteria, constraints.
   Prefer multiple-choice ("A / B / C — which fits?") over open-ended. One question
   per message — never a questionnaire.
4. **Propose 2–3 approaches** with trade-offs; lead with your recommendation and why.
5. **Present the direction** — a few sentences: what it is, who it's for, the key
   screens, what's in / out of scope, **and a one-line visual direction** — a concrete
   scene sentence (who/where/mood, not "modern and clean") so the look is committed up
   front, not defaulted to the category template later. Ask if it looks right; revise
   until it does.
6. **Get an explicit yes.** Only then `arta_set_phase` to `prototype`, write the
   spec into the rail, and build the first real screens.

**The viewer is your visual companion.** This is a *picture* tool — so when a
question is easier shown than told (a layout choice, two nav patterns, where a
control goes), drop a quick **lo-fi** sketch on the canvas (`arta_set_screen` with
the lo-fi component vocab, or a rough freeform block) and ask the dev to look. Keep
these cheap and disposable — they answer one question, they aren't the product, and
they don't count as "building". Decide per question: a requirements / scope /
trade-off question is text (ask in chat); a "which layout?" question is visual
(sketch it). Don't route everything through the canvas.

## Phase order (prototype-based)

**Brainstorm an agreed direction first** (above) — the four canvas phases below
start only after the dev signs off. The phases are then deliberately
**Prototype + Spec → Data → Flow → Plan**. Start from something clickable, not from
a document.

1. **Prototype + Spec** — sketch the key screens as a wireframe the dev can click
   through, with the spec (goal, users, stories, scope, constraints) in the rail
   beside it. Get the shape of the product right here first. **Set a brand-grade
   design language before the first hi-fi screen** — read `design-systems.md`, pick a
   kit, adapt it, and set it as the foundation (see the styling guidance below).
2. **Data model** — entities, fields (mark `pk`/`fk`/`required`), relationships.
   Rendered as a React Flow ER diagram.
3. **Flow (API)** — design the HTTP API as an **OpenAPI 3** document in `api`:
   routes (method + path), middleware, and per-operation params
   (path/query/header), request body, and responses. The viewer shows it as a
   React Flow graph (routes + middleware chain) with a Postman-style inspector
   (Params · Headers · Body · Responses) and an Export OpenAPI 3 button.
4. **Architecture** — the system-level design (`architecture`): a **C4-style diagram**
   (`nodes`/`edges` — services, datastores, externals, gateways, queues, caches, infra,
   connected by protocol + sync/async), plus **ADRs** (`decisions`), **NFRs** (`nfrs`),
   **security** notes, and the system `stack`. Shown as a React Flow diagram with
   Diagram / Decisions / Security & NFRs views.
5. **Plan** — a **Kanban board** (ClickUp-style): you define the columns as custom
   **statuses** (`plan.statuses`), milestones become **swimlanes** (rows), and tasks
   are cards (each with a `status` id and optional `priority`). Plus the tech `stack`.

Move the phase with `arta_set_phase` as each is settled. Don't race ahead — let
the dev react at each step.

> **HARD-GATE — the prototype is the approval checkpoint.** Build **Prototype + Spec**
> first and **stop there** until the dev has clicked through it and explicitly approved
> it. Do **not** start Data / Flow / Architecture / Plan on your own initiative before
> that sign-off. Within the prototype, work **one screen at a time** — set it,
> self-review it (below), ask the dev to open it (that's also what captures the
> snapshot you review), fold in their reaction, then the next screen. Building every
> phase in one autonomous sprint — five screens, then data, flow, architecture and plan,
> all before the dev has reacted to a single screen — is the **#1 way this tool
> disappoints**. The dev wants to *shape* the product on the canvas with you, not be
> handed a finished pile to accept or reject. "Faster" here is slower: you'll redo the
> later phases once the prototype shifts.

## How to work

1. **On a fresh design request, brainstorm first** (above) and get a direction
   approved before building. Skip this only when the dev is clearly mid-loop already.
2. `arta_get_state` and `arta_get_view` to ground yourself.
3. Make the smallest change that answers the current question. Patch one section.
4. **Self-review and fix it (below) BEFORE you show the dev.** This is a hard gate, not
   an optional polish — every time.
5. Tell the dev in one line what changed and what you want them to react to
   ("Click *Add walk-in* — does that field set feel right?").
6. `arta_get_feedback`; fold their notes in; repeat.
7. When a phase is solid, `arta_set_phase` to the next.

## Self-review — before you hand a screen back (every time)

> **HARD-GATE:** the moment you finish building or changing screens, **review your own
> work and fix what you find — BEFORE you tell the dev to look.** Reviewing the prototype
> is *your* job, not the dev's: never hand back a screen you haven't looked at and expect
> them to run `/arta review` to find your mistakes. (`/arta review` is a manual re-run of
> exactly this — you do it proactively, every time.) The #1 way this tool disappoints is
> handing over a blank placeholder screen, a header copy-pasted onto five screens, or a
> screen with a dead white band — all of which one look would have caught.

**Pre-emit self-critique — score before you look.** Before the per-screen checks, rate the
build you just made **1–5 on six axes**, and let **anything < 3 trigger a revision pass**
*before* you hand back (two passes is normal; a third means the direction is wrong, not the
pixels — rethink it). This catches "competent but generic" that the detector can't:

- **Philosophy** — is there a clear *why*, a position the design takes, or is it just a layout?
- **Hierarchy** — can you tell primary / secondary / tertiary in 2 seconds, or is it one flat band?
- **Execution** — are the details (contrast, accent footprint, spacing rhythm, focus rings, alignment) in spec, or sloppy even if the bones are right?
- **Specificity** — does it look like *this* product, or like a page that could be anyone's?
- **Restraint** — has everything that isn't earning its place been cut (decoration, redundant chrome, padding-for-padding)?
- **Variety** — does this screen share a structural fingerprint with another screen in the app? Score by *structural* distance, not colour. (See "Vary the screen shape" below.)

Those six axes are about whether it looks *designed*. Then run a **usability pass** — a pretty
screen can still be hard to *use*: skim [`reference/ux-heuristics.md`](reference/ux-heuristics.md)
(Nielsen's 10 — dead `data-to` clicks, ungated destructive actions, recognition over recall)
and [`reference/accessibility.md`](reference/accessibility.md) (WCAG A/AA — contrast, labels,
focus, semantics, Thai font-chain), and reach for
[`reference/cognitive-load.md`](reference/cognitive-load.md) when a form or flow feels heavy.
The deep, expanded scorecard for all of this is [`reference/critique-rubric.md`](reference/critique-rubric.md).

Do this for every screen you touched:

1. **Look at the pixels** — `arta_get_screenshot` for each screen, and actually read
   the image. By default it's a real headless-Chrome render of the screen **content**,
   faithful to the browser and captured **on demand** — so a fresh build that nobody has
   opened still has a shot, and "no snapshot yet" is **no excuse** to skip review. Use it
   to judge layout, type, contrast, images, spacing, and overlap. Also check
   `arta_get_view`'s `errors` for runtime/icon problems.

   **Pick the engine by the question you're asking:**
   - *"Is the CONTENT right?"* (layout, text, fonts, colour, spacing, images, dead-band,
     craft, AI-slop) → the **default** (`engine` omitted = `"chrome"`). This is almost
     always what you want.
   - *"Does it FIT THE DEVICE?"* (does the header / bottom CTA clear the status bar,
     notch, and home indicator — the safe-area / chrome-mode check) → **`engine:
     "client"`**, the only shot that includes the device bezel + status-bar overlay. It
     comes from the viewer's own capture, so the dev must have opened that screen first
     (else ask them to, then re-shoot); it can also drift on some CSS, so trust it for the
     device-fit question, not for fine content/contrast.

   In one line: **content → `chrome` (default); device-fit → `client`.**
2. **Run the craft check** — `arta_design_review` on the screen(s). It's Arta's **own**
   offline anti-slop detector (no `npx`, no network — instant), so "no detector on this
   machine" is never an excuse to skip it. Findings come ranked **error → warn → info**:
   - **error** = a serious tell — **fix every one** (gradient-text headline, coloured
     side-stripe border, stripe-gradient background, cramped letter-spacing, card nested in
     a card, 1px-border + wide-shadow ghost card).
   - **warn / info** = softer (transition:all, uniform hover-scale, emoji-as-icon, italic
     heading, placeholder name, mixed icon libraries, over-rounded card) — judge in context.

   It's a static reader (class- and CSS-aware, but it doesn't render), so when a finding
   looks wrong, confirm against the **screenshot** (step 1) before chasing it — fix what the
   pixels show, not what a static read guesses. For a deeper one-off pass, `/impeccable
   audit` is available too.
3. **Run this checklist — fix anything that fails, then re-check:**
   - **No stray or empty screens.** Every screen in the manifest has real content. The
     viewer seeds a `home` placeholder ("Ask Claude Code to design here"); once the real
     screens exist, fill it or `arta_delete_screen` it, and make sure `start` points at
     a real, built screen. A leftover placeholder = the dev clicks it and sees a blank.
   - **Shared chrome is factored, never repeated.** If a header / nav / tab-bar / footer
     shows on 2+ screens, it lives in `prototype.layout` + `prototype.components`
     (`{{>header}}`), NOT pasted into each body. Caught yourself copying it? Move it into a
     component now — `data-nav` gives the active state for free, so one shared bar fits all.
   - **The screen fills its frame — no dead band.** A short / confirmation / empty-state
     screen **centers** its content (don't top-align it and leave a white gap below); a
     list / feed fills top-down. On ios/android/ipad set `safeArea` to the top-edge
     colour so the clock/icons contrast.
   - **Content clears the status-bar overlay (chrome mode).** On ios/android/ipad with
     the default chrome, the status bar + notch + home indicator float ON TOP — so the
     top header and bottom bar/CTA must carry the safe-area padding (≈48/28px ios) or
     they hide under the clock and home pill. Full-bleed media/splash → `chrome:false`.
     **This is the one check that needs `arta_get_screenshot { engine: "client" }`** —
     only that shot draws the bezel + status-bar overlay, so it's how you actually SEE
     whether the content collides with them (the default `chrome` shot is content-only).
   - **Non-Latin text renders in a real font.** Thai / CJK headings set in a Latin display
     face (Instrument Serif / Fraunces / Space Grotesk) fall back to a broken system face —
     collided tone-marks, wrong line-height. Add the `'Noto Sans/Serif Thai'` fallback (or
     use a sans). The screenshot tells you instantly: garbled diacritics = wrong font.
   - **Craft reads** — contrast ≥4.5:1, real images (no gray boxes), the accent actually
     shows up in 3+ places, a real type-scale jump, no AI-slop.
4. **Only once it's clean** do you hand it back — one line on what to react to.

## state.json shape (reference)

```jsonc
{
  "meta": { "name": "AppName", "phase": "prototype" },     // phase ∈ prototype|data|flow|plan
  "spec": {
    "goal": "one sentence",
    "users": ["..."],
    "userStories": ["As a …, I want … so that …"],
    "scope": { "in": ["..."], "out": ["..."] },
    "constraints": ["..."]
  },
  "prototype": {
    "start": "screenId",
    "frame": "web",                         // device frame: web | desktop | ios | android | ipad (screens can override)
    "store": { "cart": 0 },                 // initial mock-store values
    "tokens": {                             // the STRUCTURED design system — set this (it's the source of truth)
      "colors": [ { "name": "brand", "value": "#e8482b" }, { "name": "ink", "value": "#1a1a1a" } ],  // ≥4 — compile to --color-<name>
      "typography": [ { "name": "display", "family": "Fraunces", "size": "3rem", "weight": 600 }, { "name": "body", "family": "Geist", "size": "1rem" } ],
      "fonts": [ { "name": "sans", "value": "Geist, system-ui, sans-serif" } ],  // also: spacing / radii / shadows
    },
    "designSystem": ".btn{ background: var(--color-brand) }",  // EXTRA CSS only — what tokens can't express (the vars come from tokens, don't re-declare :root here)
    "vars": { "brand": "Aurora" },          // default template variables ({{brand}})
    "layout": "{{>header}}{{slot}}{{>footer}}",          // shell wrapping every screen body
    "components": {                          // reusable HTML fragments, referenced as {{>name}}
      "header": "<header>… <a data-to='home' data-nav='home'>Shop</a> …</header>",
      "footer": "<footer>© {{brand}}</footer>"
    },
    "screens": [
      // Freeform screen: html is just the BODY — the layout adds header/footer.
      { "id": "home", "title": "Home", "url": "shop.demo", "html": "<section>…</section>", "vars": {} },
      // Constrained screen: the wireframe component vocabulary
      { "id": "lofi", "title": "Lo-fi", "components": [ /* see vocab */ ] }
    ]
  },
  "dataModel": {
    "entities": [
      { "name": "Entity", "fields": [
        { "name": "id", "type": "uuid", "pk": true },
        { "name": "otherId", "type": "uuid", "fk": "Entity", "required": true }
      ] }
    ],
    "relationships": [ { "from": "A", "to": "B", "type": "N:1", "label": "for" } ]
  },
  "api": {                                    // the Flow tab — OpenAPI 3 shaped
    "info": { "title": "App API", "version": "1.0.0" },
    "servers": [ { "url": "https://api.app.com/v1" } ],
    "x-middleware": [ { "name": "auth", "description": "Require a Bearer token" } ],  // middleware registry
    "paths": {
      "/items/{id}": {
        "get": {
          "summary": "Get an item",
          "x-middleware": ["cors", "auth"],   // middleware applied to this operation
          "x-screens": ["itemDetail"],        // prototype screen ids that call this route (screen→API layer)
          "parameters": [
            { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } },
            { "name": "expand", "in": "query", "schema": { "type": "string" }, "description": "..." },
            { "name": "Authorization", "in": "header", "required": true, "schema": { "type": "string" } }
          ],
          "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "id": { "type": "string" } } }, "example": { "id": "x" } } } }, "404": { "description": "Not found" } }
        },
        "post": {
          "summary": "Create",
          "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["name"], "properties": { "name": { "type": "string" } } }, "example": { "name": "x" } } } },
          "responses": { "201": { "description": "Created" } }
        }
      }
    }
  },
  "architecture": {                           // the Architecture tab — system design
    "stack": ["Node/Express", "Postgres", "Redis"],
    "nodes": [                                 // C4-style components
      { "id": "web", "name": "Web app", "kind": "client", "tech": "React", "deployment": "Vercel" },
      { "id": "api", "name": "API", "kind": "service", "tech": "Node/Express", "deployment": "AWS ECS", "description": "..." },
      { "id": "db", "name": "Primary DB", "kind": "datastore", "tech": "Postgres 16" }
    ],
    "edges": [                                 // protocol + sync|async
      { "from": "web", "to": "api", "protocol": "REST", "mode": "sync" },
      { "from": "api", "to": "db", "protocol": "SQL", "mode": "sync" }
    ],
    "decisions": [                             // ADRs
      { "id": "ADR-1", "title": "Use Postgres", "status": "accepted", "context": "…", "options": ["Postgres", "Mongo"], "decision": "…", "consequences": "…" }
    ],
    "nfrs": [ { "name": "Availability", "target": "99.9%", "note": "…" } ],
    "security": [ { "boundary": "public → API", "note": "JWT auth, rate-limit at gateway" } ]
  },
  "plan": {                                   // the Plan tab — a Kanban board
    "stack": ["React", "Node"],
    "statuses": [                              // the columns (ClickUp-style); omit for to-do/in-progress/done
      { "id": "backlog", "name": "Backlog", "color": "#71717a" },
      { "id": "doing", "name": "In progress", "color": "#fbbf24" },
      { "id": "done", "name": "Done", "color": "#34d399" }
    ],
    "milestones": [                            // each milestone is a swimlane (row)
      { "name": "M1", "tasks": [ { "title": "…", "status": "doing", "priority": "high" } ] }  // priority ∈ urgent|high|normal|low
    ]
  }
}
```

### Freeform screens (preferred for hi-fi)

Put a real design into the device: write `html` for the screen and share a
`designSystem` (CSS) across all screens. Each freeform screen renders in an
isolated browser frame, so use full HTML/CSS — your own classes, `body`,
fonts, grid, the lot. A tiny runtime wires interactivity through plain
attributes — **these are the only "wires" you get**:

- `data-to="screenId"` — **how you change / navigate between screens.** Put it on ANY
  clickable element (a button, a card, a list row, a nav link) and a click goes to that
  screen id. This is the ONLY routing — to "go to another screen" / "change the page",
  `data-to` is the whole answer. Do **NOT** reach for `<a href>` (the runtime intercepts it
  back to the screen list), `onclick`, a router, `postMessage`, or any `navigate`/`goto`
  call — they don't exist here.
- `data-inc="cart"` / `data-dec="cart"` — bump a numeric store key by ±1
  (comma-separate multiple keys).
- `data-set="key=value;other=2"` — set store keys on click (numbers auto-parse).
- `data-bind="cart"` — element's text shows the live store value.
- `data-show="cart"` or `data-show="step==2"` — show the element only when truthy
  / equal; hidden otherwise.

**This list is the COMPLETE interactivity contract — there is no other navigation or state
API.** You never need to read the Arta viewer / runtime source (or grep the plugin) to find
how routing works: it's `data-to`, full stop. Anything a screen does on click is one of the
six attributes above.

The store is a flat object of mock values (declare defaults in `prototype.store`).
It persists across screen navigation, so a cart count set on the home screen is
still there on the cart screen. Build the design system once, compose screens
from it, and lean on these attributes for the clickable behaviour — no real
backend, just believable mock state. You can read the current store via
`arta_get_view`.

**Styling & icons — Tailwind and lucide are loaded in every freeform screen.**
Use them; do not hand-roll what they give you, and **never use emoji as icons.**

- **Pick a brand-grade design language FIRST — don't invent generic tokens.** Before
  building any screen, **read `design-systems.md`** (next to this file): a library of
  opinionated, ready-to-adapt systems (Ink · Graphite · Clay · Mist · Signal). Pick the
  one that fits the brief, swap its accent + brand to the project, and set it as the
  foundation with `arta_set_design_tokens` + `arta_set_design_system`. This is the
  single biggest lever on whether the output looks *designed* or looks like "an AI made
  a webpage." Starting from generic grays + a blue accent is the #1 tell.
  - **`design-systems.md` is the *dress*; [`component-cookbook.md`](component-cookbook.md)
    is the *shape & parts*.** Once the system is set, build each screen from the cookbook's
    app archetypes (navs, page headers, data tables, forms, empty states, …) — token-driven
    and slop-free — instead of re-deriving chrome that drifts into the generic look.
- **Make it look like *this* project, not its category — the category-reflex check.** A kit
  is a starting *structure*, never a finished skin. If you set one and only swap the brand
  name, every app in that category ships the same look — **the #1 reason two different briefs
  come back looking identical.** Three moves break that:
  - **Pick the colour strategy on purpose.** *Restrained* (tinted neutrals + one accent ≤10%),
    *committed* (one saturated colour on 30–60% of the surface), *full palette* (3–4 named
    roles), or *drenched* (the surface IS the colour). Product/tool UI floors at restrained; a
    brand / marketing / launch / portfolio surface earns committed-or-louder. Beige-plus-one-
    accent on a bold brief is a hedge, not a decision.
  - **Warmth comes from the accent, not the page.** "Premium / editorial / roaster / artisan"
    pulls every build toward a warm-beige paper background — and *that is the cream tell*
    (`arta_design_review` reds it as `cream-palette`). Keep the surface a true off-white
    (near-zero chroma — red and blue channels within ~4, e.g. `#fbfaf8`, not `#f4f1ea`) or
    commit to a deep / drenched brand surface; carry the warmth in the **accent, type, and
    imagery** instead. A warm page background is the convergence default, not a design decision.
  - **Give the project its OWN accent.** The hex in each kit is an *example*, not a default —
    choose a fresh accent hue per project (nudge the neutral / radius / type-scale too when it
    helps). Two builds must not share a palette just because they share a register.
    `arta_design_review` flags a kit's literal accent (and the cream / AI-purple defaults) left
    unchanged.
  - **Run the reflex check before you commit the system.** *First-order:* could someone guess
    the palette + type from the **category alone** ("fintech → navy + gold", "AI tool → cream +
    purple", "dashboard → dark + indigo")? If yes, it's the training-data reflex — rework it.
    *Second-order:* could they guess it from the category **plus the obvious anti-move** ("the
    AI tool that's *not* cream → editorial italic-serif")? Then you only dodged the first
    reflex; keep going until neither is predictable. Anchor it with one concrete **scene
    sentence** — who uses this, where, in what light/mood ("a night-shift dispatcher in a dim
    ops room", never "modern and clean") — and name **2–3 ways this build must look unlike the
    generic version of its category.**
- **Load the deep craft reference for what you're working on.** `design-systems.md` and
  `component-cookbook.md` give you the *kit* and the *parts*; the [`reference/`](reference/)
  library is the **craft knowledge** — load the one file relevant to the decision in front of
  you instead of guessing. **First, read the matching register reference — non-optional, it
  sets opposite defaults that keep two briefs from converging:**
  - **[`reference/register-brand.md`](reference/register-brand.md)** when *design IS the
    product* — a marketing / landing / campaign page, a portfolio, an image-led brand. The bar
    is distinctiveness; committed-or-louder colour; imagery required.
  - **[`reference/register-product.md`](reference/register-product.md)** when *design SERVES a
    task* — an app UI, dashboard, admin, settings, tool. The bar is earned familiarity;
    restrained floor; every control ships all its states.

  Then pull the craft file for the work: [`typography`](reference/typography.md) ·
  [`color`](reference/color.md) · [`layout`](reference/layout.md) ·
  [`motion`](reference/motion.md) · [`interaction`](reference/interaction.md) ·
  [`imagery`](reference/imagery.md) · and [`critique-rubric`](reference/critique-rubric.md)
  for the deep per-screen self-review (the six axes, expanded). They're Arta-native (the five
  fonts, tokens, mock state, the detector) — read on demand, not all at once.
  - **UX & usability** — a pretty screen can still be hard to *use*. These cover what the
    visual craft doesn't: [`ux-heuristics`](reference/ux-heuristics.md) (Nielsen's 10, +
    persuasion) and [`accessibility`](reference/accessibility.md) (WCAG 2.1 A/AA — Arta has the
    real HTML, so focus order / labels / semantics ARE checkable) for the self-review pass;
    [`cognitive-load`](reference/cognitive-load.md) when a form / flow feels heavy;
    [`ux-research`](reference/ux-research.md) in the **brainstorm** to shape *whose* journey
    you're building (the antidote to a generic <category> app); and
    [`ai-product-patterns`](reference/ai-product-patterns.md) **when the prototype itself is an
    AI product** (chat, copilot, generator) — input patterns, blank-slate wayfinding, trust
    signals, human-in-the-loop governors.
- **Then build every screen from those tokens.** The tokens show as a style guide in the
  Prototype → **Design system** sub-view and compile to CSS custom properties injected
  into every screen. Style screens from the tokens (`var(--color-brand)`,
  `bg-[var(--color-accent)]`, `rounded-[var(--radius-md)]`, the kit's `.display` class)
  plus shared `prototype.components` — one source of truth, never ad-hoc values per
  screen. **No raw hex in a screen body** (no `style="color:#1a1a1a"`, no `bg-[#f5f5f5]`,
  no `text-[#666]`): every colour is a `var(--color-*)` or a Tailwind class that maps to one.
  Need a shade the kit doesn't have (a brighter heading ink, a tint)? **Add it to the tokens**
  (`arta_set_design_tokens`) and reference the var — don't inline the hex. Hardcoded hex in
  screens is the #1 reason a build "has a design system but doesn't use it." This bites hardest
  in **data-dense apps**: the repeated **semantic palette** (status / priority / severity badge
  colours — the same in-progress purple, done green, warning amber on every screen) belongs in
  the tokens too (`status-done`, `severity-high`, …). Inlining the same `#hex` 10+ times across
  screens — even a consistent one — is the classic miss; define it once as a token, reference the var.
- **Craft, not just absence of slop** — commit to ONE color strategy (restrained /
  committed / drenched), pair fonts on a contrast axis (serif + sans, geometric +
  humanist, or one family in many weights — the 5 preloaded families: Geist, Geist Mono,
  Instrument Serif, Fraunces, Space Grotesk), keep a single spacing rhythm, and hold
  radius / shadow / motion consistent across screens. Use **real content** (real copy,
  real names, real prices) — never lorem ipsum or "Card title". Generous whitespace and
  one confident accent beat many timid ones.
- **Non-Latin text (Thai, CJK, Arabic…) needs a font that covers the script.** The five
  display/sans faces above are **Latin-only** — set a Thai heading in `'Instrument Serif'`
  or `'Fraunces'` and the Thai glyphs fall back to a system serif: tone-marks and vowels
  collide, line-height goes wrong, and it reads broken. Two Thai faces are also preloaded —
  **`'Noto Sans Thai'`** and **`'Noto Serif Thai'`** — so build a fallback chain that lets
  Latin and Thai each use a real face: `font-family: 'Fraunces', 'Noto Serif Thai', serif`
  (display) and `'Geist', 'Noto Sans Thai', sans-serif` (body). Body text already gets
  `'Noto Sans Thai'` by default, but **any element where you override the family for a Latin
  display face must add the matching Noto Thai fallback** — or reserve the Latin display
  face for genuinely Latin runs (a brand name, a queue number `A14`) and set the Thai
  heading in a sans. Always confirm in the screenshot that non-Latin headings render clean.
- **Commit — timidity is the #1 reason solid structure still reads "AI-generic".** Two
  places agents play it too safe, and both flatten a design into "competent but generic":
  - *Colour:* the accent has to actually show up — on the primary action **and** the
    active/selected state **and** a key highlight (3+ places), not one lonely button. Tint
    the neutrals toward the brand hue (a warm off-white, a cool slate); flat grays and
    pure `#fff`/`#000` read as an unstyled browser default. "Restrained" means *few* colours
    used confidently, not *no* colour — a kit's accent ≤10% still has to be visibly present.
  - *Type scale:* make the jump obvious — the display/hero size ≥ ~2× the body and heavy;
    labels small, uppercase, muted, slightly spaced. When H1, card titles, metric values and
    body all collapse into one narrow size band, hierarchy dies and it looks templated. Pick
    a real scale and use its extremes (e.g. a 48px+ hero number over a 11px muted label).
  - *Interactive state must read:* a selected / active / current item needs an unmistakable
    change — shift the **fill** (a tint), not just a border, and use a solid control (a filled
    radio / check, not a ghost outline). On dark themes a border-only or faint-outline "selected"
    state is nearly invisible; the dev can't tell what's chosen. **Do NOT mark it with a thick
    coloured `border-left` bar** — that's the banned side-stripe, and an active nav / sidebar /
    list row is exactly where the reflex sneaks in. Tint the row's background (optionally a
    1px full border or a subtle inset highlight via `box-shadow: inset`), never a left accent stripe.
- **Images: decide deliberately — a REAL image, or an intentional skeleton+colour. Never a
  bare solid fill.** A flat coloured/gray rectangle dropped where a photo belongs is one of
  the loudest "an AI made this" tells; it makes every other decision read as unfinished.
  Make an explicit call per image slot:
  - **Real image** — use it whenever a photo genuinely helps. Always set width/height (or an
    `aspect-[…]` wrapper) + `object-cover` so layout stays put. Pick a source that RESOLVES
    (verified working June 2026):
    - **Unsplash** `https://images.unsplash.com/photo-<id>?w=<W>&q=70&auto=format` — the
      preferred source. Use a real photo id you're confident exists (a guessed id 404s).
      **`picsum.photos` is dead — do NOT use it** (every URL times out → blank). The old
      `source.unsplash.com/...` random endpoint is also retired.
    - **`https://loremflickr.com/<W>/<H>/<keyword>`** — when you have no specific Unsplash id:
      a live keyword-relevant random photo (the picsum replacement). Add `?lock=<n>` to keep
      it stable across reloads.
    (The platform catches a failed `<img>` and swaps it to a skeleton tile, so a dead URL
    won't show a broken glyph — but a screen full of skeletons is still a fail. Use a source
    that resolves.)
  - **Skeleton + colour** — when a real image isn't right (avatars, logos, an icon slot, or
    the subject must match and you have no trustworthy URL), make the placeholder *intentional*:
    `class="hs-cover"` (a brand-tinted gradient surface) or `class="hs-img-skeleton"` (a tinted
    loading tile), optionally with a centred lucide glyph or a monogram. Avatars: initials on a
    tinted disc beat a gray circle every time.
  Either way the box is sized and on-brand — never a lone `bg-[#…]` block standing in for a photo.
- **Write Tailwind utility classes — NOT inline `style="…"`.** The viewer injects
  `@tailwindcss/browser@4` (compiled live), so utilities are the default way to style
  *everything*: layout, spacing, colour, typography, radius, shadow, hover/focus
  states. **Do not reach for `style="…"` out of habit** — it makes the markup
  unreadable and the design inconsistent. Reserve inline `style` for the rare
  genuinely-dynamic value no utility can express (an exact computed width, a one-off
  gradient).
  - ✅ `class="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100"`
  - ❌ `style="display:flex;align-items:center;gap:12px;border-radius:12px;background:#18181b;padding:8px 16px"`
  - Repeated pattern? Define a class once in the `designSystem` CSS (Tailwind `@apply`
    works there) and reuse it — don't paste the same inline styles onto every element.
  - A `designSystem` (custom CSS / tokens) coexists with utilities; reach for it only
    for what utilities can't express, not as a substitute for classes.
- **lucide icons** instead of emoji: `<i data-lucide="search"></i>`. Size and colour
  with classes — `<i data-lucide="shopping-cart" class="w-5 h-5 text-sky-500"></i>`
  (the SVG inherits `currentColor`). Names are the kebab-case lucide names from
  lucide.dev/icons. The runtime calls `lucide.createIcons()` on every render, so new
  icons appear automatically. An **unknown name renders nothing** (a blank gap — e.g.
  `chevron-up-down` doesn't exist; it's `chevrons-up-down`); the error feed flags any
  name it couldn't find, so check `arta_get_view` (or the screenshot) and fix it.
  - **Brand / social icons are NOT in lucide's core** (`github`, `facebook`, `instagram`,
    `youtube`, `linkedin`, `discord`, … render BLANK — the classic footer row of empty gaps).
    Use **Iconify** for these (below), not a `data-lucide` brand name.
- **Iconify — works alongside lucide for brand logos + any non-lucide icon.** A second
  system is loaded: the `<iconify-icon>` web component, with 200k+ icons across every set.
  Usage: `<iconify-icon icon="set:name"></iconify-icon>` — it fetches the icon on demand and
  renders inline SVG (inherits `currentColor`; size with `width`/`height`, a `w-/h-` class,
  or font-size). Reach for it when lucide's core doesn't have what you need:
  - **Brand / social logos** → `simple-icons:*` — `<iconify-icon icon="simple-icons:facebook"></iconify-icon>`,
    `simple-icons:instagram`, `simple-icons:github`, `simple-icons:line`, `simple-icons:tiktok`, …
  - **Anything else lucide lacks** → other sets — `mdi:*` (Material), `ph:*` (Phosphor),
    `tabler:*`, `fa6-brands:*`, etc. Browse at icon-sets.iconify.design.
  Keep it tasteful: **lucide stays the default for UI glyphs** (one consistent stroke style);
  use Iconify mainly for brands and the occasional gap, not to scatter clashing sets across
  one screen.
  **Emoji are not icons — use lucide (or Iconify for brands).**
- All three (Tailwind, lucide, Iconify) load from a CDN, so the prototype needs network;
  offline, classes go unstyled and icons stay blank.

**Light / dark theme switching — built in, just opt your toggle in.** The runtime applies a
theme on load (the visitor's saved choice, else their OS preference) and exposes it as a
`.dark` class + `data-theme="dark|light"` on `<html>`. To add a working theme switch, put
`data-theme-toggle` on any element (a button, an icon) — clicking it flips the theme and
persists it. No JS of your own. Then style both themes either way:
- **Tailwind `dark:` utilities** (made class-based, so they follow the toggle, not just the
  OS): `<body class="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">`.
- **or a `.dark{}` token block** in your design system that swaps the CSS variables:
  `:root{--color-bg:#fff;--color-fg:#18181b}` + `.dark{--color-bg:#0b0b0c;--color-fg:#fafafa}`
  — the body bg/text already read `var(--color-bg)`/`var(--color-fg)`, so the whole screen
  follows. (Combine both freely.)
- Swap the toggle's own glyph with the same variant — `<i data-lucide="sun" class="dark:hidden"></i><i data-lucide="moon" class="hidden dark:block"></i>` — no script needed.
- Only build a toggle when the design calls for one; a light-only (or dark-only) prototype
  just doesn't add `data-theme-toggle`. If you support dark, give EVERY screen dark styling
  (test it) — a half-themed flow with one white screen reads as a bug.
- The **Design system** sub-view detects a dark theme (a `.dark{}` block, or any component
  using `dark:`) and shows a light/dark toggle: it previews the colour swatches (a swatch
  with a `.dark{}` override shows its dark value) and the component cards in the chosen
  theme. So put your dark token overrides in a `.dark{}` block in `arta_set_design_system`
  and they're inspectable there — not only inside a screen.

**Avoid AI-slop — these read as "an AI made this".** Don't ship them; rework the
element instead. (Run `arta_design_review` to catch them automatically.)

- **Side-stripe borders** (a thick coloured `border-left`/`right` as a card/alert
  accent) — use a full border, a background tint, or nothing.
- **Gradient text** (`background-clip:text` + gradient) — use one solid colour;
  emphasise with weight/size.
- **Glassmorphism by default** (decorative blur/glass) — rare and purposeful, or none.
- **Identical card grids** (same icon + heading + text card repeated) and the
  **hero-metric template** (big number, small label, gradient accent).
- **A tiny uppercase tracked eyebrow above every section**, or **01/02/03 numbered
  section markers** as default scaffolding.
- **Low-contrast text** — body must hit ≥4.5:1; never grey text on a coloured fill.
- **Over-rounded cards** (radius ≥ 24px) — cards top out ~12–16px (pills are fine).

*(The slop list above + the screen-shape variety below draw on **Hallmark** — MIT,
github.com/Nutlope/hallmark — and the impeccable design skill. `arta_design_review`
encodes the deterministic subset as gates.)*

**Vary the screen shape — structural variety, not just colour.** The biggest reason a
multi-screen build reads "templated" isn't the palette — it's that **every screen has the
same shape** (hero → 3 cards → CTA, or six identical vertical card-lists). Match each
screen's **shape to its job**, and make consecutive screens differ *structurally*, not just
in content. A small menu of app/marketplace shapes to pick from (name the shape before you
build the screen — it's the Variety axis of the self-critique):

- **Dashboard / bento** — modular tiles of *varying* size (a metric, a chart, a list, a
  callout), rhythm from size variation — not a uniform card grid.
- **Master–detail / split** — list or nav rail on one side, the selected item's detail on
  the other (inbox, settings, admin).
- **Feed / timeline** — a vertical stream of *heterogeneous* items (not all the same card).
- **Index / browse** — a filterable grid or list of entities; the catalog *is* the page
  (marketplace, course list, search results).
- **Detail / profile** — one entity's hero + supporting sections (product, course, person).
- **Workbench / canvas** — a primary work surface with supporting panels (editor, builder).
- **Stepped flow / wizard** — sequential steps with a progress spine (checkout, onboarding).
- **Focused / empty state** — one centered purpose, content vertically centered, no dead
  band (login, confirmation, zero-data).
- **Table / data-dense** — a real table or spec sheet when the data is the point (don't
  fake it as cards).
- **Marketing / landing** — only when it genuinely *is* one; then vary the **hero** itself
  (a single bold statement, a stat-led number, a split diptych, a product mockup) rather
  than defaulting to centered-everything.

**Reach-for component archetypes (default away from the AI-fingerprint chrome).** For
ready-to-adapt, slop-free building blocks — side rail, top bar, ⌘K, page header, stat tile,
data table, browse card, 8-state form field, segmented control, empty state, status badge,
inline alert, stepper — **read [`component-cookbook.md`](component-cookbook.md)** (next to
this file) and assemble the screen from its parts. Two pieces are where the generic look
creeps in — pick deliberately, and don't repeat the same one on every screen:

- **Navigation** — a **side rail** (icon+label) is the app default; a **bottom tab bar** for
  mobile; a **top bar** (wordmark · sections · one action) for marketing/content; **⌘K /
  command palette** or a **floating pill** when it fits. Avoid the reflex "wordmark-left +
  4 links centered + button-right + 1px hairline + white bg" bar on *every* screen.
- **Footer** — app screens usually need **none** (or a slim status strip). For marketing,
  avoid the default "4 columns of links + social-icon row + tiny copyright"; a single
  statement line, a newsletter-first close, or an index-style link list reads less templated.

**Pick the device frame** with `prototype.frame` (or per-screen `frame`):
`web` (browser, default), `desktop` (native app window), `ios` or `android`
(phone), `ipad` (tablet). The phone frames render the page at ~390px wide, the
`ipad` frame at ~780px, and **`web`/`desktop` at a real desktop width (~1280px),
scaled to fit the canvas** — so `md:`/`lg:`/`xl:` utilities and your `@media` rules
fire exactly as they would in a browser at that width (the `web` preview shows the
desktop nav, not the mobile hamburger, even when the canvas pane is narrow). Write
responsive CSS accordingly. Choose the frame that matches what you're actually
building — a mobile app spec should preview in `ios`/`android`, a tablet layout in
`ipad`, a responsive site in `web`, not a phone. A `web`/`desktop` prototype can
still be previewed at phone/tablet size (the viewer wraps it in a mobile **browser**
frame — Safari-style chrome, not a native status bar), so make a responsive site work
all the way down to mobile widths; its `safeArea` colour paints that browser status bar.

**Device frame & safe area (ios / android / ipad).** Content is **always
full-screen** — it fills the whole device, edge-to-edge. There are **two chrome
modes**, set with `chrome` (per screen or `prototype.chrome`); there is no on/off
toggle in the UI.

1. **`chrome: true` (default) — status bar overlaid.** The iOS-style status bar
   (showing the **real** current time), the notch / Dynamic Island, and the home
   indicator float **on top of** your content. Because they overlay it, **you must
   reserve the safe area yourself** — pad the screen's top and bottom so nothing hides
   under the status bar/notch or the home pill. Rough insets to bake into the top-level
   padding (or a sticky header):
   - `ios` — top **≈ 48px** (status bar + Dynamic Island), bottom **≈ 28px** (home indicator)
   - `android` — top **≈ 32px**, bottom **≈ 20px**
   - `ipad` — top **≈ 32px**, bottom **≈ 24px**

   Also set **`safeArea`** to the screen's **top-edge colour** (the colour directly
   under the status bar) so the clock + icons auto-contrast (light on dark, dark on
   light): `arta_set_frame` / `arta_set_screen`, or `"safeArea": "#0b0b0c"` in state.
   A sticky/fixed top bar must include the top inset so it sits clear of the status bar.

2. **`chrome: false` — true edge-to-edge, no status bar.** Drops the status bar,
   notch, and home indicator entirely; the design owns every pixel and needs **no**
   safe-area padding. Use for splash, login, onboarding, camera, full-bleed media, or
   any screen that draws its own top/bottom bars.

Default to mode 1 for normal app screens (pad for the overlay), and switch to
`chrome: false` for the full-bleed cases above.

Example button: `<button class="btn" data-inc="cart">Add to cart</button>` and a
header badge `<span data-bind="cart">0</span>`.

### Common content patterns — rails & cards

Content screens (a marketplace, a course list, a feed) lean on the same two
primitives over and over, and they're the ones agents most often get *almost*
right (gray cover boxes, a card grid that won't scroll, no peek). The frame ships
both as **opt-in classes** so you compose instead of re-deriving fiddly CSS — pair
Tailwind on top for everything else.

- **Horizontal rail** — `class="hs-rail"`: a sideways-scrolling row that snaps, hides
  its scrollbar, and lets the next item **peek** past the edge (the affordance that
  says "there's more"). Use it for a category strip and for a "recommended" card row.
  Children keep their own width — give each a fixed width (`w-64`, `w-40`).
- **Cover placeholder** — `class="hs-cover"`: a brand-tinted gradient surface for an
  image slot, **never a flat gray box** (the loudest slop tell). Lay a real `<img>`
  over it when you have one; otherwise it's a deliberate surface, not an empty rectangle.
  (It reads `--color-primary` / `--color-brand` / `--color-accent` from your tokens.)

A recommended-courses rail, end to end (mirrors the marketplace home above):

```html
<section class="px-5">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-lg font-semibold">คอร์สแนะนำ</h2>
    <a data-to="courses" class="text-sm font-medium text-[var(--color-primary)]">ดูเพิ่ม</a>
  </div>
  <div class="hs-rail -mx-5 px-5">
    <article data-to="courseDetail" class="w-64 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div class="hs-cover relative h-32">
        <span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-medium text-white"><i data-lucide="play" class="h-3 w-3"></i>ออนไลน์</span>
        <span class="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">-40%</span>
      </div>
      <div class="p-3">
        <h3 class="font-semibold">แต่งหน้าออกงานมือโปร</h3>
        <p class="mt-0.5 text-xs text-zinc-500">โดย ครูพิม · 12 บทเรียน</p>
        <div class="mt-2 flex items-center gap-1 text-xs"><i data-lucide="star" class="h-3.5 w-3.5 fill-amber-400 text-amber-400"></i><span class="font-medium">4.9</span><span class="text-zinc-400">(320)</span></div>
        <p class="mt-1"><span class="font-bold text-[var(--color-primary)]">฿1,490</span> <span class="text-xs text-zinc-400 line-through">฿2,490</span></p>
      </div>
    </article>
    <!-- more <article> cards … -->
  </div>
</section>
```

`-mx-5 px-5` lets the rail bleed to the device edges while its content keeps the page
gutter — so the next card peeks at the *screen* edge, not at a margin. **Vary the
cards** (real titles, prices, ratings — never the same card cloned); an identical card
grid is its own slop tell. Review a long stack of these end to end with
`arta_get_screenshot { full: true }`.

### Share a layout & components — DO NOT repeat markup

Put anything that appears on more than one screen (header, footer, nav, cards)
into **`prototype.components`** and a **`prototype.layout`**, then make each
screen's `html` only the part that's actually different. This is the rule, not a
nicety: when the dev says "change the header", you edit **one** component and
every screen updates — no hunting through screens, nothing missed.

- `prototype.layout` — the page shell. `{{slot}}` is where the screen body goes;
  `{{>name}}` pulls in a component. e.g. `"{{>header}}{{slot}}{{>footer}}"`.
- `prototype.components` — `{ "header": "<header>…</header>", ... }`. Components
  can include other components and use variables.
- `{{name}}` variables resolve from `screen.vars` then `prototype.vars` — use
  them for the "change just one spot per screen" cases (titles, labels).
- **Active nav comes for free:** put `data-nav="screenId"` on a link and the
  current screen's link gets an `.is-active` class automatically. So one shared
  header works for every screen — never fork the header just to flip which tab
  looks active.
- A screen can opt out with `"layout": false` (renders its own full html) — use
  this only for genuinely standalone pages (a landing splash, an auth screen).

Workflow: build the design system + layout + components first, then add screens
as thin bodies. When iterating, prefer `arta_patch_state` with just
`{ "prototype": { … } }`, editing the shared piece — not every screen.

### Prototype component vocabulary (lo-fi alternative)

Each screen is a flat list of components. A `to` on a `nav` item or `button`
makes it navigate to that screen id when the dev clicks it — that's what makes
the prototype clickable.

- `{ "type": "nav", "items": [{ "label": "Board", "to": "board" }] }`
- `{ "type": "heading", "text": "…" }`
- `{ "type": "text", "text": "…" }`
- `{ "type": "input", "label": "…", "placeholder": "…" }`
- `{ "type": "select", "label": "…", "options": ["…"] }`
- `{ "type": "button", "text": "…", "to": "screenId", "variant": "primary" }`
- `{ "type": "row", "children": [ … ] }`  — horizontal group
- `{ "type": "card", "children": [ … ] }`
- `{ "type": "table", "columns": ["…"], "rows": [["…"]] }`
- `{ "type": "list", "items": ["…"] }`
- `{ "type": "badge", "text": "…" }`
- `{ "type": "image", "label": "what goes here", "h": 120 }`  — placeholder
- `{ "type": "divider" }`

## Rules

- **Brainstorm before you build.** Your first reply to a new design request is a
  question, not a prototype. Get a direction approved first (above) — only lo-fi
  sketches are allowed before that.
- Keep `meta` valid at all times (it must always have `name` and `phase`); the
  viewer shows a waiting/error state otherwise.
- Patch, don't clobber: use `arta_patch_state` so untouched sections survive.
- One change, one question. The viewer is a conversation, not a deliverable.
- Read feedback before assuming you're done. The dev's clicks are the spec.

## Handing off to implementation — build with subagents

Arta is for **design**. Once the dev approves the design and the **Plan**
board is filled in, stop designing and build the real thing — and build it with
**`superpowers:subagent-driven-development`**, not one long hand-coded context.

- The **Plan** Kanban *is* the implementation plan: each card is a task. Work them
  in order (respect the swimlane/milestone grouping and status), **one implementer
  subagent per task** — never parallel implementers.
- The `.arta/` artifacts are the **source of truth** each subagent reads — point
  subagents at them instead of re-describing the work:
  - `spec` — intent, users, scope, constraints
  - the prototype HTML + `designSystem` — the exact UI to build (it's real HTML/CSS)
  - `dataModel` — entities, fields, relationships
  - `api` — the OpenAPI 3 routes, middleware, params, bodies, responses
- Follow that skill's loop: per-task brief → implement + test + commit → task review
  (spec compliance **and** code quality) → fix until clean → final whole-branch review.
- **Drive the board as you go:** move each card with `arta_set_task` (e.g. to your
  `doing` / `review` / `done` status ids) as its subagent progresses, so the dev
  watches implementation advance live on the same Kanban they designed.
