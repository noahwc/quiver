# Contributing

## Setup

```sh
npm install
```

## Scripts

```sh
npm run build   # compile TypeScript to dist/
npm run dev     # compile in watch mode
npm test        # run the test suite (vitest)
npm run lint    # type-check with tsconfig.test.json
```

## Running the CLI locally

Build first, then run the compiled entrypoint:

```sh
npm run build
node dist/cli/index.js add
```

Or link it globally to test as an installed binary:

```sh
npm run build
npm link
quiver add
```

## Project layout

- `src/cli/` — CLI commands (`add`, `remove`, `list`, `sync`) and the entrypoint
- `src/core/` — config, skill discovery, loading, and shared types
- `src/transpiler/` — turns skills into per-tool output files
- `src/third-party/` — fetching skills from GitHub
- `src/tui/` — interactive skill browser
- `skills/` — built-in skills (each in its own folder with a `SKILL.md`)
- `registry.json` — catalog of external (third-party) skills available to install
- `tests/` — vitest tests mirroring the `src/` structure

## Adding a built-in skill

Create a folder under `skills/<category>/<name>/` with a `SKILL.md`. The frontmatter drives transpilation:

```yaml
---
name: my-skill
description: One-line summary of what the skill does
type: skill # skill | instruction
auto-trigger: false
---
```

- `type: skill` → written to `~/.claude/skills/<name>/SKILL.md`, `~/.copilot/skills/<name>/SKILL.md`, and `~/.agents/skills/<name>/SKILL.md`, plus any bundled assets.
- `type: instruction` → merged into the always-on instruction files (`CLAUDE.md`, OpenCode `AGENTS.md`, pi `AGENTS.md`, DSH `AGENTS.md`) and written as a Copilot `.instructions.md`.
- `auto-trigger: false` → the generated skill gets `disable-model-invocation: true`.

## Before opening a PR

Run the checks:

```sh
npm run lint
npm test
```
