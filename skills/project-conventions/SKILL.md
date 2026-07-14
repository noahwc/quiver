---
name: project-conventions
description: Template for project stack, coding rules, and architecture documentation
type: instruction
auto-trigger: false
---

## Stack

<!-- TODO: Fill in your project's stack. Examples: -->
- Language: `<language + version>`
- Framework: `<framework>`
- Testing: `<test runner>`
- Build/tooling: `<bundler, package manager>`

## Rules

<!-- TODO: Add your project's coding conventions. Examples: -->
- Import style: `<e.g. named vs default imports>`
- Language idioms to prefer or avoid: `<e.g. immutability, error handling>`
- Shared patterns and where they live: `<pattern> from <path>`
- Constraints the AI can't infer: `<e.g. banned APIs, required helpers>`

## Architecture

<!-- TODO: Describe your project's directory structure. Examples: -->
- `<dir>/` — `<what lives here>`
- `<dir>/` — `<what lives here>`
- `<dir>/` — `<what lives here>`

## Key principles

- Only include facts the AI can't infer from code
- Do not duplicate things the AI can see in your codebase
- Keep this file lean — every line costs tokens on every request
