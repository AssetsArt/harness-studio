---
name: harness-studio
description: Use during the DESIGN phase of building a new app/feature, instead of dumping a wall of text. ALWAYS brainstorm the idea into an agreed direction first (questions one at a time, like superpowers:brainstorming) — never jump straight to a spec or prototype. Then drive Claude Code to build a shared, live design canvas (.harness/state.json) that the dev watches in the Harness Studio viewer — spec, prototype, data model, flow, plan — iterating from the dev's clicks and feedback. Trigger when the user wants to "design", "wireframe", "prototype", "sketch the data model/flow", "plan a feature visually", or says "open the harness / let's design this in the studio".
---

# Harness Studio — prototype-based design loop

You are designing **with a picture, not a wall of text.** The dev has the Harness
Studio viewer open (`bun run dev`). Everything you write to `.harness/state.json`
appears on their screen instantly with a cyan flash. You see what they're looking
at and read their feedback through the MCP server. Design is one tight loop.

## The loop

```
  you write state.json  ──▶  viewer repaints (the dev sees it)
          ▲                              │
          │                              ▼
  harness_get_feedback  ◀──  dev clicks the prototype, leaves a note
```

Never describe a screen in prose when you could render it. Show, ask, adjust.

## Tools (MCP server: harness-studio)

- `harness_start_viewer` — **call this once at the very start of a session** to open
  the viewer for the dev. It launches the viewer that ships **inside the installed
  plugin** (so it always matches the plugin version — no stale `npx`/`bunx` cache),
  pointed at this project's `.harness/`. It's idempotent (re-running just returns the
  URL) and installs the viewer's deps on first run. Tell the dev the URL it returns
  (default `http://localhost:7317`).
- `harness_restart_viewer` — stop the running viewer and relaunch it from the
  installed plugin, so it serves the **latest** build. Use this after the plugin
  updates (the `/hns update` / `/hns restart` flow calls it): an already-open viewer
  keeps serving the old assets until it's restarted. The dev no longer clears caches
  or kills processes by hand.
- `harness_get_state` — read the canvas before editing. Always start here.
- `harness_get_view` — see what the dev is looking at right now (active tab +
  prototype screen). Check this before changing a screen so you edit what they see.
- `harness_set_state` — write the whole canvas. Use for the first build or a full rewrite.
- `harness_patch_state` — merge one top-level section (`spec`, `dataModel`,
  `flow`, `plan`, or the prototype manifest). Your workhorse for the structured tabs.
- `harness_set_phase` — record the current phase (`prototype → data → flow → architecture → plan`), shown in the status bar. Tabs are free routes the dev can revisit in any order, so this just marks where you're working.
- `harness_get_api` / `harness_set_api` — read/write the `api` section (the Flow
  tab) as an OpenAPI 3 document: routes, middleware (`x-middleware`), and
  per-operation params (path/query/header), request body, and responses. Tie a
  route to the prototype screens that call it with `x-screens: ["screenId"]` — the
  Flow graph then draws screen → API edges (which screen hits which endpoint,
  through which middleware).
- `harness_get_architecture` / `harness_set_architecture` — read/write the
  `architecture` section (the Architecture tab): the C4-style `nodes`/`edges` (system
  diagram), `decisions` (ADRs), `nfrs`, `security` notes, and `stack`.
- `harness_get_plan` / `harness_set_plan` — read/write the `plan` Kanban board:
  `statuses` (columns), `milestones` (swimlanes), and tasks (`status` id +
  `priority`). `harness_set_task` adds/updates one card by milestone + title —
  use it to **move a card** (set its `status`) without resending the whole plan.
- `harness_get_feedback` — drain notes the dev left in the viewer. Check it after
  every meaningful change and act on what you find. Notes may include an `element`
  (tag/text/selector) when the dev clicked a specific element to comment on it —
  use it to target the exact thing they mean.
- `harness_get_screenshot` — get a PNG of how a screen actually renders (the same
  pixels the dev sees). Use it to **check your own work visually**, not just from
  the HTML — after building or changing a screen, look at it.
