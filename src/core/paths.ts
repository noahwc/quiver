import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type Scope, type ToolTarget, type ResolvedSkill } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function builtinSkillsDir(): string {
  return path.resolve(__dirname, "../../skills");
}

export function builtinThirdPartyDir(): string {
  return path.resolve(__dirname, "../../third-party-references");
}

export function templatesDir(): string {
  return path.resolve(__dirname, "../../templates");
}

export interface ToolPaths {
  instructionMd?: string;
  instructionsDir: string;
  skillsDir: string;
  agentsDir: string;
  promptsDir?: string;
}

export function getToolPaths(tool: ToolTarget, scope: Scope): ToolPaths {
  const home = os.homedir();

  switch (tool) {
    case "claude":
      return {
        instructionMd: scope === "global"
          ? path.join(home, ".claude", "CLAUDE.md")
          : "CLAUDE.md",
        instructionsDir: scope === "global"
          ? path.join(home, ".claude", "instructions")
          : ".claude/instructions",
        skillsDir: scope === "global"
          ? path.join(home, ".claude", "skills")
          : ".claude/skills",
        agentsDir: scope === "global"
          ? path.join(home, ".claude", "agents")
          : ".claude/agents",
      };
    case "opencode":
      return {
        instructionMd: scope === "global"
          ? path.join(home, ".config", "opencode", "AGENTS.md")
          : "AGENTS.md",
        instructionsDir: scope === "global"
          ? path.join(home, ".config", "opencode", "instructions")
          : ".opencode/instructions",
        skillsDir: scope === "global"
          ? path.join(home, ".config", "opencode", "skills")
          : ".opencode/skills",
        agentsDir: scope === "global"
          ? path.join(home, ".config", "opencode", "agents")
          : ".opencode/agents",
      };
    case "copilot":
      return {
        instructionsDir: scope === "global"
          ? path.join(home, ".copilot", "instructions")
          : ".github/instructions",
        skillsDir: scope === "global"
          ? path.join(home, ".copilot", "instructions")
          : ".github/prompts",
        agentsDir: scope === "global"
          ? path.join(home, ".copilot", "agents")
          : ".github/agents",
        promptsDir: scope === "project"
          ? ".github/prompts"
          : undefined,
      };
  }
}

export function getCacheDir(scope: Scope, projectDir?: string): string {
  if (scope === "global") {
    return path.join(os.homedir(), ".quiver", "cache");
  }
  return path.resolve(projectDir ?? process.cwd(), "node_modules/.quiver/cache");
}

export function getConfigPath(scope: Scope, projectDir?: string): string {
  if (scope === "global") {
    return path.join(os.homedir(), ".quiver", "quiver.json");
  }
  return path.resolve(projectDir ?? process.cwd(), "quiver.json");
}

export function getConfigDir(scope: Scope): string {
  if (scope === "global") {
    return path.join(os.homedir(), ".quiver");
  }
  return process.cwd();
}

export function partitionSkills(
  skills: ResolvedSkill[],
  tool: ToolTarget
): { instructions: ResolvedSkill[]; skillEntries: ResolvedSkill[]; agents: ResolvedSkill[] } {
  return {
    instructions: skills.filter(
      (s) => s.frontmatter.type === "instruction" && s.frontmatter.targets.includes(tool)
    ),
    skillEntries: skills.filter(
      (s) => s.frontmatter.type === "skill" && s.frontmatter.targets.includes(tool)
    ),
    agents: skills.filter(
      (s) => s.frontmatter.type === "agent" && s.frontmatter.targets.includes(tool)
    ),
  };
}

import { type ResolvedSkill } from "./types.js";

export function getSkillDirsForRemoval(tool: ToolTarget, skillName: string, scope: Scope): string[] {
  const paths = getToolPaths(tool, scope);
  const result: string[] = [];

  result.push(path.resolve(paths.skillsDir, skillName));
  result.push(path.resolve(paths.agentsDir, `${skillName}.md`));

  if (tool === "copilot") {
    result.push(path.resolve(paths.instructionsDir, `${skillName}.instructions.md`));
    if (paths.promptsDir && scope === "project") {
      result.push(path.resolve(paths.promptsDir, `${skillName}.prompt.md`));
    }
  }

  return result;
}
