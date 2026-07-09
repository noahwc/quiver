import { describe, it, expect } from "vitest";
import { loadAllSkills } from "../../src/core/skill-loader.js";

describe("skill-loader", () => {
  it("loads builtin skills", async () => {
    const skills = await loadAllSkills([
      { name: "no-yap", url: "builtin" },
    ]);
    expect(skills).toHaveLength(1);
    expect(skills[0].frontmatter.name).toBe("no-yap");
    expect(skills[0].frontmatter.type).toBe("instruction");
  });

  it("loads multiple builtin skills", async () => {
    const skills = await loadAllSkills([
      { name: "no-yap", url: "builtin" },
      { name: "concise-responses", url: "builtin" },
      { name: "project-conventions", url: "builtin" },
    ]);
    expect(skills).toHaveLength(3);
    expect(skills.map((s) => s.frontmatter.name)).toEqual([
      "no-yap",
      "concise-responses",
      "project-conventions",
    ]);
  });
});
