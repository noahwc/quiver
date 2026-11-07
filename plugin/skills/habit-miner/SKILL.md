---
name: habit-miner
description: 'Mine session history for repeated user corrections and propose When → Do habits, each requiring explicit human approval before activation. Use when the user asks to mine sessions, learn from feedback, or review recurring corrections — or when you notice the user correcting the same behavior for the second time or more. Approved habits are written to the always-on habits instruction skill. Nothing activates without approval.'
---

# habit-miner

> Principle: repeated corrections are unpaid instructions. Turn them into
> explicit, human-approved habits instead of relearning them every session.

**pi guard**: if running under the pi coding agent and the `pi-experiences`
extension is loaded, defer to it and stop — it does this natively.

## 1 — Gather evidence

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

## 2 — Cluster into candidates

A candidate habit requires the same correction in **at least 2 separate
sessions**. One-off corrections are noise — ignore them. For each candidate,
draft:

- **When** — the triggering context, specific enough to not misfire
  (e.g. "When writing commit messages", not "When coding").
- **Do** — the corrected behavior, one imperative sentence.
- **Evidence** — 2–3 short quotes of the user's corrections, with dates.

## 3 — Review one at a time

Present each candidate individually (use the ask-questions facility if
available): approve / edit / reject. Never batch-approve. Never activate a
habit the user has not explicitly approved. Rejected candidates are dropped —
do not re-propose them in future runs unless new evidence appears.

## 4 — Write back approved habits

- **Preferred**: append a `- When <trigger> → <behavior>` bullet to the
  `habits` skill in the local quiver checkout
  (`~/code/quiver/skills/productivity/habits/SKILL.md`), then tell the user to
  run `quiver sync` so it distributes to all tools.
- **Fallback** (no quiver checkout): append the bullet to
  `~/.copilot/instructions/habits.instructions.md` and `~/.claude/CLAUDE.md`
  (outside any `quiver:start`/`quiver:end` managed block — content inside it
  is overwritten on sync).

End with a summary: habits approved, rejected, and where they were written.
