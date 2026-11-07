import { describe, it, expect } from "vitest";
import {
  generateOutputs,
  generateAssetOutputs,
  INSTRUCTION_FILES,
  SKILL_ROOTS,
} from "../../src/transpiler/index.js";
import { type ResolvedSkill } from "../../src/core/types.js";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

function makeSkill(
  overrides: Partial<ResolvedSkill["frontmatter"]> = {},
): ResolvedSkill {
  return {
    frontmatter: {
      name: "no-yap",
      description: "Eliminate verbosity",
      type: "instruction",
      "auto-trigger": false,
      ...overrides,
    },
    baseContent: "- Be concise",
    source: { type: "builtin" },
    skillDir: "/tmp/no-yap",
  };
}

const home = os.homedir();

describe("generateOutputs — skills", () => {
  it("writes a skill to every native skills root", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const expectedRoots = [
      path.join(home, ".claude", "skills"),
      path.join(home, ".copilot", "skills"),
      path.join(home, ".agents", "skills"),
    ];
    for (const root of expectedRoots) {
      const file = outputs.find(
        (o) => o.path === path.join(root, "grill-me", "SKILL.md"),
      );
      expect(file).toBeDefined();
      expect(file!.content).toContain("name: grill-me");
      expect(file!.mergeStrategy).toBe("overwrite");
    }
  });

  it("adds disable-model-invocation when auto-trigger is false", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me", "auto-trigger": false }),
    ]);
    const skillFiles = outputs.filter((o) => o.path.endsWith("SKILL.md"));
    expect(skillFiles).toHaveLength(SKILL_ROOTS.length);
    for (const file of skillFiles) {
      expect(file.content).toContain("disable-model-invocation: true");
    }
  });

  it("omits disable-model-invocation when auto-trigger is true", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me", "auto-trigger": true }),
    ]);
    const skillFiles = outputs.filter((o) => o.path.endsWith("SKILL.md"));
    expect(skillFiles).toHaveLength(SKILL_ROOTS.length);
    for (const file of skillFiles) {
      expect(file.content).not.toContain("disable-model-invocation");
    }
  });

  it("copies each skill to all native roots, not just claude/skills", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const overwriteOutputs = outputs.filter(
      (o) => o.mergeStrategy === "overwrite",
    );
    expect(overwriteOutputs).toHaveLength(SKILL_ROOTS.length);
    const roots = overwriteOutputs.map((o) =>
      path.relative(home, o.path).split(path.sep).slice(0, 2).join(path.sep),
    );
    expect(roots).toEqual([
      path.join(".claude", "skills"),
      path.join(".copilot", "skills"),
      path.join(".agents", "skills"),
    ]);
  });

  it("always emits a managed block in every instruction file", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    expect(INSTRUCTION_FILES).toHaveLength(4);
    for (const filePath of INSTRUCTION_FILES) {
      const output = outputs.find((o) => o.path === filePath);
      expect(output).toBeDefined();
      expect(output!.content.trim()).toBe("");
      expect(output!.mergeStrategy).toBe("section-marker");
    }
  });
});

describe("generateOutputs — instructions", () => {
  it("merges instructions into every always-on file, plus a Copilot file", () => {
    const outputs = generateOutputs([makeSkill()]);
    for (const filePath of INSTRUCTION_FILES) {
      const output = outputs.find((o) => o.path === filePath);
      expect(output).toBeDefined();
      expect(output!.mergeStrategy).toBe("section-marker");
      expect(output!.content).toContain("Be concise");
    }

    const copilot = outputs.find(
      (o) =>
        o.path ===
        path.join(home, ".copilot", "instructions", "no-yap.instructions.md"),
    );
    expect(copilot).toBeDefined();
    expect(copilot!.content).toContain('applyTo: "**"');
    expect(copilot!.content).toContain("Be concise");
  });

  it("produces no instruction files when there are no instructions", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const copilotFiles = outputs.filter(
      (o) => o.path.includes("instructions") && o.mergeStrategy === "overwrite",
    );
    expect(copilotFiles).toHaveLength(0);
  });
});


describe("generateAssetOutputs — bundled skill assets", () => {
  async function tmpSkillDir(files: Record<string, string>): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-skill-"));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf-8");
    }
    return dir;
  }

  it("copies non-SKILL.md files into every native skills root", async () => {
    const dir = await tmpSkillDir({
      "SKILL.md": "---\nname: quiz-me\n---\n",
      "template.html": "<html>tpl</html>",
    });
    const outputs = await generateAssetOutputs([
      { ...makeSkill({ type: "skill", name: "quiz-me" }), skillDir: dir },
    ]);
    for (const root of SKILL_ROOTS) {
      const expected = path.join(root, "quiz-me", "template.html");
      const asset = outputs.find((o) => o.path === expected);
      expect(asset).toBeDefined();
      expect(asset!.content).toBe("<html>tpl</html>");
      expect(asset!.mergeStrategy).toBe("overwrite");
    }
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("excludes SKILL.md and preserves nested paths", async () => {
    const dir = await tmpSkillDir({
      "SKILL.md": "x",
      "assets/quiz.css": "body{}",
    });
    const outputs = await generateAssetOutputs([
      { ...makeSkill({ type: "skill", name: "quiz-me" }), skillDir: dir },
    ]);
    expect(outputs.some((o) => o.path.endsWith("SKILL.md"))).toBe(false);
    for (const root of SKILL_ROOTS) {
      expect(
        outputs.some(
          (o) =>
            o.path ===
            path.join(root, "quiz-me", "assets", "quiz.css"),
        ),
      ).toBe(true);
    }
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("ignores instruction-type skills", async () => {
    const dir = await tmpSkillDir({ "SKILL.md": "x", "template.html": "y" });
    const outputs = await generateAssetOutputs([
      { ...makeSkill({ type: "instruction", name: "no-yap" }), skillDir: dir },
    ]);
    expect(outputs).toHaveLength(0);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
