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
quiver export          # generate a publishable Agent Plugin repo
```

Add `--dry-run` to `add`, `sync`, or `export` to preview changes without writing files.

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

### Agent Plugin distribution

The CLI is the primary installer. Two plugin layouts are supported.

**This repository as the source.** `.claude-plugin/marketplace.json` advertises
the generated `plugin/` subtree, so `noahwc/quiver` can be added directly as a
plugin source in VS Code/Copilot:

```text
vscode://chat-plugin/install?source=noahwc%2Fquiver&plugin=quiver
```

Claude Code: `/plugin marketplace add noahwc/quiver`, then
`/plugin install quiver@quiver`.

`plugin/` is generated from `skills/`; after changing skills run
`npm run plugin:sync`. `npm test` fails if the committed subtree is stale.
The separately installable pi package is not part of this subtree; pi and DSH
users should use the CLI (or the separate export below).

**A separate plugin repo.** `quiver export --out dist/quiver-plugin` emits a
standalone repo (root `plugin.json` + `skills/` + catalog + pi package) for
`noahwc/quiver-plugin`.

Always-on instructions (`type: instruction`) and third-party skills are
intentionally excluded from both: Agent Plugins v1 has no instructions
component, and third-party skills stay owned by their upstream repositories.
Install those with `quiver add` / `quiver sync --refresh`.

See [docs/agent-plugins.md](docs/agent-plugins.md) for the coverage matrix,
client limitations, and publish steps.

### Skill dependencies

Some skills are thin entry points into another skill — `grill-me`, for example,
delegates the actual interview to the `grilling` skill. Those dependencies are
declared in `registry.json` and installed automatically by `add` and `sync`, so
you only ever select the skill you want to use.

Run `quiver sync --refresh` to re-fetch them and rebuild the outputs.

## License

MIT
