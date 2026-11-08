import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAllSkills } from "../../src/core/skill-loader.ts";

describe("skill-loader", () => {
  it("loads builtin skills", async () => {
    const skills = await loadAllSkills([
      { name: "no-yap", url: "builtin" },
    ]);
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0].frontmatter.name, "no-yap");
    assert.strictEqual(skills[0].frontmatter.type, "instruction");
  });

  it("loads multiple builtin skills", async () => {
    const skills = await loadAllSkills([
      { name: "no-yap", url: "builtin" },
      { name: "concise-responses", url: "builtin" },
      { name: "project-conventions", url: "builtin" },
    ]);
    assert.strictEqual(skills.length, 3);
    assert.deepStrictEqual(
      skills.map((s) => s.frontmatter.name),
      ["no-yap", "concise-responses", "project-conventions"],
    );
  });
});
