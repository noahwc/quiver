---
name: commit-split
description: "Split uncommitted changes into semantic commits and push the current branch. Use when a working tree mixes unrelated changes and the user asks to commit, clean up, or split them into logical commits, or invoke manually: /commit-split. Never rewrites history or force-pushes; asks before pushing the default branch."
type: skill
auto-trigger: false
---

# commit-split

One commit = one reason a reviewer can accept or revert. The worktree is the
only copy of the uncommitted work, so it must survive every step — that is why
the destructive shortcuts below stay off-limits even when they would make
splitting easier.

**Scope:** staged, unstaged, and untracked changes. Not existing commits,
interactive rebase, fixup/absorb, or opening PRs.

## Safety

- Never discard worktree content: `reset --hard`, `checkout -- .`, `clean`.
- Never force-push, rewrite pushed history, amend, or use `--no-verify`.
- Never commit secrets, keys, or credentials; stop and ask.
- Never run interactive commands (`add -p`, `rebase -i`); they hang an agent.
- Undo a commit created by this run and not yet pushed with
  `git reset --soft HEAD~1` (returns changes to the index) — only with consent.

## Directives

The prompt overrides defaults: "don't push", "push", "allow main", "one
commit", "skip checks", "leave `path` out". Default: commit, then push the
current branch. Echo active directives in the plan and report.

## Workflow

- [ ] Preflight
- [ ] Survey
- [ ] Group into units
- [ ] Plan
- [ ] Commit each unit
- [ ] Verify and push

### 1 — Preflight

Stop if: not a repo; a merge/rebase/cherry-pick/revert or unmerged paths; no
`HEAD` (ask for an initial commit); no changes; detached HEAD (ask — commits
are possible, pushing is not).

Record branch, upstream, remotes, and default branch. If upstream exists,
`git log --oneline @{u}..HEAD` lists commits the push will also send; ask if
they look unrelated.

Run `git reset` (mixed) so `git diff` is the complete uncommitted change. The
worktree is untouched; pre-existing staging is regrouped, not lost. Say so.

Scan filenames and the diff for secrets/junk; stop and ask.

### 2 — Survey

Run `git status --porcelain=v2 -uall`, `git diff --stat HEAD`,
`git diff --numstat HEAD`, and `git ls-files --others --exclude-standard`. For
large trees, read diffs per file or directory; never paste the whole diff. Read
recent commit style and repo conventions (`AGENTS.md`, `CONTRIBUTING.md`,
commitlint config), and find the documented check command.

Build an inventory: file → changed lines → intent. Note binary, mode-only,
renamed, deleted, and submodule changes.

### 3 — Group into units

A unit is the smallest coherent change a reviewer can understand and revert
alone — not a file, and not a whole task.

- Together: feature + wiring + tests; fix + regression test; refactor + call
  sites; dependency + lockfile + required code; docs for this change.
- Separate: unrelated fixes; a refactor from the feature it enables; standalone
  docs/chore/formatting; generated churn with no code reason.
- Never split tests from the behavior they test, or a rename from its call
  sites.
- Merge units that would always be reverted together; split when the subject
  needs two unrelated verbs.
- Order: mechanical/refactor → fix → feature → docs/chore.
- Messages: match the repo's voice; imperative, ≤72 characters; body only for
  why or breaking notes; no invented references or verification claims.

### 4 — Plan

Print then proceed; an explicit invocation is approval, so do not ask
"proceed?".

```
base <sha> on <branch> (+N files, +A/−D)
1. fix(parser): reject empty input — src/parser.ts (hunk 2), tests/parser.test.ts
2. feat(cli): add --json — src/cli.ts, docs/cli.md
push: origin/<branch> (3 commits ahead)
```

Ask only for: default-branch push, secrets/junk, a mixed hunk no tool can
split, unrelated ahead commits, or genuinely ambiguous grouping.

### 5 — Commit each unit

1. Assert the index is empty (`git diff --cached --quiet`); else `git reset`.
2. Stage exactly the unit:
   - whole files: `git add -A -- <paths>`;
   - intra-file: `git-surgeon` if installed, else the whole-hunk recipe in
     [reference/hunk-staging.md](reference/hunk-staging.md);
   - a mixed hunk with no tool → stop and ask.
3. Verify `git diff --cached --name-status`, `--stat`, and `--check` match the
   plan.
4. Commit with `git commit -F -` and a heredoc. Hooks run normally.
   - Auto-fixing hook → re-stage, retry once. Any other failure → stop; never
     `--no-verify`.
5. Confirm `git show --stat --oneline HEAD`. If an unintended file landed, stop
   (consent + `reset --soft` only if unpushed and from this run).
6. If the tree changed underneath (hook, user, generated file), re-survey
   before the next unit.

### 6 — Verify and push

- Tree clean except deliberate exclusions; report leftovers.
- Run the documented check once unless "skip checks". Read-only — no `--fix` or
  `--write`. Failure → keep commits local and don't push. This proves the final
  tree, not each commit.
- No remote → stop. Default branch → ask (new branch / push anyway / stop).
  Upstream → `git push`; else `git push -u <remote> HEAD`.
- Rejection, auth failure, or protected branch → stop with the exact `fetch` +
  `pull --rebase` next step; never force. No tags. Confirm with
  `git status -sb`.

### 7 — Report

Commits (`<sha> <subject> (N files)`), push status, checks run or skipped,
exclusions/leftovers, and the next command if stopped.
