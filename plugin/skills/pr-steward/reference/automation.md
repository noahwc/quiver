# Getting called back when CI finishes

`pr-steward` never waits. One invocation = one shot; something else must call it
again once checks complete or review lands. Pick one trigger; all are
fire-and-forget.

## Option A — GitHub Actions `workflow_run` fixer (cloud, zero client state)

Fires when a CI workflow completes, so the agent wakes exactly once per run.
Based on Anthropic's `ci-failure-auto-fix.yml` example
(<https://github.com/anthropics/claude-code-action/blob/main/examples/ci-failure-auto-fix.yml>).

```yaml
name: PR steward
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

permissions:
  contents: write
  pull-requests: write
  actions: read

jobs:
  steward:
    if: >-
      github.event.workflow_run.conclusion == 'failure' &&
      github.event.workflow_run.pull_requests[0] &&
      !startsWith(github.event.workflow_run.head_branch, 'pr-steward/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_branch }}
      - run: gh pr checkout ${{ github.event.workflow_run.pull_requests[0].number }}
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
      # Run an agent (e.g. anthropics/claude-code-action) whose prompt is:
      #   "Run /pr-steward #<number> once. Do not wait for checks."
```

Guardrails, all mandatory:

- **Same-repo only.** `workflow_run.pull_requests[]` is empty for forks, and
  the job runs with secrets + write permissions — never wire this to fork PRs.
- **Loop guard.** Skip branches the agent pushed to (prefix, e.g.
  `pr-steward/`), and never chain more than one `workflow_run` level.
- **One trigger per workflow name** (or one fixer that inspects all failures).
- `check_run` / `check_suite` events do **not** fire for Actions-created
  checks — they only work for external CI (Jenkins, Buildkite, etc.).

## Option B — local scheduled task / cron (your machine)

The skill prints the re-invocation command. A scheduler can run the same
command on a cadence and exit immediately unless a PR needs attention:

```bash
for pr in $(gh pr list --author @me --json number --jq '.[].number'); do
  code=0; gh pr checks "$pr" >/dev/null 2>&1 || code=$?
  # 0 = finished, 8 = pending. Only act on finished-and-failed PRs.
  [ "$code" -ne 0 ] && [ "$code" -ne 8 ] && gh pr view "$pr" >/dev/null && echo "/pr-steward #$pr"
done
```

Wire the printed command into a DSH scheduled task, a cron entry, or a GitHub
Actions `schedule:` (minimum 5 minutes; avoid the top of the hour). Keep the
cadence low — it is a safety net, not a polling loop for the agent.

## Option C — webhook receiver

Register a repository/organization webhook (or GitHub App) for
`check_run`, `check_suite`, `workflow_run`, and `pull_request_review` events,
then POST to a small always-on receiver that starts the agent session with the
PR number. This is the lowest-latency option for a laptop or home server, and
it needs no polling at all. Guard against duplicate deliveries with the
delivery ID.

## Option D — delegate to GitHub's own agent (preview)

`gh agent-task create "Run /pr-steward #<n> once; do not wait for checks"` hands
the work to a Copilot cloud agent session that can push to the branch. Useful
when the laptop is offline; the session is visible in the PR (preview feature,
subject to change). GitHub's **Agent Merge** ("Watch and fix") is the same idea
natively — prefer it over duplicating CI-fix logic if the repo already uses it.

## Choosing

- CI in GitHub Actions, want it unattended → **A**.
- Everything runs locally, occasional PRs → **B**.
- Lowest latency, one repo, trusted machine → **C**.
- Offline / hands-off, Copilot plan available → **D**.

Whichever you pick: the skill must stay the same. It fixes, pushes, comments,
resolves, requests one Copilot re-review, reports — then exits.
