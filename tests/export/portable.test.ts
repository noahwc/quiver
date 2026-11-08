import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  collectPortableSkills,
  listSkillAssets,
  validatePortableSkill,
} from "../../src/export/portable.ts";
import { loadSkill } from "../../src/core/skill-loader.ts";
import { type ResolvedSkill } from "../../src/core/types.ts";

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
    assert.deepStrictEqual(
      selection.skills.map((skill) => skill.name),
      ["pr-steward"],
    );
    assert.deepStrictEqual(selection.excludedInstructions, ["no-yap"]);

    const content = selection.skills[0]!.content;
    assert.ok(content.includes("disable-model-invocation: true"));
    assert.doesNotMatch(content, /^type:/m);
    assert.doesNotMatch(content, /^auto-trigger:/m);
    assert.ok(selection.skills[0]!.assets.includes("scripts/threads.sh"));
  });

  it("omits disable-model-invocation for auto-triggering skills", async () => {
    const autoresearch = await loadSkill({
      name: "autoresearch",
      url: "builtin",
    });
    const selection = await collectPortableSkills([autoresearch]);
    assert.strictEqual(
      selection.skills[0]!.content.includes("disable-model-invocation"),
      false,
    );
  });

  it("rejects invalid names and over-long descriptions", () => {
    assert.throws(
      () => validatePortableSkill(makeResolved({ name: "Bad_Name" })),
      /name must match/,
    );
    assert.throws(
      () => validatePortableSkill(makeResolved({ description: "x".repeat(1025) })),
      /max 1024/,
    );
    assert.throws(
      () => validatePortableSkill(makeResolved({ description: "   " })),
      /description is empty/,
    );
  });

  it("rejects duplicate skill names", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-dup-"));
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: dup\ndescription: x\n---\nbody\n",
      "utf-8",
    );
    const skill = makeResolved({ name: "dup" }, dir);
    await assert.rejects(
      collectPortableSkills([skill, skill]),
      /Duplicate skill name/,
    );
    await fs.rm(dir, { recursive: true, force: true });
  });

  it(
    "rejects symlinks that escape the skill directory",
    { skip: process.platform === "win32" },
    async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-out-"));
      await fs.writeFile(path.join(outside, "secret.txt"), "nope", "utf-8");

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-link-"));
      await fs.writeFile(path.join(dir, "SKILL.md"), "x", "utf-8");
      await fs.symlink(outside, path.join(dir, "linked"));

      await assert.rejects(listSkillAssets(dir), /escapes/);

      await fs.rm(outside, { recursive: true, force: true });
      await fs.rm(dir, { recursive: true, force: true });
    },
  );
});
