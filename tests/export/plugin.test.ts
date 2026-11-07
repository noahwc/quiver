import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import matter from "gray-matter";
import {
  buildPluginRepo,
  writePluginRepo,
  type PluginMeta,
} from "../../src/export/plugin.js";
import { collectPortableSkills } from "../../src/export/portable.js";
import { discoverAllSkills } from "../../src/core/skill-discovery.js";
import { loadSkill } from "../../src/core/skill-loader.js";
import { type ResolvedSkill } from "../../src/core/types.js";
import { exportCommand } from "../../src/cli/export.js";

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
    expect(manifest.$schema).toBe(
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    );
    expect(manifest.name).toBe("quiver");
    expect(manifest.version).toBe("9.9.9");
    expect(manifest.author).toEqual(meta.author);
    expect(manifest.license).toBe("MIT");
    expect(Object.keys(manifest).sort()).toEqual([
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
    await expect(fs.access(path.join(out, "plugins"))).rejects.toThrow();

    const marketplace = JSON.parse(
      await fs.readFile(
        path.join(out, ".claude-plugin", "marketplace.json"),
        "utf-8",
      ),
    );
    expect(marketplace.name).toBe("quiver");
    expect(marketplace.owner.name).toBe("Test Author");
    // VS Code/Copilot plugin-source contract:
    // - `.claude-plugin/marketplace.json` is one of the recognized catalog paths
    // - a single entry means "add as source" installs it directly
    // - source "." resolves to the repository root
    // - root plugin.json carries the Agent Plugins $schema, selecting the
    //   AgentPlugin adapter over the legacy Copilot/Claude formats
    expect(marketplace.plugins).toHaveLength(1);
    expect(marketplace.plugins[0].source).toBe(".");
    expect(marketplace.plugins[0].name).toBe("quiver");
    expect(marketplace.plugins[0].version).toBe("9.9.9");
    expect(manifest.$schema.startsWith("https://agent-plugins.org/")).toBe(true);

    const piPackage = JSON.parse(
      await fs.readFile(path.join(out, "package.json"), "utf-8"),
    );
    expect(piPackage.keywords).toContain("pi-package");
    expect(piPackage.pi.skills).toEqual(["./skills"]);

    const skillsDir = path.join(out, "skills");
    const skillNames = (await fs.readdir(skillsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const expectedSkillNames = (await discoverAllSkills())
      .filter((skill) => skill.url === "builtin" && skill.type === "skill")
      .map((skill) => skill.name)
      .sort();
    expect(skillNames).toEqual(expectedSkillNames);
    expect(skillNames).toContain("pr-steward");
    expect(skillNames).not.toContain("no-yap");
    for (const name of skillNames) {
      await fs.access(path.join(skillsDir, name, "SKILL.md"));
    }

    const prSteward = matter(
      await fs.readFile(path.join(skillsDir, "pr-steward", "SKILL.md"), "utf-8"),
    );
    expect(prSteward.data.name).toBe("pr-steward");
    expect(prSteward.data["disable-model-invocation"]).toBe(true);
    expect(prSteward.data.type).toBeUndefined();
    expect(prSteward.data["auto-trigger"]).toBeUndefined();

    const autoresearch = matter(
      await fs.readFile(
        path.join(skillsDir, "autoresearch", "SKILL.md"),
        "utf-8",
      ),
    );
    expect(autoresearch.data["disable-model-invocation"]).toBeUndefined();

    await fs.access(path.join(skillsDir, "quiz-me", "template.html"));
    await fs.access(path.join(skillsDir, "pr-steward", "scripts", "threads.sh"));
    await fs.access(
      path.join(skillsDir, "pr-steward", "reference", "automation.md"),
    );
    await expect(
      fs.access(path.join(skillsDir, "no-yap")),
    ).rejects.toThrow();

    const readme = await fs.readFile(path.join(out, "README.md"), "utf-8");
    expect(readme).toContain("acme/quiver-plugin");
    expect(readme).toContain("Always-on instructions");

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

    expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
    for (const [file, content] of first) {
      expect(second.get(file)?.equals(content)).toBe(true);
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

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await writePluginRepo(files, out, { dryRun: true });
    log.mockRestore();

    await expect(fs.access(out)).rejects.toThrow();
  });

  it("refuses a non-empty output directory unless --force is set", async () => {
    const out = await tempDir("quiver-nonempty-");
    await fs.writeFile(path.join(out, "keep.txt"), "keep", "utf-8");
    const selection = await builtinSelection();
    const files = buildPluginRepo(selection, {
      meta,
      repo: "acme/quiver-plugin",
    });

    await expect(writePluginRepo(files, out)).rejects.toThrow(
      /Output directory is not empty/,
    );
    await expect(fs.readFile(path.join(out, "keep.txt"), "utf-8")).resolves.toBe(
      "keep",
    );

    await writePluginRepo(files, out, { force: true });
    await expect(fs.readFile(path.join(out, "keep.txt"), "utf-8")).resolves.toBe(
      "keep",
    );

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

    await expect(fs.access(quizPath)).rejects.toThrow();
    await expect(fs.readFile(path.join(out, "NOTES.md"), "utf-8")).resolves.toBe(
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
    expect(copied.equals(icon)).toBe(true);

    await fs.rm(skillDir, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
  });
});

describe("quiver export command", () => {
  it("rejects --include-third-party with a clear message", async () => {
    await expect(exportCommand({ includeThirdParty: true })).rejects.toThrow(
      /Third-party skills are not exported/,
    );
  });

  it("writes the plugin repo using quiver's package metadata", async () => {
    const out = await tempDir("quiver-cli-export-");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await exportCommand({ out });
    log.mockRestore();

    const pkg = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8"),
    );
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(out, "plugin.json"),
        "utf-8",
      ),
    );
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.author.name).toBe(pkg.author.name);

    await fs.rm(out, { recursive: true, force: true });
  });
});
