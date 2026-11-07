import { describe, it, expect } from "vitest";
import {
  discoverAllSkills,
  getInstalledSkillNames,
  getUninstalledSkills,
  toConfigSkill,
} from "../../src/core/skill-discovery.js";

describe("skill-discovery", () => {
  it("discovers builtin skills from filesystem", async () => {
    const skills = await discoverAllSkills();
    const builtin = skills.filter((s) => s.url === "builtin");
    expect(builtin.length).toBeGreaterThanOrEqual(3);
    const names = builtin.map((s) => s.name);
    expect(names).toContain("no-yap");
    expect(names).toContain("concise-responses");
    expect(names).toContain("project-conventions");
  });

  it("discovers third-party skills from registry.json", async () => {
    const skills = await discoverAllSkills();
    const thirdParty = skills.filter((s) => s.url !== "builtin");
    expect(thirdParty.length).toBeGreaterThanOrEqual(2);
    const names = thirdParty.map((s) => s.name);
    expect(names).toContain("grill-me");
    expect(names).toContain("grill-with-docs");
  });

  it("discovers skill dependencies declared in registry.json", async () => {
    const skills = await discoverAllSkills();
    expect(skills.find((s) => s.name === "grill-me")?.requires).toContain(
      "grilling",
    );
    expect(skills.find((s) => s.name === "grilling")).toBeDefined();
  });

  it("discovers all skills combined", async () => {
    const skills = await discoverAllSkills();
    expect(skills.length).toBeGreaterThanOrEqual(5);
  });

  it("each builtin skill has correct metadata", async () => {
    const skills = await discoverAllSkills();
    const builtin = skills.filter((s) => s.url === "builtin");
    for (const skill of builtin) {
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.url).toBe("builtin");
      expect(["instruction", "skill"]).toContain(skill.type);
    }
  });

  it("each third-party skill has a github url", async () => {
    const skills = await discoverAllSkills();
    const thirdParty = skills.filter((s) => s.url !== "builtin");
    for (const skill of thirdParty) {
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.url).toMatch(/^github:/);
    }
  });

  it("tracks installed skill names", () => {
    const installed = getInstalledSkillNames([
      { name: "no-yap", url: "builtin" },
    ]);
    expect(installed.has("no-yap")).toBe(true);
    expect(installed.has("grill-me")).toBe(false);
  });

  it("filters uninstalled skills", async () => {
    const all = await discoverAllSkills();
    const installed = new Set(["no-yap"]);
    const uninstalled = getUninstalledSkills(all, installed);
    expect(uninstalled.some((s) => s.name === "no-yap")).toBe(false);
    expect(uninstalled.length).toBeLessThan(all.length);
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
    expect(config).toEqual({ name: "no-yap", url: "builtin" });
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
    expect(config).toEqual({
      name: "grill-me",
      url: "github:mattpocock/skills/skills/productivity/grill-me",
    });
  });
});

