import { type ToolTarget, type ResolvedSkill } from "../core/types.js";
import { generateClaudeOutputs, type Scope } from "./targets/claude.js";
import { generateOpenCodeOutputs } from "./targets/opencode.js";
import { generateCopilotOutputs } from "./targets/copilot.js";
import { writeOutputs } from "./writers/markdown-writer.js";

export interface BuildOptions {
  dryRun?: boolean;
}

export async function build(
  skills: ResolvedSkill[],
  tools: ToolTarget[],
  scope: Scope = "project",
  options?: BuildOptions
): Promise<void> {
  const allOutputs = [];

  if (tools.includes("claude")) {
    allOutputs.push(...generateClaudeOutputs(skills, scope));
  }
  if (tools.includes("opencode")) {
    allOutputs.push(...generateOpenCodeOutputs(skills, scope));
  }
  if (tools.includes("copilot")) {
    allOutputs.push(...generateCopilotOutputs(skills, scope));
  }

  await writeOutputs(allOutputs, options);
}
