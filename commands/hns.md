---
description: Harness Studio — design in the live canvas; `update`, `restart`, `feedback`, or `review`
argument-hint: <what to design> | update | restart | feedback | review [screen]
---

The user ran `/hns` with arguments: **$ARGUMENTS**

Route on the arguments:

## If the argument is `update` (or begins with "update")

Update Harness Studio to the latest version, then re-run the viewer so the new build
actually shows up:

1. Refresh the marketplace and update the plugin:
   - `/plugin marketplace update harness-studio`
   - then `/plugin update harness-studio@harness-studio` (or open `/plugin` → Manage → Update).
2. **The viewer ships inside the plugin, so this updates it too** — nothing separate to
   pull. (Only contributors running a local *clone* need `git pull && bun install`.)
3. **Restart Claude Code** so the updated skill, commands, and MCP server load — an
   in-session update keeps serving the old ones.
4. **Re-run the viewer on the new build.** A viewer that's already open keeps serving the
   OLD assets until it's restarted. Call the `harness_restart_viewer` MCP tool (it stops
   the running viewer and relaunches it from the freshly-installed plugin — no manual
   process-killing or cache-clearing). If that tool isn't available yet (you're still on
   the pre-restart session), tell the user to restart Claude Code and then run
   `/hns restart`.
5. Briefly report the resulting plugin version (from `/plugin` or `.claude-plugin/plugin.json`) so they know it moved.

Don't redesign anything in update mode — just update, re-run the viewer, and confirm.

## If the argument is `restart` (or begins with "restart")

Re-run the viewer without touching the design — use this to pick up a new build, or if the
viewer got into a bad state:

1. Call the `harness_restart_viewer` MCP tool (optionally pass `port` if they run it off
   the default 7317). It stops whatever is serving on the port and relaunches from the
   installed plugin.
2. Tell the user the URL it returns and to **hard-refresh** the tab (the browser may have
   cached the old assets). If the tool reports the launcher is missing, fall back to
   `bunx github:AssetsArt/harness-studio`.

## If the argument is `feedback` (or begins with "feedback")

Act on the notes the dev left from inside the viewer. The viewer is read-only and can't
wake you on its own, so this is the chat-side trigger that closes the comment loop:

1. Call the `harness_get_feedback` MCP tool to drain unread notes. Each note carries the
   **text**, the **tab/screen** it was left on, and (for prototype comments) the
   **element** the dev clicked. Draining marks them read.
2. If nothing is unread, say so and stop — don't invent work.
3. Otherwise handle each note in turn: ground yourself on the screen it points at
   (`harness_get_view` / `harness_get_screen`), make the change in `.harness/` with the
   `harness_*` tools (edit one piece at a time so the viewer repaints cleanly), and use
   `harness_get_screenshot` to confirm visually when it helps.
4. Briefly summarize what you addressed per note so the dev can follow along.

Stay scoped to what the notes ask — don't redesign beyond them.

## If the argument is `review` (or begins with "review")

A **manual re-run** of the self-review you already do after every build (see the skill's
"Self-review — before you hand a screen back"). The dev should never *need* this to find
your mistakes — by the time they look, you've already screenshotted, design-reviewed, and
fixed. Treat `/hns review` as a deeper on-demand pass, then run the same checklist (stray /
empty screens, repeated chrome that should be a component, dead-band layout, craft).

Run a design-quality pass on the prototype — catch AI-slop before the dev does:

1. Call the `harness_design_review` MCP tool. If a screen id follows (e.g.
   `/hns review checkout`), pass it to scan just that screen; otherwise scan all.
2. It runs impeccable's deterministic detectors and returns findings (each with an
   antipattern, severity, and snippet — side-stripe borders, gradient text,
   gray-on-color, low contrast, identical card grids, over-rounded cards, …).
   - **No findings** → say it's clean and stop.
   - **Findings** → group them by screen/severity, then fix the clear ones in
     `.harness/` (Tailwind classes + design-system tokens, not inline styles),
     re-running `harness_design_review` to confirm they cleared. Flag any that are
     deliberate so the dev can decide.
   - **Tool unavailable** (impeccable not installed / offline) → relay its note;
     suggest `npx impeccable install` or `/impeccable audit` as a fallback.

## Otherwise — design "$ARGUMENTS" in the harness

**Use the `harness-studio` skill** and follow its flow. Brainstorm before you build.

1. **Brainstorm first — don't build yet.** Ground yourself (`harness_get_state` /
   `harness_get_view`, skim the project), then ask the dev questions **one at a
   time** — purpose, users, scope, constraints (multiple-choice when you can) —
   propose 2–3 approaches with a recommendation, and present a short direction.
   **Do not write the spec or build the prototype until the dev approves the
   direction.** When a question is easier shown than told, sketch a quick **lo-fi**
   screen on the canvas and ask. (This is the `superpowers:brainstorming` flow, with
   the viewer as your visual companion.)
2. **Open the viewer** with the `harness_start_viewer` MCP tool — it launches the
   viewer **from the installed plugin** (always the current version, no stale
   `bunx` cache) on http://localhost:7317, watching this project's `./.harness/`.
   It's idempotent (safe to call every run); tell the user the URL it returns. First
   run installs the viewer's deps, so it may take a few seconds to come up. (If the
   tool isn't available, fall back: have them run `bunx github:AssetsArt/harness-studio`
   in this project.)
3. **Once the direction is approved, run the prototype-based loop:**
   Prototype + Spec → Data model → Flow → Plan. `harness_set_phase` to `prototype`,
   then write to `.harness/` with the `harness_*` MCP tools (`harness_set_screen`,
   `harness_set_component`, `harness_patch_state`, …), editing one piece at a time.
4. **Close the loop:** after meaningful changes, check `harness_get_view` (what the
   dev is looking at, plus any errors), `harness_get_screenshot` (see your own
   render), and `harness_get_feedback` (notes the dev left). React to what you find.

5. **When the design is approved, implement with subagents.** Don't hand-code the
   whole thing in one context — use `superpowers:subagent-driven-development`. The
   **Plan** Kanban is the task list (one implementer subagent per card), and the
   `.harness/` artifacts (spec, prototype HTML, dataModel, api) are the source of
   truth each subagent reads. Move cards with `harness_set_task` as they land so the
   dev watches progress on the board.

If `$ARGUMENTS` is empty, ask the user what they want to design, then brainstorm it.
