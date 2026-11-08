import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { isWithin, safeCacheName, safeJoin } from "../../src/core/paths.ts";

const root = path.join(path.sep, "tmp", "quiver-root");

describe("isWithin", () => {
  it("accepts the root and descendants", () => {
    assert.strictEqual(isWithin(root, root), true);
    assert.strictEqual(isWithin(root, path.join(root, "a", "b")), true);
  });

  it("rejects siblings with a shared prefix", () => {
    assert.strictEqual(isWithin(root, `${root}-other`), false);
  });

  it("rejects parent and absolute paths", () => {
    assert.strictEqual(isWithin(root, path.join(root, "..", "other")), false);
    assert.strictEqual(isWithin(root, path.join(path.sep, "etc", "passwd")), false);
  });
});

describe("safeJoin", () => {
  it("resolves nested relative paths", () => {
    assert.strictEqual(
      safeJoin(root, path.join("skills", "SKILL.md")),
      path.join(root, "skills", "SKILL.md"),
    );
  });

  it("rejects traversal, absolute paths, and empty paths", () => {
    for (const relative of [
      "..",
      path.join("..", "outside"),
      path.join("a", "..", "..", "outside"),
      path.join(path.sep, "etc", "passwd"),
      "",
      ".",
    ]) {
      assert.throws(() => safeJoin(root, relative), /Invalid|outside/, relative);
    }
  });

  it("rejects null bytes", () => {
    assert.throws(() => safeJoin(root, "a\0b"), /Invalid/);
  });
});

describe("safeCacheName", () => {
  it("accepts a single directory name", () => {
    assert.strictEqual(safeCacheName("my-skill"), "my-skill");
  });

  it("rejects traversal and path separators", () => {
    for (const name of [
      "",
      ".",
      "..",
      "a/b",
      "a\\b",
      path.join(path.sep, "tmp"),
      "C:drive",
    ]) {
      assert.throws(() => safeCacheName(name), /Invalid skill cache name/, name);
    }
  });
});
