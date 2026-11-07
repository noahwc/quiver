# Hunk staging and push mechanics

Exact commands for `commit-split`. Run from the repo root with
`git --no-pager`; use `--no-ext-diff` so diff tools and pagers cannot alter
the output.

Contents: index · tooling · whole files · whole hunks · commit and verify ·
branch facts · secrets · recovery · push.

## Index

```sh
git reset -q                 # unstage all; worktree untouched
git diff --cached --quiet    # exit 0 means clean
```

The index must be clean before each unit; `git reset` if a hook dirties it. On
an unborn branch, stop and ask for an initial commit — the patch recipe needs
`HEAD`.

## Tooling

```sh
command -v git-surgeon || true
```

If installed, prefer it for intra-file hunks:

```sh
git-surgeon hunks [--file <path>]
git-surgeon show <hunk-id>
git-surgeon commit <hunk-id>[:start-end] ... -m "subject" [-m "body"]
```

It refuses a dirty index and restores state if the commit fails. After a
commit, `hunks` lists what remains. Otherwise use whole-file or whole-hunk
staging; do not pipe answers to `git add -p` — prompt counts are unreliable.

## Whole files

```sh
git add -A -- path1 path2
git diff --cached --name-status
```

Covers new, deleted, renamed, mode-only, binary, and submodule pointer changes.
Pass both sides of a rename.

## Whole hunks without git-surgeon

Use only when the unit is complete `@@` blocks:

```sh
git diff --no-ext-diff --no-color -- <path> > /tmp/unit.patch
# Delete whole @@ blocks not in this unit; never edit the remaining lines.
git apply --check --cached /tmp/unit.patch
git apply --cached /tmp/unit.patch
```

The index must match `HEAD`; the worktree stays untouched, so other units
remain. If `--check` fails, fall back to whole-file staging or ask. A single
mixed hunk, a new file, or a binary file cannot be split this way.

## Commit and verify

```sh
git commit -F - <<'EOF'
subject

body paragraph
EOF
git show --stat --oneline HEAD
git status --short
```

## Branch facts

```sh
git branch --show-current
git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null \
  || git config --get init.defaultBranch || true
git remote
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true
git log --oneline '@{u}..HEAD' 2>/dev/null || true
```

Resolve the default from `origin/HEAD`, then `init.defaultBranch`. If neither
yields a name, treat a current `main`, `master`, or `trunk` branch as default
and ask. Never guess.

## Secrets

Stop on `.env*`, `*.pem`, `*.key`, `*.p12`, `id_rsa*`, `*credential*`,
`*secret*`, `.npmrc`, `.pypirc`, `.aws/`, and on private-key headers or token
prefixes in the diff. Never print the value.

## Recovery

```sh
git reset                 # wrong staging; worktree untouched
git reset --soft HEAD~1   # only a commit from this run, unpushed, with consent
```

Push rejected — report this, do not run it automatically:

```sh
git fetch
git pull --rebase
git push
```

## Push

```sh
git push
git push -u origin HEAD   # no upstream
git status -sb
```

Default branch: ask first. New branch: `git switch -c <branch>`, then
`git push -u origin HEAD`. Multiple remotes: use the upstream remote, else ask.
Never force.