- `harness_get_view` also returns `errors`: console/runtime errors from the
  prototype. If something you wrote is broken, you'll see it here — fix it without
  waiting for the dev.

Granular prototype edits — **touch one piece, not the whole design** (this is how
you keep big prototypes cheap to edit):

- `harness_get_screen` / `harness_set_screen` — read/write ONE screen body. `set`
  writes `prototype/screens/<id>.html` and upserts its manifest entry (title/url/frame).
- `harness_get_component` / `harness_set_component` — read/write ONE shared fragment.
- `harness_get_design_system` / `harness_set_design_system` — the shared CSS.
- `harness_set_frame` — set the device frame (prototype default or per screen).

## Storage layout (.harness/)

The canvas is split so each piece stays small:

```
.harness/state.json                     meta/spec/plan/dataModel/api + prototype MANIFEST (no HTML)
.harness/prototype/design-system.css    shared CSS
.harness/prototype/components/<name>.html   shared fragments ({{>name}})
.harness/prototype/screens/<id>.html        each screen body
```

`harness_get_state` returns the small manifest (screen ids/titles/frames, not the
markup) — so reading the design stays cheap as it grows. Pull actual HTML only when
you need it via `harness_get_screen` / `harness_get_component`. To edit a screen,
call `harness_set_screen` (one file); to change something shared, edit the component
or design system (one file) — never rewrite every screen. The dev server re-assembles
the files into one state for the viewer automatically.

You can also `Write` files directly (`.harness/prototype/screens/<id>.html`,
`.harness/state.json`) — the watcher picks any of them up. The MCP tools add
validation, manifest upkeep, and the feedback channel, so prefer them.

## Start with a brainstorm — don't build on the first message

When the dev asks to design something, **do NOT immediately write the spec or build
the prototype.** First brainstorm the idea into a shape you both agree on. Jumping
straight to a hi-fi prototype bakes in unexamined assumptions and wastes work — it's
the #1 complaint about this tool. Brainstorm first, the way `superpowers:brainstorming`
does, then build.

> **HARD-GATE:** no committed spec and no hi-fi prototype build until the dev has
> approved a direction. (Throwaway *lo-fi* sketches **during** the brainstorm are
> fine and encouraged — see below.) Every request goes through this, even a "simple"
> one — that's exactly where wrong assumptions hide. The direction can be short.

The brainstorm, in order:

1. **Open the viewer & ground yourself** — `harness_start_viewer` (so the dev can
   see, and so your lo-fi sketches land somewhere visible), then `harness_get_state`
   / `harness_get_view` and skim the project (files, recent work) so you don't ask
   what you could read.
2. **Check scope.** If the request is really several independent products
   (chat + billing + analytics…), say so first and help split it — don't refine the
   details of something that needs decomposing. Brainstorm the first piece, then build.
3. **Ask one question at a time.** Purpose, users, success criteria, constraints.
   Prefer multiple-choice ("A / B / C — which fits?") over open-ended. One question
   per message — never a questionnaire.
4. **Propose 2–3 approaches** with trade-offs; lead with your recommendation and why.
5. **Present the direction** — a few sentences: what it is, who it's for, the key
   screens, what's in / out of scope. Ask if it looks right; revise until it does.
6. **Get an explicit yes.** Only then `harness_set_phase` to `prototype`, write the
   spec into the rail, and build the first real screens.

