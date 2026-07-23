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

The whole skill directory is fetched — `SKILL.md` plus any bundled scripts,
reference docs, templates, or additional instruction files — preserving the
nested structure under `~/.claude/skills/<name>/`.

**Private repositories** you're authenticated to are supported. quiver picks
the first credential that actually works, in this order:

1. The **GitHub CLI** OAuth token (`gh auth login`) — this is the recommended
   path and keeps working even when your org disables Personal Access Tokens.
2. `GITHUB_TOKEN` / `GH_TOKEN` environment variables (e.g. CI's built-in token).

A blocked or expired credential in the environment transparently falls back to
your GitHub CLI login, so PATs are never required.

Public repos work without a token, subject to GitHub's unauthenticated API
rate limits.

Run `quiver sync --refresh` to re-fetch them and rebuild the outputs.

## License

MIT
