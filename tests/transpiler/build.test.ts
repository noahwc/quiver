import { describe, it, expect } from "vitest";
import { generateOutputs } from "../../src/transpiler/index.js";
import { type ResolvedSkill } from "../../src/core/types.js";
import * as os from "node:os";
import * as path from "node:path";

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
  it("writes a skill once to ~/.claude/skills/", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const expected = path.join(
      home,
      ".claude",
      "skills",
      "grill-me",
      "SKILL.md",
    );
    const file = outputs.find((o) => o.path === expected);
    expect(file).toBeDefined();
    expect(file!.content).toContain("name: grill-me");
    expect(file!.mergeStrategy).toBe("overwrite");
  });

  it("adds disable-model-invocation when auto-trigger is false", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me", "auto-trigger": false }),
    ]);
    const skillFile = outputs.find((o) => o.path.endsWith("SKILL.md"));
    expect(skillFile!.content).toContain("disable-model-invocation: true");
  });

  it("omits disable-model-invocation when auto-trigger is true", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me", "auto-trigger": true }),
    ]);
    const skillFile = outputs.find((o) => o.path.endsWith("SKILL.md"));
    expect(skillFile!.content).not.toContain("disable-model-invocation");
  });

  it("does not write per-tool skill copies — only the shared claude/skills/ path", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const overwriteOutputs = outputs.filter(
      (o) => o.mergeStrategy === "overwrite",
    );
    expect(overwriteOutputs).toHaveLength(1);
    expect(overwriteOutputs[0]!.path).toContain(
      path.join(".claude", "skills", "grill-me"),
    );
  });

  it("always emits CLAUDE.md and AGENTS.md outputs (empty when no instructions)", () => {
    const outputs = generateOutputs([
      makeSkill({ type: "skill", name: "grill-me" }),
    ]);
    const claudeMd = outputs.find(
      (o) => o.path === path.join(home, ".claude", "CLAUDE.md"),
    );
    const agentsMd = outputs.find(
      (o) => o.path === path.join(home, ".config", "opencode", "AGENTS.md"),
    );
    expect(claudeMd).toBeDefined();
    expect(agentsMd).toBeDefined();
    expect(claudeMd!.content.trim()).toBe("");
    expect(claudeMd!.mergeStrategy).toBe("section-marker");
  });
});

describe("generateOutputs — instructions", () => {
  it("merges instructions into CLAUDE.md and AGENTS.md, plus a Copilot file", () => {
    const outputs = generateOutputs([makeSkill()]);
    const claudeMd = outputs.find(
      (o) => o.path === path.join(home, ".claude", "CLAUDE.md"),
    );
    const agentsMd = outputs.find(
      (o) => o.path === path.join(home, ".config", "opencode", "AGENTS.md"),
    );
    const copilot = outputs.find(
      (o) =>
        o.path ===
        path.join(home, ".copilot", "instructions", "no-yap.instructions.md"),
    );

    expect(claudeMd).toBeDefined();
    expect(claudeMd!.mergeStrategy).toBe("section-marker");
    expect(claudeMd!.content).toContain("Be concise");
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("Be concise");
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

