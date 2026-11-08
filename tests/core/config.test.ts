import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addSkillToConfig,
  removeSkillFromConfig,
  globalConfigDir,
  globalCachePath,
  ensureGlobalConfig,
} from "../../src/core/config.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("config", () => {
  it("adds and removes skills", () => {
    const base = {
      $schema: "https://quiver.ai/config.json",
      skills: [{ name: "no-yap", url: "builtin" }],
    };

    const withNew = addSkillToConfig(base, {
      name: "grill-me",
      url: "github:mattpocock/skills/skills/productivity/grill-me",
    });
    assert.strictEqual(withNew.skills.length, 2);
    assert.strictEqual(withNew.skills[1].name, "grill-me");
    assert.strictEqual(
      withNew.skills[1].url,
      "github:mattpocock/skills/skills/productivity/grill-me",
    );

    const without = removeSkillFromConfig(withNew, "no-yap");
    assert.strictEqual(without.skills.length, 1);
    assert.strictEqual(without.skills[0].name, "grill-me");
  });

  it("does not duplicate skills", () => {
    const base = {
      $schema: "https://quiver.ai/config.json",
      skills: [{ name: "no-yap", url: "builtin" }],
    };

    const result = addSkillToConfig(base, { name: "no-yap", url: "builtin" });
    assert.strictEqual(result.skills.length, 1);
  });

  it("globalConfigDir returns ~/.quiver", () => {
    assert.strictEqual(globalConfigDir(), path.resolve(os.homedir(), ".quiver"));
  });

  it("globalCachePath returns ~/.quiver/cache", () => {
    assert.strictEqual(
      globalCachePath(),
      path.resolve(os.homedir(), ".quiver", "cache"),
    );
  });

  it("ensureGlobalConfig creates config if missing", async () => {
    const tmpDir = await fs.mkdtemp("/tmp/quiver-test-");
    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;

    try {
      const config = await ensureGlobalConfig([
        { name: "no-yap", url: "builtin" },
      ]);
      assert.deepStrictEqual(config.skills, [{ name: "no-yap", url: "builtin" }]);

      const raw = await fs.readFile(
        path.resolve(tmpDir, ".quiver", "quiver.json"),
        "utf-8",
      );
      assert.deepStrictEqual(JSON.parse(raw).skills, [
        { name: "no-yap", url: "builtin" },
      ]);

      const existing = await ensureGlobalConfig([]);
      assert.deepStrictEqual(existing.skills, [{ name: "no-yap", url: "builtin" }]);
    } finally {
      process.env.HOME = origHome;
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
