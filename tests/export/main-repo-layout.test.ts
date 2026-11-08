import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAllSkills } from "../../src/core/skill-discovery.ts";
import { loadAllSkills } from "../../src/core/skill-loader.ts";
import { collectPortableSkills } from "../../src/export/portable.ts";
import { buildPluginRepo, writePluginRepo } from "../../src/export/plugin.ts";
import { readPluginMeta } from "../../src/export/meta.ts";

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

    assert.deepStrictEqual(
      [...committed.keys()].sort(),
      [...generated.keys()].sort(),
      "plugin/ is stale; run `npm run plugin:sync`",
    );

    for (const [file, content] of generated) {
      assert.ok(
        committed.get(file)?.equals(content),
        `plugin/${file} is stale; run \`npm run plugin:sync\``,
      );
    }
  });

  it("exposes plugin/ through the repo-root catalog", async () => {
    const catalog = JSON.parse(
      await fs.readFile(
        path.join(repoRoot, ".claude-plugin", "marketplace.json"),
        "utf-8",
      ),
    );
    assert.strictEqual(catalog.name, "quiver");
    assert.ok(catalog.owner.name);
    assert.strictEqual(catalog.plugins.length, 1);
    assert.partialDeepStrictEqual(catalog.plugins[0], {
      name: "quiver",
      source: "./plugin",
    });

    const manifest = JSON.parse(
      await fs.readFile(path.join(repoRoot, "plugin", "plugin.json"), "utf-8"),
    );
    assert.strictEqual(
      manifest.$schema,
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    );
    assert.strictEqual(manifest.name, "quiver");

    const skillDirs = (
      await fs.readdir(path.join(repoRoot, "plugin", "skills"), {
        withFileTypes: true,
      })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.ok(skillDirs.includes("autoresearch"));
    assert.ok(!skillDirs.includes("no-yap"));
  });

  it("does not emit full-repo packaging files in subtree mode", async () => {
    const generated = await generateSubtree();
    assert.strictEqual(generated.has(".claude-plugin/marketplace.json"), false);
    assert.strictEqual(generated.has("package.json"), false);
    assert.strictEqual(generated.has("README.md"), false);
    assert.strictEqual(generated.has("plugin.json"), true);
    assert.strictEqual(generated.has("skills/autoresearch/SKILL.md"), true);
  });
});
