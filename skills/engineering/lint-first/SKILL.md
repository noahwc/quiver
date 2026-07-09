---
name: lint-first
description: >
  Run deterministic tooling (typecheck, linters, autofixers) FIRST — before any
  agentic file-by-file inspection — when asked to find or fix syntax errors, type
  errors, code quality issues, `any` usage, or to "check/clean up/audit the
  codebase". Two stages: (1) discover and use the repo's existing
  typecheck/lint/format setup; (2) if none exists, propose adding one before
  doing any manual inspection. Manual reading is the LAST resort, reserved for
  what tooling cannot catch or fix.
category: engineering
type: skill
auto-trigger: true
targets:
  - claude
  - opencode
  - copilot
---

# lint-first

> Principle: compilers and linters are faster, cheaper, and more complete than an
> agent reading files. Let tooling produce the worklist; spend agent effort only on
> the residue.

## Stage 1 — Discover and use the existing setup

Before running anything, find what the repo already has. Use it as-is — do not
introduce a different tool alongside an existing one.

1. **Check `package.json` scripts** (or `Makefile`/`justfile`) for `typecheck`,
   `lint`, `lint:fix`, `format`, `check` targets. Prefer these over raw tool
   invocations — they encode the repo's flags and file globs.
2. **Check for tool configs** if scripts are missing or ambiguous:
   - Typecheck: `tsconfig.json` → `tsc --noEmit -p <tsconfig>`.
   - Lint: `eslint.config.*` / `.eslintrc*`, `.oxlintrc.json`, `biome.json(c)`.
   - Format: `.prettierrc*` / `prettier` key in package.json, biome formatter.
3. **Match the package manager** — lockfile tells you (`pnpm-lock.yaml`,
   `package-lock.json`, `yarn.lock`, `bun.lockb`). Run scripts with that manager.
4. **Run in this order**: typecheck → linter autofix (`--fix`) → formatter
   (`--write`) → fix remaining diagnostics by hand from the tool's list.
5. **Re-run after each batch** of manual fixes to confirm the count drops.
6. **Only then inspect agentically** — targeted greps and file reads for what
   tooling can't express (design-level typing, e.g. replacing `any`/`z.any()` with
   real types or schemas, erased generics like `Foo<any>` → `Foo[]`).
7. **Verify with the same tools** — done means the repo's typecheck AND lint
   scripts exit 0, plus a runtime smoke test where cheap (run the test suite,
   boot the server, or exercise the main entry point).

## Stage 2 — No setup found? Suggest one, don't improvise

If Stage 1 finds no typecheck/lint/format setup (no scripts, no configs):

1. **Tell the user what's missing** and propose adding it — don't silently adopt
   a tool the repo hasn't chosen. Suggested minimal setup for a TS repo:
   - `typecheck`: `tsc --noEmit` (add a `tsconfig.json` if absent).
   - `lint` / `lint:fix`: oxlint (fast, zero-config) or eslint if the org
     standardizes on it.
   - `format`: prettier or biome.
2. **Offer a one-off zero-config run as a stopgap** while they decide — e.g.
   `npx oxlint <dirs>` and `npx prettier --check <dirs>` (or the repo's package
   manager's `dlx` equivalent) work without config — but flag that results
   aren't tuned to the repo.
3. **If the user approves adding the setup**, wire it into `package.json`
   scripts so future runs hit Stage 1, then proceed with the Stage 1 order of
   operations.

## Triage tool output — not all findings are equal

- **Fix**: correctness-tier rules (the linter's default/recommended set),
  `no-shadow` (masks bugs), unused params, redundant spreads.
- **Leave**: pedantic/style-tier noise when it fights deliberate idioms —
  `!= null` (intentional null-or-undefined check), `require-await` on interfaces
  accepting sync-or-Promise, `typeof x !== "undefined"` guards, inline comments.
- State what you skipped and why, so the user can overrule.

## Gotchas

- Some linters (e.g. oxlint) may print nothing in agent terminals even on
  success — trust the exit code, not the absence of output.
- Version-manager-provided tools (pnpm/npx via nvm etc.) may be missing from the
  plain agent PATH — run via a login shell (`/bin/zsh -lc '…'`) if not found.
- After any bulk edit, re-run the typechecker before moving on — mechanical
  edits reliably introduce bracket/paren typos the compiler catches instantly.

## Anti-patterns

- Reading files one-by-one hunting for errors the compiler already lists.
- Hand-editing formatting/style issues an autofixer handles.
- Declaring success without re-running typecheck + lint.
- "Fixing" every pedantic warning — churn without value; triage first.
