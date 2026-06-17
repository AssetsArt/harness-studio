# Harness Studio

A live design canvas you leave running while an AI coding agent (Claude Code)
designs an app **into your screen** — prototype, spec, data model, flow, and plan —
instead of replying with a wall of text. It's `superpowers:brainstorming`, but as a
picture you can click.

Three layers, one loop:

| Layer | What it is |
|---|---|
| **Viewer (the screen)** | A React + Vite + Tailwind + shadcn-style app showing four tabs — **Prototype + Spec · Data model · Flow · Plan** — rendered from the canvas. The prototype is **freeform**: the AI writes real HTML + a shared CSS design system per screen, in a real device frame, wired up with a few attributes. |
| **Canvas** | A `.harness/` folder in your project. The AI writes it with its normal tools (or the MCP); the viewer watches it and live-reloads in place with a cyan flash. |
| **Skill + MCP** | A Claude Code skill drives the phases; an MCP server is the agent's eyes & hands — it edits the canvas, *sees* its own render (screenshots) and errors, and reads your feedback. |

```
 ┌─ AI writes .harness/ (skill + MCP) ──▶ viewer repaints; you click, switch frames ─┐
 │                                                                                    │
 └─ AI reads screenshots · errors · feedback ◀── you comment on an element, leave notes┘
```

## Quick start — use it in your own project

Two pieces: the **plugin** (the skill + MCP — install once, works in every project)
and the **viewer** (a small web app you leave running).

**1. Install the plugin (like any skill):**

```text
/plugin marketplace add AssetsArt/harness-studio
/plugin install harness-studio@harness-studio
```

The `harness-studio` skill and its MCP tools are now available in any project, and
the MCP reads/writes that project's `.harness/` folder.

**2. Run the viewer** — one line, no clone, no install:

```bash
cd ~/my-app
bunx github:AssetsArt/harness-studio     # viewer on :4317, watching ./.harness
```

It seeds a starter `.harness/` if there isn't one and points the viewer at *your*
project. Leave it open; it repaints as the AI edits the canvas.

> Prefer a short global command? `git clone https://github.com/AssetsArt/harness-studio`,
> then `cd harness-studio && bun install && bun link` — now `harness` runs it from
> anywhere. Flags: `--project <dir>`, `--port <n>`.

**3. Design:** run **`/hns <what to build>`** (e.g. `/hns a checkout flow`) — the
skill drives the phases, the MCP writes to `./.harness/`, and your viewer repaints
live. Update later with **`/hns update`**. (Or just say *"design this in the
harness"* — the skill triggers on its own.)

Try the viewer by hand: click screens in the **Prototype** sidebar, press **Add to
cart** and watch the badge persist across screens, switch device frames
(Web / Desktop / iOS / Android), **Comment** on an element, follow the **Changes**
feed, collapse the **Spec** rail, or hit **Edit state** to paste new state.

## How the canvas works

### Freeform prototype

Each prototype screen is real HTML in a sandboxed `<iframe>`, sharing a CSS
`designSystem`. Interactivity is wired with a tiny attribute vocabulary — no
framework, no backend:

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
- `harness_set_phase` / `harness_set_frame` — advance the stepper / set the device frame
- `harness_get_screenshot` — a PNG of how a screen actually renders (the pixels you see)
- `harness_get_view` — your active tab, prototype screen, store, and any prototype errors
- `harness_get_feedback` — notes you left, including the element you clicked to comment on

The skill (`skills/harness-studio/`) tells the agent how to run the prototype-based
loop. The agent can also just `Write` files under `.harness/` — the watcher catches
them either way; the MCP tools add validation, manifest upkeep, screenshots, and the
feedback channel.

## Develop the tool

```bash
bun install
bun run dev          # viewer on http://localhost:4317, watching this repo's .harness
bun run build        # typecheck + build viewer + bundle the MCP (mcp/server.bundle.mjs)
node scripts/validate-plugin.mjs   # check the plugin layout
```

A seed project (**Aurora Store**) is included so there's something to look at
immediately. `mcp/server.bundle.mjs` is what the plugin ships; rerun
`bun run build:mcp` after editing `mcp/server.mjs`.

CI (`.github/workflows/pack.yml`) keeps `main` installable: every push builds,
type-checks, validates the plugin layout, and re-commits the MCP bundle if it
drifted from source. (Needs *Settings → Actions → Workflow permissions →
Read and write*.)

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
TypeScript · `@modelcontextprotocol/sdk`. Fonts: Geist / Geist Mono.
