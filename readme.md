# Battleship Experiment vibe coded

Experiments repository for the **Battleship agentic development experiments**
(talk: [`battleship-agentic-demo`](https://github.com/fvandepitte-talks/battleship-agentic-demo)).

A fully playable Battleship game built with **Vite + React + TypeScript**, featuring a smart AI opponent, ship placement UI, and a special _Admiral's Heatmap_ feature.

---

## Getting started

### Prerequisites
Node.js 18+

### Install
```bash
npm install
```

### Run locally
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Build for production (GitHub Pages)
```bash
npm run build
```
Produces a static site in `dist/` with relative asset paths — ready for GitHub Pages sub-path deployment.

### Run all tests
```bash
npm test
```

### Run a single targeted test file
```bash
npm run test:single
```
Runs `src/game/__tests__/board.test.ts` (covers hit, miss, repeat, win, ship placement).

### Lint
```bash
npm run lint
```

---

## 🗺️ Special Feature — Admiral's Heatmap

The **Admiral's Heatmap** is a strategic overlay you can toggle during battle (click the _"🗺️ Show Admiral's Heatmap"_ button).

### What it does
It calculates a **probability distribution** across all un-fired cells on the enemy grid, showing how likely each cell is to contain a ship segment. Cells are shaded from faint (low probability) to bright red (high probability).

### How it works
For each remaining (un-sunk) enemy ship, every possible valid placement of that ship on the current board is counted. A cell's score is the total number of valid placements that include it. Scores are then normalised to [0, 1]. Cells that are already `miss` or `sunk` are excluded from all placements — they constrain the search space and make the heatmap increasingly accurate as the game progresses.

### Why it's useful
- Early game: highlights centre-board cells (ships can be placed through them in more ways)
- Mid game: concentrates around confirmed hits, showing the most probable ship orientations
- Educational: demonstrates the mathematics of naval deduction

Toggle it off for a purer experience; toggle it on when you're stuck.

---

## Game features

| Feature | Detail |
|---|---|
| Ship placement | Click-to-place ships on a 10×10 grid with rotation (press **R**) or randomise |
| No-touch rule | Ships cannot be placed adjacent to each other |
| AI opponent | Three difficulties: Easy (random), Medium (Hunt & Target), Hard (aggressive targeting) |
| Hit / Miss / Sunk | Full visual feedback with emoji markers and animations |
| Repeat-shot guard | Re-clicking a fired cell shows an error message instead of wasting a turn |
| Win / Lose detection | Triggered when all ships of one side are sunk; shows stats overlay |
| Heatmap | Admiral's Heatmap overlay (see above) |
| Responsive | Works on desktop and mobile |

---

## Project structure

```
src/
  game/           # Pure game logic — no React, fully testable
    types.ts      # All type definitions (Cell, Ship, Board, ShotResult, …)
    board.ts      # Board creation, placement validation, shot processing
    ai.ts         # AI opponent (Hunt/Target algorithm)
    heatmap.ts    # Admiral's Heatmap probability computation
    __tests__/    # Vitest unit tests
  components/     # React UI components
    BoardCell.tsx
    BoardGrid.tsx
    ShipRoster.tsx
    GameStatus.tsx
    GameOverScreen.tsx
  App.tsx         # Game flow orchestration
  App.css         # Naval-themed styles
```

---

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

---

## Handoff summary

### What was built
A complete, fully playable Battleship web game:
- **Difficulty selection screen** (Easy / Medium / Hard)
- **Ship placement phase**: click-to-place all 5 ships with rotation (press R), hover preview, no-touch adjacency rule, or randomise at the click of a button
- **Battle phase**: 10×10 player grid and enemy grid; click to fire; animated hit/miss/sunk feedback
- **AI opponent** with three difficulty tiers (random, Hunt & Target, aggressive)
- **Win/lose detection** with a game-over overlay showing shot counts and a Play Again button
- **Admiral's Heatmap** special feature (probability distribution overlay on enemy grid)
- 39 automated unit tests covering all core behaviours (hit, miss, repeat, sunk, win, placement, AI, heatmap)

### Key design decisions
| Decision | Rationale |
|---|---|
| Vite + React + TypeScript | Fast DX, first-class TypeScript, relative-base build for GitHub Pages |
| `base: './'` in vite.config.ts | Ensures assets work under any sub-path |
| Pure functions in `src/game/` | Fully deterministic, no React dependency, easy to unit-test |
| Hunt & Target AI | Standard Battleship algorithm; checkerboard hunt pattern halves search space |
| No-touch placement rule | Standard variant that makes the game more interesting |
| Admiral's Heatmap computed on every AI board change | Re-runs the placement-counting algorithm on each turn; fast enough at 10×10 |

### Assumptions
- Standard 10×10 Battleship with fleet: Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)
- No-touch adjacency rule applied during placement (ships cannot share a border or corner)
- AI fires with a configurable delay (700 ms) for UX realism
- The heatmap uses the "hidden" board (ship cells invisible) to simulate what a real player would see

### What needs human review
- **Accessibility**: keyboard navigation on the game grid works (Tab + Enter) but a full ARIA audit may be warranted
- **Mobile touch**: basic responsive CSS is in place but has not been tested on physical devices
- **GitHub Pages URL**: the `base: './'` setting works for relative paths; verify the workflow deploys to the right sub-path
- **AI balance**: the Hard difficulty uses aggressive neighbouring-cell targeting; playtesting may want further tuning

