---
name: html-summary
description: >
  Use when: presenting large findings (research, investigations, audits,
  comparisons, multi-section reports). Write a standalone HTML summary optimised
  for scannability and open it automatically, instead of printing a wall of text
  in chat/terminal.
category: productivity
type: skill
auto-trigger: true
targets:
  - claude
  - opencode
  - copilot
---

When a findings summary would be large (roughly 3+ sections or ~40+ lines of
prose), write a standalone HTML file and open it instead of printing the full text
in chat. Not for routine or short summaries.

- Write to `~/.copilot/findings/YYYY-MM-DD-<topic-slug>.html` (create the folder
  if missing; never the working directory).
- Self-contained: inline CSS only, no CDNs/JS/external fonts; respect
  `prefers-color-scheme`.
- Scannable: title + one-line TL;DR up top, clear headings, tables for
  comparisons, short bullets, status/severity badges where relevant.
- Open with `open <file>` (macOS), then post a 2-3 sentence recap in chat —
  never leave the reply empty.
