import { describe, it, expect } from "vitest";
import { generateClaudeOutputs } from "../../src/transpiler/targets/claude.js";
import { generateOpenCodeOutputs } from "../../src/transpiler/targets/opencode.js";
import { generateCopilotOutputs } from "../../src/transpiler/targets/copilot.js";
import { type ResolvedSkill } from "../../src/core/types.js";
import * as os from "node:os";
import * as path from "node:path";

function makeSkill(overrides: Partial<ResolvedSkill["frontmatter"]> = {}): ResolvedSkill {
  return {
    frontmatter: {
      name: "no-yap",
      description: "Eliminate verbosity",
      category: "tokens",
      type: "instruction",
      "auto-trigger": false,
      targets: ["claude", "opencode", "copilot"],
      ...overrides,
    },
    baseContent: "- Be concise",
    targetSections: [],
    source: { type: "builtin" },
    skillDir: "/tmp/no-yap",
  };
}

function projectPath(relative: string): string {
  return path.resolve(process.cwd(), relative);
}

describe("Claude Code generator (project scope)", () => {
  it("generates CLAUDE.md section for instruction skills", () => {
    const outputs = generateClaudeOutputs([makeSkill()]);
    const claudeMd = outputs.find((o) => o.path.endsWith("CLAUDE.md"));
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.content).toContain("quiver:start:no-yap");
    expect(claudeMd!.content).toContain("Be concise");
    expect(claudeMd!.mergeStrategy).toBe("section-marker");
  });

  it("generates .claude/skills/ for skill-type skills", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateClaudeOutputs([skill]);
    const skillFile = outputs.find((o) => o.path === projectPath(".claude/skills/grill-me/SKILL.md"));
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain("name: grill-me");
    expect(skillFile!.content).toContain("disable-model-invocation: true");
  });

  it("generates .claude/agents/ for agent-type skills", () => {
    const skill = makeSkill({ type: "agent", name: "grill-with-docs" });
    const outputs = generateClaudeOutputs([skill]);
    const agentFile = outputs.find((o) => o.path === projectPath(".claude/agents/grill-with-docs.md"));
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain("name: grill-with-docs");
  });

  it("skips skills that don't target claude", () => {
    const skill = makeSkill({ targets: ["copilot"] });
    const outputs = generateClaudeOutputs([skill]);
    expect(outputs).toHaveLength(0);
  });
});

describe("OpenCode generator (project scope)", () => {
  it("generates AGENTS.md section for instruction skills", () => {
    const outputs = generateOpenCodeOutputs([makeSkill()]);
    const agentsMd = outputs.find((o) => o.path.endsWith("AGENTS.md"));
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain("quiver:start:no-yap");
  });

  it("generates .opencode/skills/ for skill-type", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateOpenCodeOutputs([skill]);
    const skillFile = outputs.find((o) => o.path === projectPath(".opencode/skills/grill-me/SKILL.md"));
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toContain("compatibility: opencode");
  });

  it("generates .opencode/agents/ for agent-type", () => {
    const skill = makeSkill({ type: "agent", name: "grill-with-docs" });
    const outputs = generateOpenCodeOutputs([skill]);
    const agentFile = outputs.find((o) => o.path === projectPath(".opencode/agents/grill-with-docs.md"));
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain("mode: subagent");
  });
});

describe("Copilot generator (project scope)", () => {
  it("generates .github/instructions/ for instruction skills", () => {
    const outputs = generateCopilotOutputs([makeSkill()]);
    const instrFile = outputs.find(
      (o) => o.path === projectPath(".github/instructions/no-yap.instructions.md")
    );
    expect(instrFile).toBeDefined();
    expect(instrFile!.content).toContain('applyTo: "**"');
    expect(instrFile!.content).toContain("Be concise");
  });

  it("generates .github/prompts/ for skill-type", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateCopilotOutputs([skill]);
    const promptFile = outputs.find((o) => o.path === projectPath(".github/prompts/grill-me.prompt.md"));
    expect(promptFile).toBeDefined();
  });

  it("generates .github/agents/ for agent-type", () => {
    const skill = makeSkill({ type: "agent", name: "grill-with-docs" });
    const outputs = generateCopilotOutputs([skill]);
    const agentFile = outputs.find(
      (o) => o.path === projectPath(".github/agents/grill-with-docs.agent.md")
    );
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain("name: grill-with-docs");
  });
});

describe("Claude Code generator (global scope)", () => {
  it("generates ~/.claude/CLAUDE.md section for instruction skills", () => {
    const outputs = generateClaudeOutputs([makeSkill()], "global");
    const expected = path.join(os.homedir(), ".claude", "CLAUDE.md");
    const claudeMd = outputs.find((o) => o.path === expected);
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.content).toContain("quiver:start:no-yap");
  });

  it("generates ~/.claude/skills/ for skill-type", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateClaudeOutputs([skill], "global");
    const expected = path.join(os.homedir(), ".claude", "skills", "grill-me", "SKILL.md");
    const skillFile = outputs.find((o) => o.path === expected);
    expect(skillFile).toBeDefined();
  });

  it("generates ~/.claude/agents/ for agent-type", () => {
    const skill = makeSkill({ type: "agent", name: "grill-with-docs" });
    const outputs = generateClaudeOutputs([skill], "global");
    const expected = path.join(os.homedir(), ".claude", "agents", "grill-with-docs.md");
    const agentFile = outputs.find((o) => o.path === expected);
    expect(agentFile).toBeDefined();
  });
});

describe("OpenCode generator (global scope)", () => {
  it("generates ~/.config/opencode/AGENTS.md section", () => {
    const outputs = generateOpenCodeOutputs([makeSkill()], "global");
    const expected = path.join(os.homedir(), ".config", "opencode", "AGENTS.md");
    const agentsMd = outputs.find((o) => o.path === expected);
    expect(agentsMd).toBeDefined();
  });

  it("generates ~/.config/opencode/skills/ for skill-type", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateOpenCodeOutputs([skill], "global");
    const expected = path.join(os.homedir(), ".config", "opencode", "skills", "grill-me", "SKILL.md");
    const skillFile = outputs.find((o) => o.path === expected);
    expect(skillFile).toBeDefined();
  });
});

describe("Copilot generator (global scope)", () => {
  it("generates ~/.copilot/instructions/ for instruction skills", () => {
    const outputs = generateCopilotOutputs([makeSkill()], "global");
    const expected = path.join(os.homedir(), ".copilot", "instructions", "no-yap.instructions.md");
    const instrFile = outputs.find((o) => o.path === expected);
    expect(instrFile).toBeDefined();
    expect(instrFile!.content).toContain('applyTo: "**"');
  });

  it("maps skill-type to ~/.copilot/instructions/ as always-on", () => {
    const skill = makeSkill({ type: "skill", name: "grill-me" });
    const outputs = generateCopilotOutputs([skill], "global");
    const expected = path.join(os.homedir(), ".copilot", "instructions", "grill-me.instructions.md");
    const instrFile = outputs.find((o) => o.path === expected);
    expect(instrFile).toBeDefined();
    expect(instrFile!.content).toContain('applyTo: "**"');
  });

  it("generates ~/.copilot/agents/ for agent-type", () => {
    const skill = makeSkill({ type: "agent", name: "grill-with-docs" });
    const outputs = generateCopilotOutputs([skill], "global");
    const expected = path.join(os.homedir(), ".copilot", "agents", "grill-with-docs.agent.md");
    const agentFile = outputs.find((o) => o.path === expected);
    expect(agentFile).toBeDefined();
  });
});
