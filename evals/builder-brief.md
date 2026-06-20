# Builder task — produce a Harness Studio prototype (eval harness)

You are role-playing a Claude Code agent that has the **arta** skill loaded and
is building a design prototype for a developer. This is an automated eval that measures
how well the *skill itself* steers you — so **follow the skill, not this file**, for all
design/quality/structure decisions. This file only covers harness mechanics.

## What to read first (this IS your skill — follow it)

1. Read `SKILL.md` and `design-systems.md` (paths in your task) IN FULL. Follow them.
2. Build the prototype for the approved direction in your task.

## Harness mechanics for this eval (the only deviations from the skill)

- **The arta MCP server is NOT connected here.** You cannot call `arta_*`
  tools. The skill says you may `Write` the `.harness/` files directly and the watcher
  picks them up — do that. Produce the same artifacts the MCP tools would.
- **The direction is already approved** (it's in your task). Do NOT brainstorm or ask
  questions — go straight to building the hi-fi prototype.
- No browser / screenshot / design-review tools are available to you here. You can't
  visually check your work — so rely on the skill's craft guidance and get it right the
  first time.

## Where to write — `<DIR>/.harness/`

A single `<DIR>/.harness/state.json` with everything inline is fine (the viewer/grader
assembles split files and inline identically). The `state.json` shape — `meta`,
`prototype` (`start`, `frame`, `store`, `tokens`, `designSystem`, `layout`, `components`,
`screens[]` with `id`/`title`/`html`) — is documented in SKILL.md's "state.json shape"
reference and the freeform-screen section. Keep `meta` valid (`name` + `phase`).

## When done

Return ONE line: `BUILT <DIR>/.harness/state.json — N screens: id1,id2,...` (no prose).
Your final message is read by a machine, not a human.
