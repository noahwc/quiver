import * as os from "node:os";
import * as path from "node:path";
import {
  type OutputFile,
  type ResolvedSkill,
  type ToolTarget,
} from "../../core/types.js";
import { composeContent } from "../parser.js";
import { type Scope } from "./claude.js";

function instructionsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".copilot", "instructions") : ".github/instructions";
}

function promptsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".copilot", "instructions") : ".github/prompts";
}

function agentsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".copilot", "agents") : ".github/agents";
}

export function generateCopilotOutputs(skills: ResolvedSkill[], scope: Scope = "project"): OutputFile[] {
  const files: OutputFile[] = [];

  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction" && s.frontmatter.targets.includes("copilot")
  );
  const skillEntries = skills.filter(
    (s) => s.frontmatter.type === "skill" && s.frontmatter.targets.includes("copilot")
  );
  const agents = skills.filter(
    (s) => s.frontmatter.type === "agent" && s.frontmatter.targets.includes("copilot")
  );

  for (const s of instructions) {
    const content = composeContent(s.baseContent, s.targetSections, "copilot" as ToolTarget);
    files.push({
      path: path.resolve(instructionsDir(scope), `${s.frontmatter.name}.instructions.md`),
      content: buildCopilotInstructionFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  for (const s of skillEntries) {
    const content = composeContent(s.baseContent, s.targetSections, "copilot" as ToolTarget);
    if (scope === "global") {
      files.push({
        path: path.resolve(instructionsDir(scope), `${s.frontmatter.name}.instructions.md`),
        content: buildCopilotInstructionFile(s, content),
        mergeStrategy: "overwrite",
      });
    } else {
      files.push({
        path: path.resolve(promptsDir(scope), `${s.frontmatter.name}.prompt.md`),
        content: content + "\n",
        mergeStrategy: "overwrite",
      });
    }
  }

  for (const s of agents) {
    const content = composeContent(s.baseContent, s.targetSections, "copilot" as ToolTarget);
    files.push({
      path: path.resolve(agentsDir(scope), `${s.frontmatter.name}.agent.md`),
      content: buildCopilotAgentFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  return files;
}

function buildCopilotInstructionFile(
  skill: ResolvedSkill,
  body: string
): string {
  const fm = skill.frontmatter;
  const lines: string[] = ["---"];
  lines.push(`name: "${fm.name}"`);
  lines.push(`description: "${fm.description}"`);
  lines.push('applyTo: "**"');
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n") + "\n";
}

function buildCopilotAgentFile(
  skill: ResolvedSkill,
  body: string
): string {
  const fm = skill.frontmatter;
  const lines: string[] = ["---"];
  lines.push(`name: ${fm.name}`);
  lines.push(`description: ${fm.description}`);
  if (!fm["auto-trigger"]) {
    lines.push("disable-model-invocation: true");
  }
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n") + "\n";
}
