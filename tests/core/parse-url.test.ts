import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSkillUrl } from "../../src/core/types.ts";

describe("parseSkillUrl", () => {
  it("parses builtin", () => {
    const source = parseSkillUrl("builtin");
    assert.deepStrictEqual(source, { type: "builtin" });
  });

  it("parses github with just owner/repo", () => {
    const source = parseSkillUrl("github:mattpocock/skills");
    assert.deepStrictEqual(source, {
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "",
      ref: "main",
    });
  });

  it("parses github with path", () => {
    const source = parseSkillUrl(
      "github:mattpocock/skills/skills/productivity/grill-me",
    );
    assert.deepStrictEqual(source, {
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "main",
    });
  });

  it("parses github with path and ref", () => {
    const source = parseSkillUrl(
      "github:mattpocock/skills/skills/productivity/grill-me@v1.0",
    );
    assert.deepStrictEqual(source, {
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "v1.0",
    });
  });

  it("parses github with ref but no path", () => {
    const source = parseSkillUrl("github:owner/repo@v2");
    assert.deepStrictEqual(source, {
      type: "github",
      owner: "owner",
      repo: "repo",
      path: "",
      ref: "v2",
    });
  });

  it("throws on invalid url", () => {
    assert.throws(() => parseSkillUrl("npm:some-package"), /Invalid skill URL/);
    assert.throws(() => parseSkillUrl(""), /Invalid skill URL/);
  });
});
