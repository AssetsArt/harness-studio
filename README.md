# Harness Studio

A live design canvas you leave running while an AI coding agent (Claude Code)
designs an app **into your screen** — prototype, spec, data model, flow, and plan —
instead of replying with a wall of text. It's `superpowers:brainstorming`, but as a
picture you can click.

Three layers, one loop:

| Layer | What it is |
|---|---|
| **Viewer (the screen)** | A React + Vite + Tailwind + shadcn-style app showing five tabs — **Prototype + Spec · Data model · Flow (API) · Architecture · Plan** — rendered from the canvas. The prototype is **freeform**: the AI writes real HTML + a shared CSS design system per screen, in a real device frame, wired up with a few attributes. |
| **Canvas** | A `.harness/` folder in your project. The AI writes it with its normal tools (or the MCP); the viewer watches it and live-reloads in place with a cyan flash. |
| **Skill + MCP** | A Claude Code skill drives the phases; an MCP server is the agent's eyes & hands — it edits the canvas, *sees* its own render (screenshots) and errors, and reads your feedback. |

```
 ┌─ AI writes .harness/ (skill + MCP) ──▶ viewer repaints; you click, switch frames ─┐
 │                                                                                    │
 └─ AI reads screenshots · errors · feedback ◀── you comment on an element, leave notes┘
```

## Quick start — use it in your own project

Install the **plugin** once — it brings the skill, the MCP, **and** the viewer.
`/hns` starts the viewer for you, so there's nothing else to install or keep in sync.

**1. Install the plugin (like any skill):**

```text
/plugin marketplace add AssetsArt/harness-studio
/plugin install harness-studio@harness-studio
```

The `harness-studio` skill and its MCP tools are now available in any project, and
the MCP reads/writes that project's `.harness/` folder.

**2. The viewer starts itself.** You don't run anything — when you `/hns`, the skill
calls the `harness_start_viewer` MCP tool, which launches the viewer **from the
installed plugin** (so it always matches your installed version — no stale cache) on
`http://localhost:7317`, watching this project's `./.harness/`. The first launch
installs the viewer's deps (a few seconds, needs [Bun](https://bun.sh)); it seeds a
starter `.harness/` if there isn't one. Leave the tab open; it repaints as the AI
edits the canvas. **To update later, just `/hns update`** — that updates the viewer
too, since it ships in the plugin.

> Want to run the viewer without the plugin (a quick look)? `cd ~/my-app && bunx
> github:AssetsArt/harness-studio`. Note `bunx` caches `github:` specs, so re-running
> it can serve an old build — `bun pm cache rm` first to force the latest. Flags:
> `--project <dir>`, `--port <n>`. Contributors: `git clone` + `bun install` +
> `bun link` gives a global `harness` command.

