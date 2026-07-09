---
name: project-conventions
description: Template for project stack, coding rules, and architecture documentation
type: instruction
auto-trigger: false
---

## Stack

<!-- TODO: Fill in your project's stack. Examples: -->
- Language: TypeScript 5.x, Node 20
- Framework: Next.js 14 (App Router)
- Testing: Vitest, Playwright
- Styling: Tailwind CSS

## Rules

<!-- TODO: Add your project's coding conventions. Examples: -->
- Use named imports, not default imports
- Prefer `const` over `let`; avoid `var`
- Error handling: use Result pattern from `src/lib/result.ts`
- Never use `any`; use `unknown` + type guards

## Architecture

<!-- TODO: Describe your project's directory structure. Examples: -->
- `src/app/` — Next.js routes
- `src/lib/` — shared utilities
- `src/components/` — UI components
- `src/services/` — external API integrations

## Key principles

- Only include facts the AI can't infer from code
- Do not duplicate things the AI can see in your codebase
- Keep this file lean — every line costs tokens on every request
