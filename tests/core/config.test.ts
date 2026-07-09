import { describe, it, expect } from "vitest";
import {
  readConfig,
  addSkillToConfig,
  removeSkillFromConfig,
  globalConfigDir,
  globalCachePath,
  ensureGlobalConfig,
} from "../../src/core/config.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("config", () => {
  it("adds and removes skills", () => {
    const base = {
      $schema: "https://quiver.ai/config.json",
      tools: ["claude" as const],
      skills: [{ name: "no-yap", url: "builtin" }],
    };

    const withNew = addSkillToConfig(base, {
      name: "grill-me",
      url: "github:mattpocock/skills/skills/productivity/grill-me",
    });
    expect(withNew.skills).toHaveLength(2);
    expect(withNew.skills[1].name).toBe("grill-me");
    expect(withNew.skills[1].url).toBe("github:mattpocock/skills/skills/productivity/grill-me");

    const without = removeSkillFromConfig(withNew, "no-yap");
    expect(without.skills).toHaveLength(1);
    expect(without.skills[0].name).toBe("grill-me");
  });

  it("does not duplicate skills", () => {
    const base = {
      $schema: "https://quiver.ai/config.json",
      tools: ["claude" as const],
      skills: [{ name: "no-yap", url: "builtin" }],
    };

    const result = addSkillToConfig(base, { name: "no-yap", url: "builtin" });
    expect(result.skills).toHaveLength(1);
  });

  it("globalConfigDir returns ~/.quiver", () => {
    expect(globalConfigDir()).toBe(path.resolve(os.homedir(), ".quiver"));
  });

  it("globalCachePath returns ~/.quiver/cache", () => {
    expect(globalCachePath()).toBe(path.resolve(os.homedir(), ".quiver", "cache"));
  });

  it("ensureGlobalConfig creates config if missing", async () => {
    const tmpDir = await fs.mkdtemp("/tmp/quiver-test-");
    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;

    try {
      const config = await ensureGlobalConfig(["claude" as const], []);
      expect(config.tools).toEqual(["claude"]);
      expect(config.skills).toEqual([]);

      const raw = await fs.readFile(path.resolve(tmpDir, ".quiver", "quiver.json"), "utf-8");
      expect(JSON.parse(raw).tools).toEqual(["claude"]);

      const existing = await ensureGlobalConfig(["opencode" as const], []);
      expect(existing.tools).toEqual(["claude"]);
    } finally {
      process.env.HOME = origHome;
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
