import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  discoverAllSkills,
  getInstalledSkillNames,
  getUninstalledSkills,
  toConfigSkill,
} from "../../src/core/skill-discovery.ts";

describe("skill-discovery", () => {
  it("discovers builtin skills from filesystem", async () => {
    const skills = await discoverAllSkills();
    const builtin = skills.filter((s) => s.url === "builtin");
    assert.ok(builtin.length >= 3);
    const names = builtin.map((s) => s.name);
    assert.ok(names.includes("no-yap"));
    assert.ok(names.includes("concise-responses"));
    assert.ok(names.includes("project-conventions"));
  });

  it("discovers third-party skills from registry.json", async () => {
    const skills = await discoverAllSkills();
    const thirdParty = skills.filter((s) => s.url !== "builtin");
    assert.ok(thirdParty.length >= 2);
    const names = thirdParty.map((s) => s.name);
    assert.ok(names.includes("grill-me"));
    assert.ok(names.includes("grill-with-docs"));
  });

  it("discovers skill dependencies declared in registry.json", async () => {
    const skills = await discoverAllSkills();
    assert.ok(skills.find((s) => s.name === "grill-me")?.requires?.includes("grilling"));
    assert.notStrictEqual(skills.find((s) => s.name === "grilling"), undefined);
  });

  it("discovers all skills combined", async () => {
    const skills = await discoverAllSkills();
    assert.ok(skills.length >= 5);
  });

  it("each builtin skill has correct metadata", async () => {
    const skills = await discoverAllSkills();
    const builtin = skills.filter((s) => s.url === "builtin");
    for (const skill of builtin) {
      assert.ok(skill.name);
      assert.ok(skill.description);
      assert.strictEqual(skill.url, "builtin");
      assert.ok(["instruction", "skill"].includes(skill.type));
    }
  });

  it("each third-party skill has a github url", async () => {
    const skills = await discoverAllSkills();
    const thirdParty = skills.filter((s) => s.url !== "builtin");
    for (const skill of thirdParty) {
      assert.ok(skill.name);
      assert.ok(skill.description);
      assert.match(skill.url, /^github:/);
    }
  });

  it("tracks installed skill names", () => {
    const installed = getInstalledSkillNames([
      { name: "no-yap", url: "builtin" },
    ]);
    assert.strictEqual(installed.has("no-yap"), true);
    assert.strictEqual(installed.has("grill-me"), false);
  });

  it("filters uninstalled skills", async () => {
    const all = await discoverAllSkills();
    const installed = new Set(["no-yap"]);
    const uninstalled = getUninstalledSkills(all, installed);
    assert.strictEqual(uninstalled.some((s) => s.name === "no-yap"), false);
    assert.ok(uninstalled.length < all.length);
  });

  it("converts builtin skill to config skill", () => {
    const skill = {
      name: "no-yap",
      description: "test",
      type: "instruction" as const,
      "auto-trigger": false,
      url: "builtin",
    };
    const config = toConfigSkill(skill);
    assert.deepStrictEqual(config, { name: "no-yap", url: "builtin" });
  });

  it("converts github skill to config skill", () => {
    const skill = {
      name: "grill-me",
      description: "test",
      type: "skill" as const,
      "auto-trigger": false,
      url: "github:mattpocock/skills/skills/productivity/grill-me",
    };
    const config = toConfigSkill(skill);
    assert.deepStrictEqual(config, {
      name: "grill-me",
      url: "github:mattpocock/skills/skills/productivity/grill-me",
    });
  });
});
