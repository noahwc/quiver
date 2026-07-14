---
name: slopchop-review
description: >
  Hunk-by-hunk diff triage with three verdicts: FIX (must change, with the
  concrete fix), DISCUSS (question or tradeoff for the author), OK (silent).
  Ends with a FIX/DISCUSS summary and offers to apply the FIXes. For reviewing
  working-tree changes, staged changes, branches, or PRs. Invoke manually:
  /slopchop-review. Complements ponytail-review (over-engineering only) —
  this one covers correctness, security, and edge cases.
type: skill
auto-trigger: false
---

# slopchop-review

> Principle: a review verdict per hunk beats an essay per file. Every finding
> is either actionable (FIX) or a genuine question (DISCUSS) — nothing else.

**pi guard**: if running under the pi coding agent and the `pi-slopchop`
extension is loaded, defer to it and stop — it does this natively.

## 1 — Get the diff

Default to `git diff` (working tree); use `git diff --staged`, a branch range
(`main...HEAD`), or a PR diff if the user names one. If the diff is empty, say
so and stop.

## 2 — Triage every hunk

Walk the diff hunk by hunk, in file order. Read enough surrounding code to
judge — a hunk is not reviewable in isolation. Assign exactly one verdict:

- **FIX** — must change before merge: correctness bugs, security issues,
  unhandled edge cases, API misuse, broken error handling, data loss risk.
  Always include the concrete fix, not just the complaint.
- **DISCUSS** — a real question or tradeoff the author should weigh: unclear
  intent, behavior change that may be deliberate, missing test for risky
  logic. Phrase as a question.
- **OK** — fine as-is. Do not report OK hunks individually; count them.

Out of scope: style nits a formatter would catch, and over-engineering
(that's ponytail-review's job).

Report format, one block per non-OK hunk:

```
FIX src/auth.ts:42 — token expiry compared with `<` against seconds, but
    `exp` is ms. Fix: `Date.now() < exp` → `Date.now() < exp * 1000`.
DISCUSS src/api.ts:88 — retries removed for POST /orders; intentional?
```

## 3 — Summarize and offer to fix

End with:

- **FIX (n)** — numbered list, one line each.
- **DISCUSS (n)** — numbered list, one line each.
- **OK** — count only (e.g. "31 hunks OK").

Then offer to apply the FIXes. Only edit after the user agrees, and apply
only the agreed items — DISCUSS items are never auto-applied.
