import { describe, it, expect } from "vitest";
import { parseSkill, composeContent } from "../../src/transpiler/parser.js";

describe("parseSkill", () => {
  it("parses basic instruction skill", () => {
    const md = `---
name: no-yap
description: Eliminate verbosity
category: tokens
type: instruction
auto-trigger: false
targets:
  - claude
  - opencode
  - copilot
---

- Do not add preamble
- Be concise`;

    const result = parseSkill(md);
    expect(result.frontmatter.name).toBe("no-yap");
    expect(result.frontmatter.type).toBe("instruction");
    expect(result.frontmatter["auto-trigger"]).toBe(false);
    expect(result.frontmatter.targets).toEqual(["claude", "opencode", "copilot"]);
    expect(result.baseContent).toContain("Do not add preamble");
    expect(result.targetSections).toHaveLength(0);
  });

  it("extracts target-specific sections", () => {
    const md = `---
name: no-yap
description: Eliminate verbosity
category: tokens
type: instruction
auto-trigger: false
targets:
  - claude
  - copilot
---

- Do not add preamble

<!-- target:copilot -->
- Output tokens cost 4x
<!-- /target:copilot -->

<!-- target:claude -->
- Use subagents
<!-- /target:claude -->`;

    const result = parseSkill(md);
    expect(result.baseContent).toContain("Do not add preamble");
    expect(result.baseContent).not.toContain("Output tokens cost 4x");
    expect(result.targetSections).toHaveLength(2);
    expect(result.targetSections[0].target).toBe("copilot");
    expect(result.targetSections[0].content).toContain("Output tokens cost 4x");
    expect(result.targetSections[1].target).toBe("claude");
    expect(result.targetSections[1].content).toContain("Use subagents");
  });

  it("throws on invalid name", () => {
    const md = `---
name: INVALID
description: Test
category: tokens
type: instruction
auto-trigger: false
targets: [claude]
---

Test`;

    expect(() => parseSkill(md)).toThrow(/Invalid skill name/);
  });

  it("throws on missing description", () => {
    const md = `---
name: test
category: tokens
type: instruction
auto-trigger: false
targets: [claude]
---

Test`;

    expect(() => parseSkill(md)).toThrow(/requires a description/);
  });

  it("defaults auto-trigger to true", () => {
    const md = `---
name: test
description: A test
category: tokens
type: skill
targets: [claude]
---

Test`;

    const result = parseSkill(md);
    expect(result.frontmatter["auto-trigger"]).toBe(true);
  });

  it("normalizes string targets to array", () => {
    const md = `---
name: test
description: A test
category: tokens
type: instruction
auto-trigger: false
targets: claude
---

Test`;

    const result = parseSkill(md);
    expect(result.frontmatter.targets).toEqual(["claude"]);
  });

  it("defaults targets to all three tools", () => {
    const md = `---
name: test
description: A test
category: tokens
type: instruction
auto-trigger: false
---

Test`;

    const result = parseSkill(md);
    expect(result.frontmatter.targets).toEqual(["claude", "opencode", "copilot"]);
  });
});

describe("composeContent", () => {
  it("returns base content when no target sections match", () => {
    const result = composeContent(
      "Base content",
      [{ target: "copilot", content: "Copilot only" }],
      "claude"
    );
    expect(result).toBe("Base content");
  });

  it("appends matching target sections", () => {
    const result = composeContent(
      "Base content",
      [{ target: "claude", content: "Claude extra" }],
      "claude"
    );
    expect(result).toContain("Base content");
    expect(result).toContain("Claude extra");
  });

  it("only includes matching target sections", () => {
    const result = composeContent(
      "Base",
      [
        { target: "copilot", content: "Copilot" },
        { target: "claude", content: "Claude" },
      ],
      "claude"
    );
    expect(result).toContain("Claude");
    expect(result).not.toContain("Copilot");
  });
});
