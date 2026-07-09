# Copilot Instructions

This repository is one **Battleship agentic-development experiment**: build a
complete Battleship web game from scratch. The task's acceptance criteria live in
the root [`readme.md`](../readme.md) under **Acceptance criteria (frozen, v2)** —
they are frozen; never reword or delete them.

## Workspace and boundaries

- The **repository root is your project root**. All game code, tests, config, and
  the game `README.md` live here.
- Never create or modify:
  - `run/` — experiment reporting artifacts
  - `tools/` — metrics capture tooling
  - `.github/` — agents, skills, instructions, workflows
  - `prompt.md` — the frozen task

## Hosting constraint

The finished game is published on **GitHub Pages** by
`.github/workflows/deploy-pages.yml`:

- `npm run build` must produce a static site in `dist/`
- The site is served under `/<repo-name>/` — use relative asset paths or a relative
  base (e.g. Vite `base: "./"`)
- Any stack is fine as long as it honors that contract

## Conventions

- Keep changes small and focused; keep core game logic separated from presentation
- Add or update tests when behavior changes (cover at least hit, miss, repeat, win)
- Provide real, runnable commands: full test, single targeted test, lint if applicable
- Git-ignore dependency and build output (`node_modules/`, `dist/`)
- Use ecosystem tooling to scaffold rather than hand-rolling setup
- End with a handoff summary: what was built, key decisions, assumptions, what needs
  human review