**3. Design:** run **`/hns <what to build>`** (e.g. `/hns a checkout flow`) — the
skill **brainstorms the idea with you first** (questions one at a time, 2–3
approaches, an agreed direction — sketching lo-fi options on the canvas when a
question is easier shown than told), and only then writes the spec and builds the
prototype, repainting your viewer live as it goes. It won't dump a full prototype on
the first message. Update later with **`/hns update`**. (Or just say *"design this in
the harness"* — the skill triggers on its own.)

Try the viewer by hand: click screens in the **Prototype** sidebar, press **Add to
cart** and watch the badge persist across screens, switch device frames
(Web / Desktop / iOS / Android), **Comment** on an element, follow the **Changes**
feed, collapse the **Spec** rail, or hit **Edit state** to paste new state.

## Commands

Everything you can type, in one place.

**In Claude Code** — slash commands:

| Command | What it does |
|---|---|
| `/plugin marketplace add AssetsArt/harness-studio` | Add the marketplace (one time) |
| `/plugin install harness-studio@harness-studio` | Install the plugin — skill + MCP + viewer |
| `/hns <what to build>` | Brainstorm the idea, then design it in the harness |
| `/hns update` | Update the plugin to the latest **and re-run the viewer** on the new build |
| `/hns restart` | Re-run the viewer from the installed plugin (pick up a new build, no manual cache-clearing) |
| `/hns feedback` | Drain the comments the dev left in the viewer and act on them (`harness_get_feedback`) |
| *"design this in the harness"* | Natural-language trigger — same as `/hns` |

`/hns update` wraps `/plugin marketplace update harness-studio` then
`/plugin update harness-studio@harness-studio` (or use `/plugin` → Manage → Update),
then restarts the viewer via `harness_restart_viewer` so the new build shows up — after
you **restart Claude Code** so the updated skill/commands/MCP load. Normally you never
start the viewer yourself — `/hns` does it via the `harness_start_viewer` tool, and
`/hns restart` re-runs it.

**In your shell** — only if you want the viewer *without* the plugin:

| Command | What it does |
|---|---|
| `bunx github:AssetsArt/harness-studio` | Run the viewer in the current project (`:7317`) |
| `bun pm cache rm` | Force `bunx` to re-fetch the latest (it caches `github:` specs) |
| `bunx github:AssetsArt/harness-studio --project <dir>` | Point the viewer at another project |
| `bunx github:AssetsArt/harness-studio --port <n>` | Use a different port (default `7317`) |

**Develop / contribute** — in a clone of this repo:

| Command | What it does |
|---|---|
| `bun install` | Install deps |
| `bun run dev` | Viewer on `:7317`, watching this repo's `.harness/` |
| `bun run build` | Typecheck + build viewer + bundle the MCP |
| `bun run build:mcp` | Re-bundle the MCP after editing `mcp/server.mjs` |
| `node scripts/validate-plugin.mjs` | Check the plugin layout (the CI gate) |
| `bun link` | Expose a global `harness` command, runnable from any project |

## How the canvas works

### Freeform prototype

Each prototype screen is real HTML in a sandboxed `<iframe>`, sharing a CSS
`designSystem`. **Tailwind** (`@tailwindcss/browser@4`) and **lucide** icons are
loaded into every screen from a CDN, so the AI writes real utility classes
(**not** inline `style="…"`) and `<i data-lucide="…">` icons — not emoji. Interactivity is wired with a tiny attribute
vocabulary — no framework, no backend:

| Attribute | Effect |
|---|---|
| `data-to="screenId"` | click navigates to another screen |
| `data-inc` / `data-dec="cart"` | bump a numeric mock-store key by ±1 |
| `data-set="key=value;k2=2"` | set store keys on click |
| `data-bind="cart"` | element text shows the live store value |
| `data-show="cart"` / `data-show="step==2"` | show element only when truthy / equal |
| `data-nav="screenId"` | the current screen's link gets `.is-active` automatically |

The mock `store` (declared in `prototype.store`) persists across navigation, so a
cart filled on one screen is still full on the next — the AI reads it via
`harness_get_view`.

### Shared layout & components — don't repeat markup

A `prototype.layout` shell wraps every screen body and `prototype.components` holds
reusable fragments, so a header lives in **one** place. Change it once, every screen
updates; nothing is missed.

- `prototype.layout` — `"{{>header}}{{slot}}{{>footer}}"` (`{{slot}}` = screen body)
- `prototype.components` — `{ "header": "…", "footer": "…" }`, included via `{{>name}}`
- `prototype.vars` / `screen.vars` — `{{name}}` variables for per-screen tweaks

Each screen's `html` is then only the part that differs; set `"layout": false` on a
screen to render it standalone.

### Device frames

Preview the same HTML in different shells via `prototype.frame` (or a per-screen
`frame`): **`web`** (browser, default), **`desktop`** (native app window), **`ios`**
and **`android`** (phone frames with status bar, notch / punch-hole, home
indicator). Phone frames render at ~390px so your responsive CSS kicks in. A frame
switcher in the sidebar previews any screen in any frame; the AI's declared frame is
the default and wins whenever it changes.

### Split into files (so it scales)

A single `state.json` holding every screen's HTML would balloon as the prototype
grows — and an agent would burn context reading and rewriting the whole blob to
change one button. So the canvas is split: `state.json` keeps a small **manifest**,
and each screen / component / the design system lives in its own file. The agent
edits **one file at a time**; the dev server re-assembles them into one state for
the viewer. Inline values in `state.json` still work and win over files, for quick
lo-fi screens.

```
.harness/
  state.json                  # meta/spec/plan/dataModel/flow + prototype MANIFEST (no HTML)
  prototype/design-system.css # shared CSS
  prototype/components/*.html # shared fragments ({{>name}})
  prototype/screens/*.html    # each screen body
```

## How the AI plugs in

The plugin registers a self-contained MCP server (no extra install) that operates
on the current project's `.harness/`:

- `harness_get_state` / `harness_set_state` / `harness_patch_state` — read & write the structured canvas + prototype manifest
- `harness_get_screen` / `harness_set_screen` — read/write one screen body (one file)
- `harness_get_component` / `harness_set_component` — read/write one shared fragment
- `harness_get_design_system` / `harness_set_design_system` — the shared CSS
- `harness_get_design_tokens` / `harness_set_design_tokens` — the structured design system (colors, typography, spacing, radii, shadows, fonts); shown as a style guide in the Prototype → **Design system** sub-view, and compiled to CSS custom properties (`--color-*`, `--space-*`, …) injected into every screen
- `harness_set_phase` / `harness_set_frame` — record the current phase (shown in the status bar; tabs are free routes) / set the device frame
- `harness_get_api` / `harness_set_api` — the `api` section (the Flow tab): an OpenAPI 3 document — routes, middleware, params, body, responses, and `x-screens` (which screens call each route → screen→API edges)
- `harness_get_architecture` / `harness_set_architecture` — the `architecture` section (the Architecture tab): C4-style system diagram (nodes/edges), ADRs (`decisions`), `nfrs`, `security` notes, `stack`
- `harness_get_plan` / `harness_set_plan` / `harness_set_task` — the `plan` Kanban board (custom statuses = columns, milestones = swimlanes, tasks = cards w/ priority); `set_task` moves a card between columns
- `harness_start_viewer` — launch the viewer from the installed plugin (idempotent; no stale cache)
- `harness_restart_viewer` — re-run the viewer from the installed plugin so it serves the latest build (what `/hns update` / `/hns restart` use; no manual cache-clearing)
- `harness_get_screenshot` — a PNG of how a screen actually renders (the pixels you see)
- `harness_design_review` — run [impeccable](https://github.com/pbakaus/impeccable)'s deterministic anti-slop detectors over a screen's HTML and return craft findings (low contrast, side-stripe borders, gradient text, identical card grids, …). Opt-in — returns a note if impeccable isn't available
- `harness_get_view` — your active tab, prototype screen, store, and any prototype errors
- `harness_get_feedback` — notes you left, including the element you clicked to comment on

The skill (`skills/harness-studio/`) tells the agent how to run the prototype-based
loop. The agent can also just `Write` files under `.harness/` — the watcher catches
them either way; the MCP tools add validation, manifest upkeep, screenshots, and the
feedback channel.

**Design → build.** When the design is approved, the agent hands off to implementation
with [`superpowers:subagent-driven-development`](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md):
the **Plan** Kanban is the task list (one implementer subagent per card), and the
`.harness/` artifacts (spec, prototype HTML, data model, API) are the source of truth
each subagent reads. The agent moves cards (`harness_set_task`) as work lands, so the
dev watches the build advance on the same board they designed.

## Develop the tool

The dev commands live in [Commands → Develop / contribute](#commands)
(`bun install`, `bun run dev`, `bun run build`, …).

A seed project (**Aurora Store**) is included so there's something to look at
immediately. `mcp/server.bundle.mjs` is what the plugin ships; rerun
`bun run build:mcp` after editing `mcp/server.mjs`.

CI (`.github/workflows/pack.yml`) keeps `main` installable: every push builds,
type-checks, validates the plugin layout, re-commits the MCP bundle if it drifted
from source, and **bumps the patch version** (via `scripts/bump-version.mjs`). The
version bump matters — `/plugin update` skips re-installing when the version is
unchanged, so without it a push would never reach users. So just push; the version
moves on its own and `/hns update` always gets the latest. (Needs *Settings →
Actions → Workflow permissions → Read and write*.)

## Layout

```
.claude-plugin/
  plugin.json                 # plugin manifest (install target)
  marketplace.json            # listing → /plugin marketplace add AssetsArt/harness-studio
skills/harness-studio/        # the design-loop skill
commands/hns.md               # the /hns command (design · update)
.mcp.json                     # MCP config (points at the bundle via ${CLAUDE_PLUGIN_ROOT})
mcp/server.mjs                # MCP server source — the agent's eyes & hands
mcp/server.bundle.mjs         # self-contained bundle the plugin ships (no dep install)
bin/harness.mjs               # viewer launcher — `harness` in any project
vite/harness-watch.ts         # Vite plugin: assembles split files, watch → WebSocket push, endpoints
scripts/validate-plugin.mjs   # plugin-layout check (CI gate + local)
.github/workflows/pack.yml    # build · validate · re-bundle on push
src/                          # the viewer (React + Tailwind + shadcn-style + lucide)
.harness/                     # the canvas (seeded with Aurora Store)
```

## Stack

Bun · React 19 · Vite 6 · Tailwind CSS v4 · shadcn-style components · lucide-react ·
React Flow (`@xyflow/react`) + dagre for the data-model & API-flow diagrams ·
`yaml` for OpenAPI 3 export · TypeScript · `@modelcontextprotocol/sdk`. Fonts:
Geist / Geist Mono.
