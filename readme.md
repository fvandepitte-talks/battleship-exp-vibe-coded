# Battleship Experiment Template

Template repository for the **Battleship agentic development experiments**
(talk: [`battleship-agentic-demo`](https://github.com/fvandepitte-talks/battleship-agentic-demo)).

Each experiment runs in its **own repository** created from this template, so every
run starts from the exact same base, keeps its context clean (no other results to
peek at), and hosts its finished game on **GitHub Pages**.

## The five experiments

| # | Repository                       | Execution model            | Industry term |
| - | -------------------------------- | -------------------------- | ------------- |
| 1 | `battleship-exp-1-single-vibe`   | single · no plan           | vibe coding   |
| 2 | `battleship-exp-2-single-plan`   | single · plan-first        | spec-first    |
| 3 | `battleship-exp-3-orch-vibe`     | orchestration · no plan    | multi-agent   |
| 4 | `battleship-exp-4-orch-plan`     | orchestration · plan-first | orchestrated  |
| 5 | `battleship-exp-5-fleet`         | parallel + human-led       | agents at scale |

Every experiment uses the **same frozen prompt** ([`prompt.md`](./prompt.md)); only
the execution model changes.

## What's in this template

```text
.
├── prompt.md                  # Frozen task prompt (v2) — same for every experiment
├── run/                       # Run artifacts (reporting only — agents don't touch)
│   ├── experiment.json        # Which experiment this repo is (operator fills in)
│   └── report.schema.json     # Contract for run/report.json
├── tools/
│   └── sessions.mjs           # Copilot CLI session metrics capture (writes run/)
└── .github/
    ├── copilot-instructions.md
    ├── agents/                # Custom agents (team-lead, game-engine-developer, game-assets-developer, …)
    ├── skills/game-engine/    # Domain knowledge skill
    └── workflows/deploy-pages.yml  # Generic Pages deploy (builds dist/ if package.json exists)
```

The game itself is **not** in the template. Each experiment builds it from scratch
in the repository root.

## Operator setup (per experiment)

1. **Create the repo** from this template (`Use this template` → name it per the table above, in `fvandepitte-talks`).
2. **Fill in [`run/experiment.json`](./run/experiment.json)** with the experiment `id` and `label`.
3. **Prune the execution kit** to match the experiment — do this *before* the run starts:
   - Experiments 1–2 (single agent): delete `.github/agents/` — the single agent must not delegate.
   - Experiments 3–5: keep `.github/agents/`.
   - Keep `.github/skills/` everywhere — domain knowledge is equal for all runs.
4. **Enable GitHub Pages**: repo Settings → Pages → Source: *GitHub Actions*.
5. **Run the experiment** on `main` with the verbatim prompt from [`prompt.md`](./prompt.md),
   executed per that file's execution-model table.
6. **Capture metrics** after the session closes:

   ```sh
   node tools/sessions.mjs capture
   ```

   This writes `run/report.json` (deck-facing) and `run/metrics.json` (full detail).
   Add qualitative notes in `run/experience-notes.md` and the acceptance checklist in
   `run/result.md`.
7. **Commit and push** — the deployed game appears at
   `https://fvandepitte-talks.github.io/<repo-name>/` and the hub deck aggregates
   `run/report.json` from all five repos.

## Deployment convention

The Pages workflow is stack-agnostic but expects the npm convention:

- `npm run build` produces a static site in `dist/`
- assets use relative paths (the site is served under `/<repo-name>/`)

Any stack is allowed as long as it can honor that contract.

## Acceptance criteria (frozen, v2)

These are the acceptance criteria for the experiment run — the pasted prompt refers
here, and agents can read this file. Do not reword them once execution starts.

1. The game is a complete, fully playable Battleship in the browser — a human can play a full match end to end.
2. Shot outcomes and game state are handled correctly: hit, miss, repeated-shot handling, and win/lose detection (all ships sunk).
3. The codebase is reasonably structured, with core game logic separated from the interface/presentation layer.
4. Automated tests cover the core game behavior (at minimum hit, miss, repeat, and win).
5. The game runs locally via a documented command (e.g. `npm start` or `npm run dev`).
6. `npm run build` produces a static site in `dist/` that works on GitHub Pages under a sub-path (`/<repo-name>/` — use relative asset paths / a relative base).
7. Build/test commands are real and runnable: a full test command, a single targeted test command, and lint if applicable.
8. This readme is updated with real install/run/test/build docs for the game (including the single targeted test), keeping this acceptance-criteria section intact.
9. Off-limits paths are untouched: `run/`, `tools/`, `.github/`, `prompt.md`.
10. `node_modules/`, `dist/`, and other dependency/build output are git-ignored and not committed.
11. Handoff summary states what was built, key design/scope decisions, assumptions made, and what needs human review.
12. One extra special feature of the agent's own invention is included and well documented in the readme.

## Boundaries for agents

Agents build the game in the **repository root** (their project root) and must not
modify `run/`, `tools/`, `prompt.md`, or anything under `.github/`. See
[`.github/copilot-instructions.md`](./.github/copilot-instructions.md).
