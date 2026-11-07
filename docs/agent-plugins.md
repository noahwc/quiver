# Agent Plugins distribution

Decision record for whether quiver should distribute skills through
[Agent Plugins](https://agent-plugins.org/).

## Decision

The npm CLI remains the primary installer. `quiver export` generates a
secondary, publishable repository that gives zero-CLI discovery in the clients
that support a plugin catalog or package. Quiver is **not** being re-platformed
onto Agent Plugins.

## What Agent Plugins is

Agent Plugins 1.0 is a portable **package format**: `plugin.json`, `skills/`,
and optionally `mcp.json`. It standardizes how a package is laid out, not how it
is distributed. The specification leaves discovery, installation, updates,
permissions, and user experience to each client, and it defines no registry or
marketplace.

The clients that implement it ([list](https://agent-plugins.org/compatible-clients))
include VS Code, Cursor, GitHub Copilot, ChatGPT/Codex, Kiro, Hermes, OpenClaw,
Grok Bot, NanoClaw, OpenHands, and Perplexity Computer. Claude Code, pi, and
DeepSeek Harness are not on that list.

| Tool | Native skill root(s) | Agent Plugins 1.0 client? | Reached by the generated repo? |
|---|---|---|---|
| Claude Code | `~/.claude/skills/` | No — own `.claude-plugin/` format and marketplace | Yes, through `.claude-plugin/marketplace.json` |
| GitHub Copilot CLI | `~/.copilot/skills/` | Yes | Yes |
| VS Code Copilot | `~/.copilot/skills/` (Copilot harness); `~/.claude/skills/`, `~/.agents/skills/` (Local) | Yes | Yes |
| pi | `~/.pi/agent/skills/`, `~/.agents/skills/`, `.pi/skills/` | No — npm/git packages | Yes, through the root `package.json` |
| DeepSeek Harness | `~/.dsh/skills/`, `~/.agents/skills/`, `.dsh/skills/` | No — npm plugin bundles and indexes | No catalog; use `customSkillDirs` or the CLI |
| OpenCode | `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | No | Reads the shared roots; no plugin needed |

Sources: [compatible clients](https://agent-plugins.org/compatible-clients),
[Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference),
[VS Code agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins),
[VS Code authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference),
[pi packages](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/packages.md),
[DSH skill filesystem](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/skill/skill-filesystem),
[OpenCode skills](https://docs.opencode.ai/docs/skills/).

## Why not marketplace-first

- **Coverage.** The standard directly reaches 2 of the 5 tools quiver targets.
  Claude Code, pi, and DSH each need their own install mechanism.
- **No portable instructions.** Agent Plugins v1 has only skills and MCP
  servers. Quiver's `type: instruction` layer (always-on rules) cannot be
  represented; those skills stay CLI-only.
- **Selection.** `quiver add` installs a chosen subset globally. A plugin
  installs as a unit, per client, with a separate inventory in each tool.
- **Third-party ownership.** Quiver fetches third-party skills from upstream.
  Publishing them would make quiver a redistributor and replace `sync --refresh`
  with plugin version bumps.
- **The payload was already portable.** The real gap was that quiver only wrote
  `~/.claude/skills`. The fix was writing the native roots, not changing the
  packaging format.

## What `quiver export` produces

```sh
quiver export --out dist/quiver-plugin
```

```text
dist/quiver-plugin/
├── plugin.json                   # Agent Plugins 1.0 manifest (repo root = plugin)
├── skills/
│   └── <name>/SKILL.md + bundled assets
├── .claude-plugin/
│   └── marketplace.json          # Claude Code and VS Code/Copilot catalog (one entry, source `.`)
├── package.json                  # pi package (pi.skills -> ./skills)
├── README.md                     # generated install instructions
└── .quiver-export.json           # generated-file manifest for safe regeneration
```

The repository root is the plugin. VS Code's "Install Plugin from Source"
clones the repo; because the catalog has exactly one entry at `source: "."`, it
registers the marketplace and installs `quiver` directly. The same repo also
works when added as a marketplace.

Behavior:

- Default selection is every built-in `type: skill`; `--from-config` limits it
  to the built-in skills in `~/.quiver/quiver.json`.
- `type: instruction` skills are excluded and reported.
- `--include-third-party` is rejected; third-party skills stay with the CLI.
- `--subtree` emits only `plugin.json` + `skills/`; `npm run plugin:sync` uses it for this repo's `plugin/` directory.
- `--dry-run` prints the tree; a non-empty output directory requires `--force`.
- Skill frontmatter is normalized to Agent Skills fields: `name`, `description`,
  and `disable-model-invocation` when `auto-trigger` is false.
- Bundled assets are copied byte-for-byte, including binaries.

## This repo as the source

The repo root has a catalog pointing at the generated `plugin/` subtree:

```text
.claude-plugin/marketplace.json   # one plugin, source "./plugin"
plugin/
├── plugin.json
└── skills/
```

Regenerate it after changing skills:

```sh
npm run plugin:sync
```

Do not hand-edit `plugin/`. `tests/export/main-repo-layout.test.ts` regenerates
the subtree and compares every file, so CI fails when it is stale.

Install:

- VS Code/Copilot: add `noahwc/quiver` as a plugin source, or open
  `vscode://chat-plugin/install?source=noahwc%2Fquiver&plugin=quiver`.
- Claude Code: `/plugin marketplace add noahwc/quiver`, then
  `/plugin install quiver@quiver`.
- DSH/Codex: point `customSkillDirs` at `plugin/skills`, or run
  `quiver sync` and use `~/.agents/skills`.
- pi: the subtree has no package manifest; use the CLI or the separate export.

## Publishing

### This repo

1. Run `npm run plugin:sync` and `npm test`.
2. Commit `plugin/` and `.claude-plugin/marketplace.json`; tag a release.
3. Verify the installs above.

### Separate plugin repo

1. Generate the repo and inspect it:
   ```sh
   quiver export --out dist/quiver-plugin --force
   ```
2. Copy the contents to a public repository. The default is
   `noahwc/quiver-plugin`; change `DEFAULT_PLUGIN_REPO` in
   `src/export/plugin.ts` to use another name. Tag a release matching quiver's
   version.
3. Verify the installs:
   - Claude Code: `/plugin marketplace add noahwc/quiver-plugin`, then
     `/plugin install quiver@quiver`.
   - VS Code/Copilot: add `noahwc/quiver-plugin` as a plugin source in the Agent
     Customizations editor, open
     `vscode://chat-plugin/install?source=noahwc%2Fquiver-plugin&plugin=quiver`,
     or register only the marketplace with
     `vscode://chat-plugin/add-marketplace?ref=noahwc%2Fquiver-plugin`.
   - pi: `pi install git:github.com/noahwc/quiver-plugin`.
   - DSH: point `customSkillDirs` at `skills/`, or run
     `quiver sync` and use `~/.agents/skills`.

## Limitations

- One plugin contains all first-party skills. If context cost becomes a problem,
  split by category in a later change.
- Marketplace updates are versioned releases; `quiver sync` remains the way to
  get the latest third-party skills.
- Agent Plugins and its client support are still evolving. Re-check the
  compatible-clients list before advertising a client.
