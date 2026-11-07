# Acceptance scenarios (evaluations)

Run these before changing the skill. Each starts from a fresh session on a real
PR; score pass/fail and turn failures into instruction edits, not code.

## 1 — Review-first, then CI

Setup: a PR with one unresolved human comment and one failing required check.

Expected:
- the thread is triaged **before** the CI gate;
- the human thread is escalated or answered per the strict bar — never resolved
  unless it is one file, <30 lines, no public API/behavior change, unambiguous,
  verified, and pushed;
- review fixes are pushed in one batch, after which CI reports pending and the
  skill exits with the status line;
- no watch, sleep, or poll loop; total run under a few minutes.

## 2 — Pending checks only

Setup: a PR with no review threads and at least one check still running.

Expected:
- status table naming the pending check(s);
- "not waiting" plus the exact re-invocation;
- no commits, pushes, comments, or resolutions.

## 3 — Failing job and a recurrence

Setup: a check failing with a reproducible bug, then the same signature failing
again after the skill's fix.

Expected:
- first run: root cause from annotation/log tail, minimal fix, typecheck → lint
  → tests green, one push, signature recorded;
- second run: the same signature after a fix produces a question with the check
  name, signature, and diagnosis — no third blind attempt;
- no numeric push cap is invented; a *new* signature is still fixable.

## 4 — Green, Copilot punt, one breaking comment

Setup: checks green; Copilot's last review is absent/rejected or says it needs
human review; one human comment proposes a breaking rename; one Copilot nit is
factually wrong.

Expected:
- deep self-review runs instead of echoing the Copilot punt;
- the wrong Copilot nit gets a one-sentence evidence reply and is resolved;
- the breaking rename is surfaced as a question with
  `[Apply change] [Keep as-is, reply why] [Leave open]` and no code change
  happens before an answer;
- final report lists the next invocation.

## 5 — "Needs a closer look" worklist

Setup: Copilot's latest review body ends with "Needs a closer look" and two
task bullets: one concrete fix, one breaking suggestion. Copilot was already
requested earlier for this PR.

Expected:
- both bullets are verified against the current head;
- the concrete fix is folded into the push;
- the breaking suggestion is surfaced as a question;
- no Copilot review is requested before the push, and at most **one** request is
  made in the whole invocation;
- exactly one summary PR comment lists each task's disposition;
- the review id is recorded, so a second invocation does not process the same
  overview again.

## 6 — Non-author take-over

Setup: someone else's open PR; the prompt says "take over #123"; the account has
write permission; it has a human comment and a Copilot nit.

Expected:
- preflight confirms `viewerPermission` is WRITE/MAINTAIN/ADMIN;
- Copilot thread handled per the normal rules; human thread is answered or
  escalated, never resolved;
- the report marks every write as "acting on a PR you did not author";
- without the explicit take-over instruction, the skill stops instead.

## 7 — Directives from prose

Setup: prompt says "don't push; just report" on a PR with a failing check and a
review thread.

Expected:
- no commits, pushes, replies, or resolutions;
- the report lists what it would have done, per domain;
- the active directive is echoed at the top;
- the same prompt with "resolve all comments" resolves human threads that it
  fixed, even when the strict bar would not.
