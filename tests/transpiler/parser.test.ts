import { describe, it, expect } from "vitest";
import { parseSkill } from "../../src/transpiler/parser.js";

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
    expect(result.frontmatter.name).toBe("no-yap");
    expect(result.frontmatter.type).toBe("instruction");
    expect(result.frontmatter["auto-trigger"]).toBe(false);
    expect(result.baseContent).toContain("Do not add preamble");
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
    expect(result.baseContent).toContain("# Heading");
    expect(result.baseContent).toContain("Body text here.");
  });

  it("throws on invalid name", () => {
    const md = `---
name: INVALID
description: Test
type: instruction
---

Test`;
    expect(() => parseSkill(md)).toThrow(/Invalid skill name/);
  });

  it("throws on missing description", () => {
    const md = `---
name: test
type: instruction
---

Test`;
    expect(() => parseSkill(md)).toThrow(/requires a description/);
  });

  it("throws on invalid type", () => {
    const md = `---
name: test
description: A test
type: agent
---

Test`;
    expect(() => parseSkill(md)).toThrow(/invalid type/);
  });

  it("defaults auto-trigger to true and type to skill", () => {
    const md = `---
name: test
description: A test
---

Test`;
    const result = parseSkill(md);
    expect(result.frontmatter["auto-trigger"]).toBe(true);
    expect(result.frontmatter.type).toBe("skill");
  });
});
