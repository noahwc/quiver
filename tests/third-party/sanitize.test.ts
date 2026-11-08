import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFrontmatter } from "../../src/third-party/github.ts";

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

    assert.ok(
      result.includes('description: "This is a multi-line folded description."'),
    );
    assert.ok(!result.includes("description: >"));
    assert.ok(result.includes("# Body content"));
  });

  it("quotes plain string descriptions that contain colons", () => {
    const input = `---
name: my-skill
description: "Use when: presenting findings"
type: skill
---

Body`;

    const result = sanitizeFrontmatter(input);
    assert.ok(
      result.includes('description: "Use when: presenting findings"'),
    );
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
    assert.ok(result.includes("auto-trigger: true"));
    assert.ok(!result.includes('auto-trigger: "true"'));
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
    assert.ok(result.includes('description: "Do \\"this\\" and \\"that\\".'));
  });

  it("returns the original markdown when there is no frontmatter", () => {
    const input = "# Just a heading\n\nSome content.";
    assert.strictEqual(sanitizeFrontmatter(input), input);
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
    assert.ok(result.includes("## Section 1"));
    assert.ok(result.includes("- bullet one"));
    assert.ok(result.includes("- bullet two"));
  });
});
