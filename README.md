# quiver

A library of AI coding assistant skills, written once and transpiled to Claude Code, OpenCode, and GitHub Copilot.

Skills live in one place. `quiver` installs them globally so every project shares the same set of AI instructions and skills across all three tools.

## Install

```sh
npm install -g quiver
```

## Usage

```sh
quiver add             # pick skills to install globally (~/.quiver/)
quiver list            # list installed skills
quiver sync            # sync outputs with current config
quiver sync --refresh  # re-fetch all third-party skills then sync
quiver remove          # remove installed skills
```

Add `--dry-run` to `add` or `sync` to preview changes without writing files.

### What it writes

Installing skills generates output files for each tool:

- **Claude Code / OpenCode** — `~/.claude/skills/<name>/SKILL.md`
- **Always-on instructions** — `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`
- **GitHub Copilot** — `~/.copilot/instructions/<name>.instructions.md`

Your selection is saved to `~/.quiver/quiver.json`.

### Third-party skills

Skills can be pulled from GitHub using a URL of the form:

```
github:owner/repo[/path][@ref]
```

Run `quiver update` to re-fetch them and rebuild the outputs.

## Recommended: RTK

RTK is a CLI proxy that reduces LLM token consumption. It pairs well with quiver's token-saving skills. Install it with:

```sh
brew install rtk
```

`quiver add` and `quiver sync` will remind you to install it if it isn't already on your `PATH`.

## License

MIT
