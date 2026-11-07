# quiver

A library of AI coding assistant skills, written once and installed globally for Claude Code, OpenCode, GitHub Copilot, pi, and DeepSeek Harness.

Skills live in one place. `quiver` installs them globally so every project shares the same set of AI instructions and skills across tools.

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

- **Skills** — every skill is written to each native global root:
  - `~/.claude/skills/<name>/SKILL.md` — Claude Code, OpenCode, VS Code (Claude / Local harness)
  - `~/.copilot/skills/<name>/SKILL.md` — GitHub Copilot CLI and VS Code Copilot
  - `~/.agents/skills/<name>/SKILL.md` — Codex, pi, DeepSeek Harness, OpenCode, VS Code Local

  Bundled scripts, references, and templates are copied alongside each `SKILL.md`.

- **Always-on instructions** — one managed block in `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.pi/agent/AGENTS.md`, and `~/.dsh/AGENTS.md`.
- **GitHub Copilot instructions** — `~/.copilot/instructions/<name>.instructions.md`.

Clients that read more than one skills root (OpenCode and VS Code Local) may list the same skill twice. The files are identical and resolve to the same skill, so this is cosmetic.

Your selection is saved to `~/.quiver/quiver.json`.

### Third-party skills

Skills can be pulled from GitHub using a URL of the form:

```
github:owner/repo[/path][@ref]
```

The whole skill directory is fetched — `SKILL.md` plus any bundled scripts,
reference docs, templates, or additional instruction files — preserving the
nested structure under each skills root.

**Private repositories** you're authenticated to are supported. quiver picks
the first credential that actually works, in this order:

1. The **GitHub CLI** OAuth token (`gh auth login`) — this is the recommended
   path and keeps working even when your org disables Personal Access Tokens.
2. `GITHUB_TOKEN` / `GH_TOKEN` environment variables (e.g. CI's built-in token).

A blocked or expired credential in the environment transparently falls back to
your GitHub CLI login, so PATs are never required.

Public repos work without a token, subject to GitHub's unauthenticated API
rate limits.

### Skill dependencies

Some skills are thin entry points into another skill — `grill-me`, for example,
delegates the actual interview to the `grilling` skill. Those dependencies are
declared in `registry.json` and installed automatically by `add` and `sync`, so
you only ever select the skill you want to use.

Run `quiver sync --refresh` to re-fetch them and rebuild the outputs.

## License

MIT
