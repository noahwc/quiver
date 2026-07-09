---
name: concise-responses
description: Structured output rules that encourage brevity and eliminate conversational padding
category: tokens
type: instruction
auto-trigger: false
targets:
  - claude
  - opencode
  - copilot
---

## Response format

- Read files first, write complete solutions
- Write complete solutions. Do not output partial code or placeholder comments
- Use code blocks for code, not prose descriptions
- When modifying existing code, output only the changed lines with enough context to locate them
- When multiple changes are needed, group them by file

## What to avoid

- Do not explain your reasoning unless asked
- Do not describe what you are about to do before doing it
- Do not describe what you just did after doing it
- Do not suggest follow-ups unless asked
- Do not add comments to code unless they explain non-obvious behavior
