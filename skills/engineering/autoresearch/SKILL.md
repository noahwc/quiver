---
name: autoresearch
description: "Metric-driven experiment loops: define a single measurable metric, baseline it, then iterate one change at a time — measure, compare, keep (commit) or discard (revert). State lives in git and a log file, not in context. Use for optimization work: make X faster, reduce bundle size, improve the benchmark, cut token usage, tuning parameters, or any run-measure-compare loop."
type: skill
auto-trigger: true
---

# autoresearch

> Principle: opinions don't optimize — measurements do. One metric, one change
> per iteration, git as the undo button.

**pi guard**: if running under the pi coding agent and the `pi-autoresearch`
extension is loaded, defer to it and stop — it does this natively.

## 1 — Define the experiment (with the user)

Agree on, before touching code:

- **Metric** — a single number, and its direction (minimize/maximize).
- **Measurement command** — one deterministic shell command that prints the
  metric (e.g. `hyperfine --warmup 3 './run'`, `wc -c dist/*.js`, a benchmark
  script). If measurement is noisy, run it 3× and use the median.
- **Stop criteria** — target value, iteration budget, or N consecutive
  non-improvements (default: stop after 3 non-improvements).

## 2 — Baseline

Require a clean working tree (commit or stash first). Run the measurement,
record the baseline in the log file (below). This is the number to beat.

## 3 — Iterate

Each iteration:

1. **One hypothesis, one change.** Never stack unrelated changes — a mixed
   result is unattributable.
2. **Measure** with the exact same command.
3. **Compare** against the current best.
   - Improved → **keep**: `git commit` with the metric in the message
     (e.g. `perf: memoize parse — 412ms → 287ms`).
   - No improvement → **discard**: `git checkout .` / revert fully. Do not
     leave losing changes in the tree.
4. **Log one line** per iteration to `EXPERIMENTS.md` (repo root, or a path
   the user prefers): `| # | change | metric | verdict |`. The log and git
   history carry the state — do not rely on conversation context to remember
   past iterations, re-read the log instead.

## 4 — Report

On stop: best metric vs baseline, which changes were kept (commits), which
hypotheses failed and why that's informative. Ask before deleting
`EXPERIMENTS.md` — it's the lab notebook.
