import { describe, it, expect } from "vitest";
import { parseSkillUrl, formatSkillUrl } from "../../src/core/types.js";

describe("parseSkillUrl", () => {
  it("parses builtin", () => {
    const source = parseSkillUrl("builtin");
    expect(source).toEqual({ type: "builtin" });
  });

  it("parses github with just owner/repo", () => {
    const source = parseSkillUrl("github:mattpocock/skills");
    expect(source).toEqual({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "",
      ref: "main",
    });
  });

  it("parses github with path", () => {
    const source = parseSkillUrl("github:mattpocock/skills/skills/productivity/grill-me");
    expect(source).toEqual({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "main",
    });
  });

  it("parses github with path and ref", () => {
    const source = parseSkillUrl("github:mattpocock/skills/skills/productivity/grill-me@v1.0");
    expect(source).toEqual({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "v1.0",
    });
  });

  it("parses github with ref but no path", () => {
    const source = parseSkillUrl("github:owner/repo@v2");
    expect(source).toEqual({
      type: "github",
      owner: "owner",
      repo: "repo",
      path: "",
      ref: "v2",
    });
  });

  it("throws on invalid url", () => {
    expect(() => parseSkillUrl("npm:some-package")).toThrow(/Invalid skill URL/);
    expect(() => parseSkillUrl("")).toThrow(/Invalid skill URL/);
  });
});

describe("formatSkillUrl", () => {
  it("formats builtin", () => {
    expect(formatSkillUrl({ type: "builtin" })).toBe("builtin");
  });

  it("formats github without path or ref", () => {
    expect(formatSkillUrl({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "",
      ref: "main",
    })).toBe("github:mattpocock/skills");
  });

  it("formats github with path", () => {
    expect(formatSkillUrl({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "main",
    })).toBe("github:mattpocock/skills/skills/productivity/grill-me");
  });

  it("formats github with non-main ref", () => {
    expect(formatSkillUrl({
      type: "github",
      owner: "mattpocock",
      repo: "skills",
      path: "skills/productivity/grill-me",
      ref: "v1.0",
    })).toBe("github:mattpocock/skills/skills/productivity/grill-me@v1.0");
  });

  it("roundtrips through parse and format", () => {
    const urls = [
      "builtin",
      "github:mattpocock/skills/skills/productivity/grill-me",
      "github:owner/repo@v2",
    ];
    for (const url of urls) {
      expect(formatSkillUrl(parseSkillUrl(url))).toBe(url);
    }
  });
});
