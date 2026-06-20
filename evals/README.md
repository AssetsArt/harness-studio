# Eval harness — measuring (and not regressing) the design skill

This folder is how we keep the **arta** skill/MCP producing good prototypes
on purpose, not by vibes. It is a measured loop with a deterministic grader, plus a
**regression gate** that can run in CI so a skill/MCP change can't silently make the
output worse.

## Two layers

Building a prototype from a brief needs an LLM (non-deterministic, costs tokens), so the
harness is split into what can be gated for free and what needs a model:

| Layer | What | Deterministic? | Where it runs |
|---|---|---|---|
| **A — regression gate** | grade the **committed** artifacts (the shipping `.arta/` demo + a bad fixture) against a baseline | yes, no LLM, no network | CI on every push that touches the skill/MCP (`gate.mjs`) |
| **B — builder loop** | builder subagents follow the skill on each brief → grade → diagnose → fix one cause → re-measure + blind A/B | no (LLM builds) | locally / on demand (`gate.mjs --suite`) |

Layer A catches **code** regressions (the assembler in `src/lib/prototype.ts`, token
compilation, the detect wiring, the demo itself). Layer B catches **skill-prose**
regressions and drives quality up. Same grader underneath both.

## Files

- `grade.mjs` — the deterministic grader. Assembles a `.arta/` exactly like the viewer,
  then scores six verifiable assertions (no LLM):

  | id | assertion | passes when |
  |---|---|---|
  | A1a | tokens defined | a real token set exists (≥4 colors AND ≥2 type/fonts) |
  | A1b | tokens used | screens use vars, not hardcoded hex (≤ 4×screens stray hex) |
  | A2 | shared layout | layout+components factored, `{{slot}}` resolves, no duplicated bodies |
  | A3 | interactivity | `data-to` targets valid, every screen reachable, binds resolve |
  | A4 | renders clean | every screen expands, non-empty, tag-balanced, ≥ `minScreens` |
  | A5 | design review | `impeccable detect` finds 0 serious anti-slop findings |

- `gate.mjs` — the **one command**. Grades committed artifacts vs `thresholds.json`,
  prints a per-target × per-assertion table + verdict, exits non-zero on regression.
- `thresholds.json` — the committed baseline (set 2026-06-20). Which targets are gated and
  which checks must hold.
- `briefs.json` — the brief set: `train` (5, diagnose+fix), `heldout` (3, stop-condition
  only — never fit to them), and `ship` (the `demo`, i.e. the live `.arta/`).
- `fixtures/bad/` — a deliberately-bad build. The gate asserts it **stays failing**, which
  guards the grader against silently going permissive.
- `builder-brief.md` — the builder contract for Layer B. Must NOT leak the grader rubric
  (teaching-to-the-test inflates scores).
- `render.mjs` — emits a self-contained HTML per screen mirroring the viewer's srcDoc, for
  live-render / screenshot checks via playwright.

## Run it

```bash
bun run eval:gate                      # the gate — committed targets vs baseline (CI core)
bun evals/gate.mjs --json              # machine-readable
bun evals/grade.mjs --brief demo --dir .arta   # grade one .arta/ against one brief
bun evals/gate.mjs --suite <built-dir> # Layer B: grade <dir>/<briefId>/.arta for every brief
```

### A5 and CI

`impeccable detect` lives at `~/.claude/skills/impeccable` and is **not** on a CI runner,
so the gate reports A5 as *skipped* (`–`) there and enforces **A1-A4** as the deterministic
CI floor. A5 is enforced locally (and in `--suite`) where the detector exists. Point a
different detector with `IMPECCABLE_DETECT=/path/to/detect.mjs`.

## Wiring into CI

`.github/workflows/eval-gate.yml` (draft) runs `bun evals/gate.mjs` on pushes/PRs that
touch `skills/`, `mcp/`, `src/lib/prototype.ts`, `evals/`, or `.arta/`. It runs
alongside `pack.yml`. To make a regression actually **block a release**, either:

1. mark `eval-gate` a required status check (branch protection on `main`), or
2. fold the `bun evals/gate.mjs` step into `pack.yml` before the version-bump step.

Left as a maintainer decision — review the draft workflow before enabling.

## Coverage gaps (Layer B roadmap)

The grader is structural. It does **not** yet measure, and these are the next dimensions to
add as briefs/checks:

- **Design-language parity** — that all five kits (Ink/Graphite/Clay/Mist/Signal) come out
  *equally* good, not just a good average.
- **Responsive / safe-area** — per-frame correctness across web/desktop/ios/android
  (full-bleed `safeArea`/`chrome`).
- **Large app (10+ screens) token efficiency** — that the agent edits per-file
  (`set_screen` / granular setters) instead of rewriting the whole state.
- **Design→build handoff** — that `spec`/`dataModel`/`api` are complete enough for
  subagent-driven implementation (the grader only inspects `prototype` today).
- **Beauty/craft** — an LLM vision-judge dimension (not deterministic, so Layer B only).