**The viewer is your visual companion.** This is a *picture* tool — so when a
question is easier shown than told (a layout choice, two nav patterns, where a
control goes), drop a quick **lo-fi** sketch on the canvas (`harness_set_screen` with
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
   beside it. Get the shape of the product right here first.
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

Move the phase with `harness_set_phase` as each is settled. Don't race ahead — let
the dev react at each step.

## How to work

1. **On a fresh design request, brainstorm first** (above) and get a direction
   approved before building. Skip this only when the dev is clearly mid-loop already.
2. `harness_get_state` and `harness_get_view` to ground yourself.
3. Make the smallest change that answers the current question. Patch one section.
4. Tell the dev in one line what changed and what you want them to react to
   ("Click *Add walk-in* — does that field set feel right?").
5. `harness_get_feedback`; fold their notes in; repeat.
6. When a phase is solid, `harness_set_phase` to the next.

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
    "frame": "web",                         // device frame: web | desktop | ios | android (screens can override)
    "store": { "cart": 0 },                 // initial mock-store values
    "designSystem": ":root{--brand:#e8482b} .btn{...}",  // CSS shared by every freeform screen
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

- `data-to="screenId"` — click navigates to that screen (the only routing).
- `data-inc="cart"` / `data-dec="cart"` — bump a numeric store key by ±1
  (comma-separate multiple keys).
- `data-set="key=value;other=2"` — set store keys on click (numbers auto-parse).
- `data-bind="cart"` — element's text shows the live store value.
- `data-show="cart"` or `data-show="step==2"` — show the element only when truthy
  / equal; hidden otherwise.

The store is a flat object of mock values (declare defaults in `prototype.store`).
It persists across screen navigation, so a cart count set on the home screen is
still there on the cart screen. Build the design system once, compose screens
from it, and lean on these attributes for the clickable behaviour — no real
backend, just believable mock state. You can read the current store via
`harness_get_view`.

**Styling & icons — Tailwind and lucide are loaded in every freeform screen.**
Use them; do not hand-roll what they give you, and **never use emoji as icons.**

- **Tailwind utility classes** work out of the box (the viewer injects
  `@tailwindcss/browser@4`, compiled live) — e.g.
  `class="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100"`.
  A `designSystem` (custom CSS / tokens) still works and coexists, so reach for it
  only for what utilities can't express.
- **lucide icons** instead of emoji: `<i data-lucide="search"></i>`. Size and colour
  with classes — `<i data-lucide="shopping-cart" class="w-5 h-5 text-sky-500"></i>`
  (the SVG inherits `currentColor`). Names are the kebab-case lucide names from
  lucide.dev/icons. The runtime calls `lucide.createIcons()` on every render, so new
  icons appear automatically. **Emoji are not icons — use lucide.**
- Both load from a CDN, so the prototype needs network; offline, classes go
  unstyled and icons stay blank.

**Pick the device frame** with `prototype.frame` (or per-screen `frame`):
`web` (browser, default), `desktop` (native app window), `ios` or `android`
(phone). The phone frames render the page at ~390px wide, so write responsive CSS
and your `@media` rules will kick in. Choose the frame that matches what you're
actually building — a mobile app spec should preview in `ios`/`android`, not a
browser.

Example button: `<button class="btn" data-inc="cart">Add to cart</button>` and a
header badge `<span data-bind="cart">0</span>`.

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
as thin bodies. When iterating, prefer `harness_patch_state` with just
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
- Patch, don't clobber: use `harness_patch_state` so untouched sections survive.
- One change, one question. The viewer is a conversation, not a deliverable.
- Read feedback before assuming you're done. The dev's clicks are the spec.

## Handing off to implementation — build with subagents

The harness is for **design**. Once the dev approves the design and the **Plan**
board is filled in, stop designing and build the real thing — and build it with
**`superpowers:subagent-driven-development`**, not one long hand-coded context.

- The **Plan** Kanban *is* the implementation plan: each card is a task. Work them
  in order (respect the swimlane/milestone grouping and status), **one implementer
  subagent per task** — never parallel implementers.
- The `.harness/` artifacts are the **source of truth** each subagent reads — point
  subagents at them instead of re-describing the work:
  - `spec` — intent, users, scope, constraints
  - the prototype HTML + `designSystem` — the exact UI to build (it's real HTML/CSS)
  - `dataModel` — entities, fields, relationships
  - `api` — the OpenAPI 3 routes, middleware, params, bodies, responses
- Follow that skill's loop: per-task brief → implement + test + commit → task review
  (spec compliance **and** code quality) → fix until clean → final whole-branch review.
- **Drive the board as you go:** move each card with `harness_set_task` (e.g. to your
  `doing` / `review` / `done` status ids) as its subagent progresses, so the dev
  watches implementation advance live on the same Kanban they designed.
