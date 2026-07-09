# Battleship Experiment vibe coded

Experiments repository for the **Battleship agentic development experiments**
(talk: [`battleship-agentic-demo`](https://github.com/fvandepitte-talks/battleship-agentic-demo)).

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
