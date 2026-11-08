import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  wrapInSectionMarker,
  findMarkedSections,
  removeMarkedSection,
  replaceMarkedSection,
  appendSection,
} from "../../src/transpiler/section-marker.ts";

describe("wrapInSectionMarker", () => {
  it("wraps content in markers", () => {
    const result = wrapInSectionMarker("no-yap", "- Be concise");
    assert.ok(result.includes("<!-- quiver:start:no-yap -->"));
    assert.ok(result.includes("<!-- quiver:end:no-yap -->"));
    assert.ok(result.includes("- Be concise"));
  });
});

describe("findMarkedSections", () => {
  it("finds a single marked section", () => {
    const content = `# My File

<!-- quiver:start:no-yap -->
- Be concise
<!-- quiver:end:no-yap -->

Some other content`;

    const sections = findMarkedSections(content);
    assert.strictEqual(sections.size, 1);
    assert.ok(sections.get("no-yap")!.includes("Be concise"));
  });

  it("finds multiple sections", () => {
    const content = `<!-- quiver:start:no-yap -->
- Be concise
<!-- quiver:end:no-yap -->

<!-- quiver:start:conventions -->
- Use const
<!-- quiver:end:conventions -->`;

    const sections = findMarkedSections(content);
    assert.strictEqual(sections.size, 2);
    assert.strictEqual(sections.has("no-yap"), true);
    assert.strictEqual(sections.has("conventions"), true);
  });

  it("returns empty map when no sections found", () => {
    const sections = findMarkedSections("No markers here");
    assert.strictEqual(sections.size, 0);
  });
});

describe("removeMarkedSection", () => {
  it("removes a marked section", () => {
    const content = `# Title

<!-- quiver:start:no-yap -->
- Be concise
<!-- quiver:end:no-yap -->

Other content`;

    const result = removeMarkedSection(content, "no-yap");
    assert.ok(!result.includes("quiver:start:no-yap"));
    assert.ok(!result.includes("Be concise"));
    assert.ok(result.includes("Other content"));
    assert.ok(result.includes("# Title"));
  });

  it("returns unchanged content when section not found", () => {
    const content = "# Title\n\nSome content";
    const result = removeMarkedSection(content, "no-yap");
    assert.strictEqual(result, content);
  });
});

describe("replaceMarkedSection", () => {
  it("replaces an existing section", () => {
    const content = `# Title

<!-- quiver:start:no-yap -->
- Old content
<!-- quiver:end:no-yap -->`;

    const result = replaceMarkedSection(content, "no-yap", "- New content");
    assert.ok(!result.includes("Old content"));
    assert.ok(result.includes("New content"));
  });

  it("appends when section does not exist", () => {
    const content = "# Title\n\nExisting";
    const result = replaceMarkedSection(content, "no-yap", "- Be concise");
    assert.ok(result.includes("Existing"));
    assert.ok(result.includes("Be concise"));
  });
});

describe("appendSection", () => {
  it("appends to non-empty content", () => {
    const result = appendSection(
      "# Title",
      "<!-- quiver:start:x -->\nY\n<!-- quiver:end:x -->",
    );
    assert.ok(result.includes("# Title"));
    assert.ok(result.includes("Y"));
  });

  it("returns just the section for empty content", () => {
    const result = appendSection(
      "",
      "<!-- quiver:start:x -->\nY\n<!-- quiver:end:x -->",
    );
    assert.ok(result.includes("Y"));
    assert.ok(!result.includes("#"));
  });
});
