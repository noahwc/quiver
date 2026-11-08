import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildPluginRepo,
  writePluginRepo,
  type PluginMeta,
} from "../../src/export/plugin.ts";
import { parseFrontmatter } from "../../src/core/frontmatter.ts";
import { collectPortableSkills } from "../../src/export/portable.ts";
import { discoverAllSkills } from "../../src/core/skill-discovery.ts";
import { loadSkill } from "../../src/core/skill-loader.ts";
import { type ResolvedSkill } from "../../src/core/types.ts";
import { exportCommand } from "../../src/cli/export.ts";

const meta: PluginMeta = {
  version: "9.9.9",
  description: "Test plugin",
  license: "MIT",
  homepage: "https://example.com/quiver",
  repository: "https://example.com/quiver",
  author: { name: "Test Author", url: "https://example.com" },
};

async function builtinSelection() {
  const discovered = await discoverAllSkills();
  const builtins = discovered.filter((skill) => skill.url === "builtin");
  const resolved: ResolvedSkill[] = [];
  for (const skill of builtins) {
    resolved.push(await loadSkill({ name: skill.name, url: "builtin" }));
  }
  return collectPortableSkills(resolved);
}

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

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

describe("buildPluginRepo", () => {
  it("generates a valid Agent Plugins package, marketplace, and pi package", async () => {
    const out = await tempDir("quiver-plugin-");
    const selection = await builtinSelection();
    const files = buildPluginRepo(selection, {
      meta,
      repo: "acme/quiver-plugin",
    });
    await writePluginRepo(files, out);

    const manifest = JSON.parse(
      await fs.readFile(
        path.join(out, "plugin.json"),
        "utf-8",
      ),
    );
    assert.strictEqual(
      manifest.$schema,
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    );
    assert.strictEqual(manifest.name, "quiver");
    assert.strictEqual(manifest.version, "9.9.9");
    assert.deepStrictEqual(manifest.author, meta.author);
    assert.strictEqual(manifest.license, "MIT");
    assert.deepStrictEqual(Object.keys(manifest).sort(), [
      "$schema",
      "author",
      "description",
      "homepage",
      "keywords",
      "license",
      "name",
      "repository",
      "version",
    ]);

    // The repo root is the plugin, so VS Code "Install Plugin from Source" and
    // marketplace installs resolve to the same directory.
    await fs.access(path.join(out, "plugin.json"));
    await fs.access(path.join(out, "skills"));
    await assert.rejects(fs.access(path.join(out, "plugins")));

    const marketplace = JSON.parse(
      await fs.readFile(
        path.join(out, ".claude-plugin", "marketplace.json"),
        "utf-8",
      ),
    );
    assert.strictEqual(marketplace.name, "quiver");
    assert.strictEqual(marketplace.owner.name, "Test Author");
    // VS Code/Copilot plugin-source contract:
    // - `.claude-plugin/marketplace.json` is one of the recognized catalog paths
    // - a single entry means "add as source" installs it directly
    // - source "." resolves to the repository root
    // - root plugin.json carries the Agent Plugins $schema, selecting the
    //   AgentPlugin adapter over the legacy Copilot/Claude formats
    assert.strictEqual(marketplace.plugins.length, 1);
    assert.strictEqual(marketplace.plugins[0].source, ".");
    assert.strictEqual(marketplace.plugins[0].name, "quiver");
    assert.strictEqual(marketplace.plugins[0].version, "9.9.9");
    assert.strictEqual(manifest.$schema.startsWith("https://agent-plugins.org/"), true);

    const piPackage = JSON.parse(
      await fs.readFile(path.join(out, "package.json"), "utf-8"),
    );
    assert.ok(piPackage.keywords.includes("pi-package"));
    assert.deepStrictEqual(piPackage.pi.skills, ["./skills"]);

    const skillsDir = path.join(out, "skills");
    const skillNames = (await fs.readdir(skillsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const expectedSkillNames = (await discoverAllSkills())
      .filter((skill) => skill.url === "builtin" && skill.type === "skill")
      .map((skill) => skill.name)
      .sort();
    assert.deepStrictEqual(skillNames, expectedSkillNames);
    assert.ok(skillNames.includes("pr-steward"));
    assert.strictEqual(skillNames.includes("no-yap"), false);
    for (const name of skillNames) {
      await fs.access(path.join(skillsDir, name, "SKILL.md"));
    }

    const prSteward = parseFrontmatter(
      await fs.readFile(path.join(skillsDir, "pr-steward", "SKILL.md"), "utf-8"),
    );
    assert.strictEqual(prSteward.data.name, "pr-steward");
    assert.strictEqual(prSteward.data["disable-model-invocation"], true);
    assert.strictEqual(prSteward.data.type, undefined);
    assert.strictEqual(prSteward.data["auto-trigger"], undefined);

    const autoresearch = parseFrontmatter(
      await fs.readFile(
        path.join(skillsDir, "autoresearch", "SKILL.md"),
        "utf-8",
      ),
    );
    assert.strictEqual(autoresearch.data["disable-model-invocation"], undefined);

    await fs.access(path.join(skillsDir, "quiz-me", "template.html"));
    await fs.access(path.join(skillsDir, "pr-steward", "scripts", "threads.sh"));
    await fs.access(
      path.join(skillsDir, "pr-steward", "reference", "automation.md"),
    );
    await assert.rejects(fs.access(path.join(skillsDir, "no-yap")));

    const readme = await fs.readFile(path.join(out, "README.md"), "utf-8");
    assert.ok(readme.includes("acme/quiver-plugin"));
    assert.ok(readme.includes("Always-on instructions"));

    await fs.rm(out, { recursive: true, force: true });
  });

  it("percent-encodes every slash in README install links", async () => {
    const out = await tempDir("quiver-encoding-");
    const selection = await builtinSelection();
    await writePluginRepo(
      buildPluginRepo(selection, {
        meta,
        repo: "acme/team/quiver-plugin",
      }),
      out,
    );

    const readme = await fs.readFile(path.join(out, "README.md"), "utf-8");
    assert.ok(
      readme.includes(
        "source=acme%2Fteam%2Fquiver-plugin&plugin=quiver",
      ),
    );
    assert.ok(readme.includes("ref=acme%2Fteam%2Fquiver-plugin"));
    assert.strictEqual(
      readme.includes("source=acme/team%2Fquiver-plugin"),
      false,
    );

    await fs.rm(out, { recursive: true, force: true });
  });

  it("is byte-for-byte idempotent when rebuilt with --force", async () => {
    const out = await tempDir("quiver-idempotent-");
    const selection = await builtinSelection();
    const files = buildPluginRepo(selection, {
      meta,
      repo: "acme/quiver-plugin",
    });

    await writePluginRepo(files, out);
    const first = await readTree(out);

    await writePluginRepo(files, out, { force: true });
    const second = await readTree(out);

    assert.deepStrictEqual(
      [...second.keys()].sort(),
      [...first.keys()].sort(),
    );
    for (const [file, content] of first) {
      assert.ok(second.get(file)?.equals(content));
    }

    await fs.rm(out, { recursive: true, force: true });
  });

  it("does not write anything in dry-run mode", async () => {
    const out = path.join(await tempDir("quiver-dry-"), "plugin");
    const selection = await builtinSelection();
    const files = buildPluginRepo(selection, {
      meta,
      repo: "acme/quiver-plugin",
    });

    const log = mock.method(console, "log", () => {});
    await writePluginRepo(files, out, { dryRun: true });
    log.mock.restore();

    await assert.rejects(fs.access(out));
  });

  it("refuses a non-empty output directory unless --force is set", async () => {
    const out = await tempDir("quiver-nonempty-");
    await fs.writeFile(path.join(out, "keep.txt"), "keep", "utf-8");
    const selection = await builtinSelection();
    const files = buildPluginRepo(selection, {
      meta,
      repo: "acme/quiver-plugin",
    });

    await assert.rejects(writePluginRepo(files, out), /Output directory is not empty/);
    assert.strictEqual(
      await fs.readFile(path.join(out, "keep.txt"), "utf-8"),
      "keep",
    );

    await writePluginRepo(files, out, { force: true });
    assert.strictEqual(
      await fs.readFile(path.join(out, "keep.txt"), "utf-8"),
      "keep",
    );

    await fs.rm(out, { recursive: true, force: true });
  });

  it("refuses to write outside the output directory", async () => {
    const out = await tempDir("quiver-escape-");
    const escapeName = `${path.basename(out)}-escape.txt`;
    const escapePath = path.join(path.dirname(out), escapeName);

    await assert.rejects(
      writePluginRepo(
        [{ path: path.join("..", escapeName), content: "escaped" }],
        out,
      ),
      /Refusing to write outside/,
    );
    await assert.rejects(fs.access(escapePath));

    await fs.rm(out, { recursive: true, force: true });
  });

  it("removes files a previous export generated when --force rebuilds a smaller set", async () => {
    const out = await tempDir("quiver-stale-");
    const selection = await builtinSelection();
    await writePluginRepo(
      buildPluginRepo(selection, { meta, repo: "acme/quiver-plugin" }),
      out,
    );
    const quizPath = path.join(out, "skills", "quiz-me", "SKILL.md");
    await fs.access(quizPath);
    await fs.writeFile(path.join(out, "NOTES.md"), "user notes", "utf-8");

    const smaller = {
      ...selection,
      skills: selection.skills.filter((skill) => skill.name !== "quiz-me"),
    };
    await writePluginRepo(
      buildPluginRepo(smaller, { meta, repo: "acme/quiver-plugin" }),
      out,
      { force: true },
    );

    await assert.rejects(fs.access(quizPath));
    assert.strictEqual(
      await fs.readFile(path.join(out, "NOTES.md"), "utf-8"),
      "user notes",
    );

    await fs.rm(out, { recursive: true, force: true });
  });

  it("copies binary assets without corrupting them", async () => {
    const skillDir = await tempDir("quiver-binary-skill-");
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: binary-skill\ndescription: A skill with an image\n---\nbody\n",
      "utf-8",
    );
    const icon = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(skillDir, "icon.png"), icon);

    const skill: ResolvedSkill = {
      frontmatter: {
        name: "binary-skill",
        description: "A skill with an image",
        type: "skill",
        "auto-trigger": false,
      },
      baseContent: "body",
      source: { type: "builtin" },
      skillDir,
    };

    const selection = await collectPortableSkills([skill]);
    const out = await tempDir("quiver-binary-out-");
    await writePluginRepo(
      buildPluginRepo(selection, { meta, repo: "acme/quiver-plugin" }),
      out,
    );

    const copied = await fs.readFile(
      path.join(out, "skills", "binary-skill", "icon.png"),
    );
    assert.ok(copied.equals(icon));

    await fs.rm(skillDir, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
  });
});

describe("quiver export command", () => {
  it("rejects --include-third-party with a clear message", async () => {
    await assert.rejects(
      exportCommand({ includeThirdParty: true }),
      /Third-party skills are not exported/,
    );
  });

  it("writes the plugin repo using quiver's package metadata", async () => {
    const out = await tempDir("quiver-cli-export-");
    const log = mock.method(console, "log", () => {});
    await exportCommand({ out });
    log.mock.restore();

    const pkg = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"),
    );
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(out, "plugin.json"),
        "utf-8",
      ),
    );
    assert.strictEqual(manifest.version, pkg.version);
    assert.strictEqual(manifest.author.name, pkg.author.name);

    await fs.rm(out, { recursive: true, force: true });
  });
});
