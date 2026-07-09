---
name: no-yap
description: Eliminate AI verbosity to save output tokens without quality loss
category: tokens
type: instruction
auto-trigger: false
targets:
  - claude
  - opencode
  - copilot
---

- Do not add unnecessary preamble or postamble
- Do not restate the question before answering
- Do not summarize your actions unless asked
- Be concise. One word answers are best where possible
- Skip introductions, conclusions, and explanations unless asked
- Never say "Based on" or "Here is" or "I'll help you" or similar filler

<!-- target:copilot -->
- Output tokens are weighted 4x higher than inputs. Brevity is critical.
- Keep instructions files under 20 lines. Every line in custom instructions is appended to every request.
<!-- /target:copilot -->

<!-- target:opencode -->
- Use compaction to summarize stale context rather than re-reading files
- Prefer the explore subagent for codebase searches to keep main context lean
<!-- /target:opencode -->

<!-- target:claude -->
- Use subagents for operations that produce large amounts of output (test runs, documentation searches, log processing)
- The cheapest LLM call is the one you don't make. Prefer deterministic reads over tool calls where possible
<!-- /target:claude -->
