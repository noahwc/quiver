---
name: habit-miner
description: "Mine session history for (1) repeated user corrections, proposed as When → Do habits that each need explicit human approval, and (2) repeated questions, lookups, file reads, and commands in the current repo, turned into agent-cli subcommands stored outside the repo. Use when the user asks to mine sessions, learn from feedback, review recurring corrections, or build/refresh agent-cli — or when you notice the user correcting the same behavior, or yourself repeating the same lookup, for the second time or more."
type: skill
auto-trigger: true
---

# habit-miner

> Principle: repeated corrections are unpaid instructions, and repeated
> lookups are unpaid tooling. Turn the first into human-approved habits and
> the second into a per-repo CLI instead of relearning them every session.

Every run does both passes. Pass 2 needs a git repo; outside one, say so and
skip it.

**pi guard**: if running under the pi coding agent and the `pi-experiences`
extension is loaded, defer to it and stop — it does this natively.

## Pass 1 — corrections → habits

### 1 — Gather evidence

Read recent session history from whichever source this tool provides:

- **VS Code Copilot** — the chronicle session store (`session_store_sql`).
  Search user turns for correction language, e.g. FTS5 `MATCH` on terms like
  `"no" OR "don't" OR "actually" OR "again" OR "instead" OR "stop" OR "I said"`,
  then read surrounding turns for context.
- **Claude Code** — session transcripts under `~/.claude/projects/**/*.jsonl`;
  grep user-role messages for the same correction language.
- **OpenCode** — session storage under `~/.local/share/opencode/`.

Cover roughly the last 2 weeks or 20 sessions, whichever is smaller. If no
session history is accessible, say so and stop — do not invent habits.

### 2 — Cluster into candidates

A candidate habit requires the same correction in **at least 2 separate
sessions**. One-off corrections are noise — ignore them. For each candidate,
draft:

- **When** — the triggering context, specific enough to not misfire
  (e.g. "When writing commit messages", not "When coding").
- **Do** — the corrected behavior, one imperative sentence.
- **Evidence** — 2–3 short quotes of the user's corrections, with dates.

### 3 — Review one at a time

Present each candidate individually (use the ask-questions facility if
available): approve / edit / reject. Never batch-approve. Never activate a
habit the user has not explicitly approved. Rejected candidates are dropped —
do not re-propose them in future runs unless new evidence appears.

### 4 — Write back approved habits

- **Preferred**: append a `- When <trigger> → <behavior>` bullet to the
  `habits` skill in the local quiver checkout
  (`~/code/quiver/skills/productivity/habits/SKILL.md`), then tell the user to
  run `quiver sync` so it distributes to all tools.
- **Fallback** (no quiver checkout): append the bullet to
  `~/.copilot/instructions/habits.instructions.md` and `~/.claude/CLAUDE.md`
  (outside any `quiver:start`/`quiver:end` managed block — content inside it
  is overwritten on sync).

## Pass 2 — repeated lookups → agent-cli

`agent-cli` answers recurring repo questions in one call. Nothing is written
to the repo: subcommands live in `~/.quiver/agent-cli/<owner>/<repo>/`, keyed
by the `origin` remote, so every clone and worktree shares them. No approval
is needed — the files are outside the repo and trivially reversible.

### 5 — Install the dispatcher

Copy this skill's `scripts/agent-cli` to `~/.quiver/agent-cli/agent-cli` and
`chmod +x` it (overwrite every run so updates propagate). Then
`DIR=$(sh ~/.quiver/agent-cli/agent-cli --where)`, `mkdir -p "$DIR"`, and run
`sh ~/.quiver/agent-cli/agent-cli` to see existing subcommands (exit 3 = none).

### 6 — Mine this repo's sessions

Same window as step 1, but only sessions for this repo, and read the **tool
calls** and the user's questions, not just corrections:

- **Copilot session store** — `session_store_sql`: `tool_requests` (`name`,
  `arguments_json`) for `session_id`s from `sessions` filtered on
  `repository`/`cwd`.
- **Copilot CLI** — `~/.copilot/session-state/<id>/events.jsonl`
  `tool.execution_start` events (`data.toolName`, `data.arguments`) where that
  session's `workspace.yaml` has a matching `repository:` or `cwd:`.
- **Claude Code** — `tool_use` blocks in
  `~/.claude/projects/<cwd with / as ->/*.jsonl`.
- **OpenCode** — tool parts in `~/.local/share/opencode/` storage for this
  project.

Exclude the current session and any prior habit-miner runs.

List every question, lookup, file read, and command that recurs in **at least
2 separate sessions** (normalize trivial differences: flags order, paths under
the same dir, `cat`/`view` of the same file). For each, record: item, sessions
seen, and tool calls spent per occurrence (the lookup plus any retries or
follow-up reads it took to get the answer).

### 7 — Write subcommands

One subcommand per repeated item (merge near-duplicates; update an existing
subcommand rather than adding a sibling). Each is a POSIX sh file at
`$DIR/<name>` (`[a-z0-9-]` only):

```sh
#!/bin/sh
# summary: <one line, shown by `agent-cli`>
set -eu
case "${1:-}" in -h|--help) echo "usage: agent-cli <name> [--json]  <what it answers>"; exit 0;; esac
cd "$AGENT_CLI_REPO"
# ... terse answer; JSON when "$1" = --json
```

- Terse output written for an agent, not a human. Own `--help`. `--json` flag.
- No new dependencies: only tools the transcripts show this repo already uses.
- Prefer live commands over stored facts. A static fact must name its source
  file so staleness is detectable.
- Never embed secrets, tokens, or personal data.

Run each subcommand, its `--help`, and `--json` to verify, and time it.

### 8 — Report

End with a summary:

- **Habits** — approved, rejected, and where they were written.
- **agent-cli** — a table of repeated items:

  | Item | Sessions | Before (tool calls each) | After | Runtime |
  | --- | --- | --- | --- | --- |
  | how to run one test file | 4 | 3 (read package.json, guess, retry) | `agent-cli test-one <file>` (1) | 0.4s |

  Then total calls before vs. after across the mined window.
