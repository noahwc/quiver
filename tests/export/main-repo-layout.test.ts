import { describe, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkills } from "../../src/core/skill-discovery.js";
import { loadAllSkills } from "../../src/core/skill-loader.js";
import { collectPortableSkills } from "../../src/export/portable.js";
import { buildPluginRepo, writePluginRepo } from "../../src/export/plugin.js";
import { readPluginMeta } from "../../src/export/meta.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function readTree(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  async function walk(dir: string, prefix: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else {
        files.set(rel, await fs.readFile(full));
      }
    }
  }
  await walk(root, "");
  return files;
}

async function generateSubtree(): Promise<Map<string, Buffer>> {
  const discovered = await discoverAllSkills();
  const builtins = discovered
    .filter((skill) => skill.url === "builtin")
    .map((skill) => ({ name: skill.name, url: "builtin" }));
  const selection = await collectPortableSkills(await loadAllSkills(builtins));
  const meta = await readPluginMeta();
  const files = buildPluginRepo(selection, {
    meta,
    repo: "noahwc/quiver",
    subtree: true,
  });

  const out = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-subtree-"));
  await writePluginRepo(files, out);
  const tree = await readTree(out);
  await fs.rm(out, { recursive: true, force: true });
  return tree;
}

describe("main-repo plugin layout", () => {
  it("keeps the committed plugin/ subtree in sync with the built-in skills", async () => {
    const generated = await generateSubtree();
    const committed = await readTree(path.join(repoRoot, "plugin"));

    expect(
      [...committed.keys()].sort(),
      "plugin/ is stale; run `npm run plugin:sync`",
    ).toEqual([...generated.keys()].sort());

    for (const [file, content] of generated) {
      expect(
        committed.get(file)?.equals(content),
        `plugin/${file} is stale; run \`npm run plugin:sync\``,
      ).toBe(true);
    }
  });

  it("exposes plugin/ through the repo-root catalog", async () => {
    const catalog = JSON.parse(
      await fs.readFile(
        path.join(repoRoot, ".claude-plugin", "marketplace.json"),
        "utf-8",
      ),
    );
    expect(catalog.name).toBe("quiver");
    expect(catalog.owner.name).toBeTruthy();
    expect(catalog.plugins).toHaveLength(1);
    expect(catalog.plugins[0]).toMatchObject({
      name: "quiver",
      source: "./plugin",
    });

    const manifest = JSON.parse(
      await fs.readFile(path.join(repoRoot, "plugin", "plugin.json"), "utf-8"),
    );
    expect(manifest.$schema).toBe(
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    );
    expect(manifest.name).toBe("quiver");

    const skillDirs = (
      await fs.readdir(path.join(repoRoot, "plugin", "skills"), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(skillDirs).toContain("autoresearch");
    expect(skillDirs).not.toContain("no-yap");
  });

  it("does not emit full-repo packaging files in subtree mode", async () => {
    const generated = await generateSubtree();
    expect(generated.has(".claude-plugin/marketplace.json")).toBe(false);
    expect(generated.has("package.json")).toBe(false);
    expect(generated.has("README.md")).toBe(false);
    expect(generated.has("plugin.json")).toBe(true);
    expect(generated.has("skills/autoresearch/SKILL.md")).toBe(true);
  });
});
