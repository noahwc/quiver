import { describe, it, expect } from "vitest";
import { sanitizeFrontmatter } from "../../src/third-party/github.js";

describe("sanitizeFrontmatter", () => {
  it("flattens a folded scalar description into a quoted string", () => {
    const input = `---
name: test-skill
description: >
  This is a multi-line
  folded description.
type: skill
auto-trigger: true
---

# Body content`;

    const result = sanitizeFrontmatter(input);

    expect(result).toContain('description: "This is a multi-line folded description.\n"');
    expect(result).not.toContain("description: >");
    expect(result).toContain("# Body content");
  });

  it("quotes plain string descriptions that contain colons", () => {
    const input = `---
name: my-skill
description: "Use when: presenting findings"
type: skill
---

Body`;

    const result = sanitizeFrontmatter(input);
    expect(result).toContain('description: "Use when: presenting findings"');
  });

  it("preserves boolean and number values unquoted", () => {
    const input = `---
name: my-skill
description: A test
type: skill
auto-trigger: true
---

Body`;

    const result = sanitizeFrontmatter(input);
    expect(result).toContain("auto-trigger: true");
    expect(result).not.toContain('auto-trigger: "true"');
  });

  it("escapes double quotes inside description values", () => {
    const input = `---
name: my-skill
description: >
  Do "this" and "that".
type: skill
---

Body`;

    const result = sanitizeFrontmatter(input);
    expect(result).toContain('description: "Do \\"this\\" and \\"that\\".');
  });

  it("returns the original markdown when there is no frontmatter", () => {
    const input = "# Just a heading\n\nSome content.";
    expect(sanitizeFrontmatter(input)).toBe(input);
  });

  it("preserves body content after sanitization", () => {
    const input = `---
name: my-skill
description: >
  Multi-line
  description here.
type: skill
---

## Section 1

- bullet one
- bullet two`;

    const result = sanitizeFrontmatter(input);
    expect(result).toContain("## Section 1");
    expect(result).toContain("- bullet one");
    expect(result).toContain("- bullet two");
  });
});
