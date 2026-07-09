# Frozen prompt — Battleship experiments

- Prompt version: `v2`
- Frozen on: 2026-07-09 (v2: one repository per experiment; the repo root is the
  workspace; the game must ship as a static web build deployable to GitHub Pages)

This file is the **source of truth** for the task. The **same prompt**, task, and
acceptance criteria are used for every experiment. Experiments differ only in how
the prompt is executed (single agent vs. orchestrated vs. fleet, plan-first vs. not)
— the power comes from the agentic approach, not from per-experiment prompt wording.

## Where the game is built

The **repository root is the workspace**. Everything the agent creates
(`package.json`, `src/`, `tests/`, `README.md`, config) lives in the repo root.

Off-limits — never create or modify:

- `run/` (reporting artifacts)
- `tools/` (metrics capture)
- `.github/` (agents, skills, instructions, workflows)
- `prompt.md` (this file)

## Shared task (all experiments)

Build a **full-blown, complete Battleship game from scratch** in this repository.
The agent has full creative and technical freedom over how to build it — stack,
architecture, visual polish, and feature set are all the agent's call — with one
hosting constraint: the game is a **web game** published on GitHub Pages, so it
must produce a static production build.

Aim for a genuinely playable, complete game rather than a minimal skeleton: a human
must be able to play a full match end to end (place/generate ships, take shots, get
clear feedback, and reach a win/lose outcome). The agent is encouraged to go further
where it adds value (AI opponent, difficulty levels, richer UI, sound, animations)
as it sees fit. On top of that, the agent must add **one extra special feature** of
its own invention — a creative surprise, well documented in the readme.

## Acceptance criteria (frozen, v2)

The acceptance criteria live in [`readme.md`](./readme.md) under **Acceptance
criteria (frozen, v2)** — that is the single, agent-visible source (this file is
hidden from agents via `.copilotignore`). They are frozen together with this
prompt; do not reword them once execution starts.

## The prompt (identical for every experiment)

Paste this verbatim for **every** experiment:

> You are building a **full-blown, complete Battleship game from scratch**. You have
> full creative and technical freedom — design and build the game as you see fit.
>
> The repository root is your project root. Do not create or modify anything under
> `run/`, `tools/`, `.github/`, or the file `prompt.md` — everything else is yours.
>
> Goal:
> - Deliver a genuinely playable, complete Battleship web game that a human can play
>   a full match end to end in the browser (place/generate ships, take shots, get
>   clear feedback, win/lose).
> - Handle shot outcomes and game state correctly: hit, miss, repeated shots, and win
>   detection (all ships sunk).
> - Go further where it adds value — you decide the stack, the architecture, and any
>   extra features (AI opponent, difficulty, richer UI, sound, animations, etc.).
> - Add one extra special feature, be creative about this. Document your special feature well in the readme.
>
> Engineering expectations:
> - Keep the codebase reasonably structured, with core game logic separated from the
>   interface/presentation layer.
> - Include automated tests covering the core game behavior (at minimum hit, miss,
>   repeat, and win).
> - The game is published on GitHub Pages: `npm run build` must produce a static site
>   in `dist/` that works when served under a sub-path (use relative asset paths or a
>   relative base). Use ecosystem tooling to scaffold.
> - Make it runnable locally via a documented command, and update `readme.md` with
>   real install/run/test/build commands (including a single targeted test) — keep its
>   "Acceptance criteria" section intact — and keep a `.gitignore` so dependency/build
>   output is not committed.
> - End with a handoff summary: what you built, key design/scope decisions,
>   assumptions, and what needs human review.
>
> Meet every item in the frozen acceptance criteria in `readme.md` (section
> "Acceptance criteria (frozen, v2)").

## Execution model — the only thing that changes

The prompt, scope, and acceptance criteria above are **identical** for all five
experiments. The experiment isolates the **execution model**, not the wording. Do
**not** hand a pre-split or differently worded prompt to any experiment. "Plan-first"
is an operator action (e.g. plan mode / approving the agent's plan before execution),
not a change to the prompt text.

| # | Experiment                  | How the same prompt is executed                                                                                   |
| - | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1 | single · no plan            | One agent receives the prompt and starts building immediately.                                                     |
| 2 | single · plan-first         | One agent receives the prompt, first produces a plan the operator approves, then builds.                           |
| 3 | orchestration · no plan     | A coordinating agent receives the prompt and delegates focused sub-tasks to sub-agents as it goes.                 |
| 4 | orchestration · plan-first  | A coordinating agent first produces a task breakdown the operator approves, then delegates to focused sub-agents.  |
| 5 | fleet                       | The prompt is run by focused agents working in parallel, with a final human merge/review pass.                     |

The agent(s) decide how to decompose and parallelize the work; the operator does not
pre-decompose it.
