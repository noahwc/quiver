import { describe, it, expect } from "vitest";
import {
  wrapInSectionMarker,
  findMarkedSections,
  removeMarkedSection,
  replaceMarkedSection,
  appendSection,
} from "../../src/transpiler/section-marker.js";

describe("wrapInSectionMarker", () => {
  it("wraps content in markers", () => {
    const result = wrapInSectionMarker("no-yap", "- Be concise");
    expect(result).toContain("<!-- quiver:start:no-yap -->");
    expect(result).toContain("<!-- quiver:end:no-yap -->");
    expect(result).toContain("- Be concise");
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
    expect(sections.size).toBe(1);
    expect(sections.get("no-yap")).toContain("Be concise");
  });

  it("finds multiple sections", () => {
    const content = `<!-- quiver:start:no-yap -->
- Be concise
<!-- quiver:end:no-yap -->

<!-- quiver:start:conventions -->
- Use const
<!-- quiver:end:conventions -->`;

    const sections = findMarkedSections(content);
    expect(sections.size).toBe(2);
    expect(sections.has("no-yap")).toBe(true);
    expect(sections.has("conventions")).toBe(true);
  });

  it("returns empty map when no sections found", () => {
    const sections = findMarkedSections("No markers here");
    expect(sections.size).toBe(0);
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
    expect(result).not.toContain("quiver:start:no-yap");
    expect(result).not.toContain("Be concise");
    expect(result).toContain("Other content");
    expect(result).toContain("# Title");
  });

  it("returns unchanged content when section not found", () => {
    const content = "# Title\n\nSome content";
    const result = removeMarkedSection(content, "no-yap");
    expect(result).toBe(content);
  });
});

describe("replaceMarkedSection", () => {
  it("replaces an existing section", () => {
    const content = `# Title

<!-- quiver:start:no-yap -->
- Old content
<!-- quiver:end:no-yap -->`;

    const result = replaceMarkedSection(content, "no-yap", "- New content");
    expect(result).not.toContain("Old content");
    expect(result).toContain("New content");
  });

  it("appends when section does not exist", () => {
    const content = "# Title\n\nExisting";
    const result = replaceMarkedSection(content, "no-yap", "- Be concise");
    expect(result).toContain("Existing");
    expect(result).toContain("Be concise");
  });
});

describe("appendSection", () => {
  it("appends to non-empty content", () => {
    const result = appendSection("# Title", "<!-- quiver:start:x -->\nY\n<!-- quiver:end:x -->");
    expect(result).toContain("# Title");
    expect(result).toContain("Y");
  });

  it("returns just the section for empty content", () => {
    const result = appendSection("", "<!-- quiver:start:x -->\nY\n<!-- quiver:end:x -->");
    expect(result).toContain("Y");
    expect(result).not.toContain("#");
  });
});
