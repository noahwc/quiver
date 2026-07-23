---
name: quiz-me
description: "Generate a short interactive quiz on the code the agent just wrote (or a diff), so you prove you understand the implementation before shipping it. Opens a self-contained HTML page with auto-graded questions about behavior, design rationale, failure modes, and change impact — not language trivia. Use after landing a non-trivial change, or invoke manually: /quiz-me. Complements slopchop-review (correctness) — this checks the human's understanding."
type: skill
auto-trigger: false
---

# quiz-me

> Principle: passing tests prove the code works; a quiz proves *you* understand
> the code you told the agent to write. Every question must be answerable only by
> reading *this diff* — never generic language trivia.

## When to run

- Manually via `/quiz-me`, or offer it after landing a non-trivial change (new
  logic, a new abstraction, concurrency, auth, or a multi-file refactor).
- Skip trivial diffs (< ~10 meaningful changed lines, pure renames, formatting,
  generated files). Say so and stop — a quiz on nothing wastes everyone's time.

## 1 — Get the diff (cheap on tokens)

Default to `git diff` (working tree). Support `git diff --staged`, a branch range
(`main...HEAD`), a PR, or "the change you just made" (the edits from this session).
Work from the **diff output only**; do at most a couple of short, targeted context
reads. Never read whole files to build a quiz.

## 2 — Write the questions (this is the only thing you author)

Produce 3–7 questions — count scales with diff size and risk. Each question tests
*implementation understanding of this change*.

Good question types:

- **Trace / behavior** — "given input X, what does the new `resolveConfig`
  return?"
- **Design rationale** — "why is the debounce in the hook, not the component?"
  (only ask about a decision that is actually visible in the diff)
- **Failure mode** — "what happens now if the API returns 429?" / "which new edge
  case is still unhandled?"
- **Change impact** — "which existing callers must change because the signature
  changed?"
- **Modification probe** — "to add a second cache key, what would you edit?"
- **Load-bearing line** — a `select_line` question: "which line makes the retry
  idempotent?"

**Banned** (reject these — they don't prove understanding of the change):

- Language/stdlib trivia: "what does `Array.map` do?", "what is a closure?"
- Anything answerable without reading the diff.
- Questions about unchanged code, or that a formatter/linter would catch.
- Trick questions about syntax.

For MCQ and `select_line`, distractors must be **plausible misreadings of this
diff** — the old behavior, an off-by-one, the tempting-but-wrong call site — not
obvious throwaways. Keep any embedded `code`/`lines` excerpt ≤ ~10 lines.

## 3 — Build the page and open it

Write the questions as a JSON object to a temp file, inject it into the shipped
template (no HTML authored per quiz — reliable and cheap), then open it.

JSON schema (`quiz.json`):

```json
{
  "title": "Quiz: <short change name>",
  "subtitle": "<n> questions on <scope, e.g. the retry refactor>",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "What does resolveConfig() return when the key is missing?",
      "code": "optional ≤10-line excerpt shown above the question",
      "options": ["undefined", "the default config", "throws", "null"],
      "answer": 1,
      "explanation": "src/config.ts:42 — falls back to DEFAULTS via ?? ."
    },
    {
      "id": "q2",
      "type": "select_line",
      "prompt": "Click the line that makes the retry idempotent.",
      "lines": ["async function retry(req) {", "  const key = req.idKey;", "  ..."],
      "answer": [2],
      "explanation": "The idempotency key dedupes retried POSTs."
    },
    {
      "id": "q3",
      "type": "free",
      "prompt": "Why is the cache keyed on userId+locale rather than userId?",
      "answer": "Localized responses differ per locale; keying on userId alone would serve the wrong language from cache.",
      "explanation": "src/cache.ts:18 — key builder now joins locale."
    }
  ]
}
```

Field notes: `answer` is the 0-based option index (`mcq`), an array of 1-based
line numbers (`select_line`), or the model-answer string (`free`). `mcq` may use
`code`; `select_line` uses `lines` (rendered clickable). `explanation` should cite
`file:line`.

Build and open (template installs alongside this skill):

```sh
TPL=~/.claude/skills/quiz-me/template.html
OUT=~/.copilot/findings/$(date +%F)-quiz-<slug>.html
mkdir -p ~/.copilot/findings
node -e 'const fs=require("fs");const [t,d,o]=process.argv.slice(1);fs.writeFileSync(o,fs.readFileSync(t,"utf8").replace("/*__QUIZ_DATA__*/null",fs.readFileSync(d,"utf8")));' "$TPL" quiz.json "$OUT"
open "$OUT"        # macOS; use xdg-open on Linux
```

Then reply with 1–2 lines: what the quiz covers and to paste results back when
done. Do not print the questions in chat.

## 4 — After the user pastes results back

They click **Copy results**, which yields a `QUIZ_RESULTS {…}` JSON blob. When
they paste it:

- Summarize per question: ✓ correct, ~ partial, ✗ missed / unanswered.
- For every ~ / ✗, give a short correction grounded in the actual code with
  `file:line` pointers — teach, don't scold. "I missed it" is fine.
- If several answers were weak, offer a guided walkthrough of those specific spots.

Keep the whole loop fast: one diff read, one JSON payload, one page.
