import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  collectPortableSkills,
  listSkillAssets,
  validatePortableSkill,
} from "../../src/export/portable.js";
import { loadSkill } from "../../src/core/skill-loader.js";
import { type ResolvedSkill } from "../../src/core/types.js";

function makeResolved(
  overrides: Partial<ResolvedSkill["frontmatter"]> = {},
  skillDir = "/tmp/quiver-export-unit",
): ResolvedSkill {
  return {
    frontmatter: {
      name: "demo-skill",
      description: "A demo skill",
      type: "skill",
      "auto-trigger": true,
      ...overrides,
    },
    baseContent: "# Demo\n\nBody",
    source: { type: "builtin" },
    skillDir,
  };
}

describe("portable skills", () => {
  it("strips quiver-only frontmatter and preserves auto-trigger semantics", async () => {
    const prSteward = await loadSkill({ name: "pr-steward", url: "builtin" });
    const noYap = await loadSkill({ name: "no-yap", url: "builtin" });

    const selection = await collectPortableSkills([prSteward, noYap]);
    expect(selection.skills.map((skill) => skill.name)).toEqual(["pr-steward"]);
    expect(selection.excludedInstructions).toEqual(["no-yap"]);

    const content = selection.skills[0]!.content;
    expect(content).toContain("disable-model-invocation: true");
    expect(content).not.toMatch(/^type:/m);
    expect(content).not.toMatch(/^auto-trigger:/m);
    expect(selection.skills[0]!.assets).toContain("scripts/threads.sh");
  });

  it("omits disable-model-invocation for auto-triggering skills", async () => {
    const autoresearch = await loadSkill({
      name: "autoresearch",
      url: "builtin",
    });
    const selection = await collectPortableSkills([autoresearch]);
    expect(selection.skills[0]!.content).not.toContain(
      "disable-model-invocation",
    );
  });

  it("rejects invalid names and over-long descriptions", () => {
    expect(() =>
      validatePortableSkill(makeResolved({ name: "Bad_Name" })),
    ).toThrow(/name must match/);
    expect(() =>
      validatePortableSkill(makeResolved({ description: "x".repeat(1025) })),
    ).toThrow(/max 1024/);
    expect(() =>
      validatePortableSkill(makeResolved({ description: "   " })),
    ).toThrow(/description is empty/);
  });

  it("rejects duplicate skill names", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-dup-"));
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: dup\ndescription: x\n---\nbody\n",
      "utf-8",
    );
    const skill = makeResolved({ name: "dup" }, dir);
    await expect(collectPortableSkills([skill, skill])).rejects.toThrow(
      /Duplicate skill name/,
    );
    await fs.rm(dir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinks that escape the skill directory",
    async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-out-"));
      await fs.writeFile(path.join(outside, "secret.txt"), "nope", "utf-8");

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-link-"));
      await fs.writeFile(path.join(dir, "SKILL.md"), "x", "utf-8");
      await fs.symlink(outside, path.join(dir, "linked"));

      await expect(listSkillAssets(dir)).rejects.toThrow(/escapes/);

      await fs.rm(outside, { recursive: true, force: true });
      await fs.rm(dir, { recursive: true, force: true });
    },
  );
});
