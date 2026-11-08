import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSkill } from "../../src/transpiler/parser.ts";

describe("parseSkill", () => {
  it("parses a basic instruction skill", () => {
    const md = `---
name: no-yap
description: Eliminate verbosity
category: tokens
type: instruction
auto-trigger: false
---

- Do not add preamble
- Be concise`;

    const result = parseSkill(md);
    assert.strictEqual(result.frontmatter.name, "no-yap");
    assert.strictEqual(result.frontmatter.type, "instruction");
    assert.strictEqual(result.frontmatter["auto-trigger"], false);
    assert.ok(result.baseContent.includes("Do not add preamble"));
  });

  it("keeps the full body as baseContent", () => {
    const md = `---
name: demo
description: A demo
category: productivity
type: skill
---

# Heading

Body text here.`;

    const result = parseSkill(md);
    assert.ok(result.baseContent.includes("# Heading"));
    assert.ok(result.baseContent.includes("Body text here."));
  });

  it("throws on invalid name", () => {
    const md = `---
name: INVALID
description: Test
type: instruction
---

Test`;
    assert.throws(() => parseSkill(md), /Invalid skill name/);
  });

  it("throws on missing description", () => {
    const md = `---
name: test
type: instruction
---

Test`;
    assert.throws(() => parseSkill(md), /requires a description/);
  });

  it("throws on invalid type", () => {
    const md = `---
name: test
description: A test
type: agent
---

Test`;
    assert.throws(() => parseSkill(md), /invalid type/);
  });

  it("defaults auto-trigger to true and type to skill", () => {
    const md = `---
name: test
description: A test
---

Test`;
    const result = parseSkill(md);
    assert.strictEqual(result.frontmatter["auto-trigger"], true);
    assert.strictEqual(result.frontmatter.type, "skill");
  });
});
