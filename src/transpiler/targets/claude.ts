import * as os from "node:os";
import * as path from "node:path";
import {
  type OutputFile,
  type ResolvedSkill,
  type ToolTarget,
} from "../../core/types.js";
import { composeContent } from "../parser.js";
import { wrapInSectionMarker } from "../section-marker.js";

export type Scope = "project" | "global";

export function getBaseDir(scope: Scope): string {
  if (scope === "global") return os.homedir();
  return process.cwd();
}

function instructionMd(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".claude", "CLAUDE.md") : "CLAUDE.md";
}

function skillsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".claude", "skills") : ".claude/skills";
}

function agentsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".claude", "agents") : ".claude/agents";
}

export function generateClaudeOutputs(skills: ResolvedSkill[], scope: Scope = "project"): OutputFile[] {
  const files: OutputFile[] = [];

  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction" && s.frontmatter.targets.includes("claude")
  );
  const skillEntries = skills.filter(
    (s) => s.frontmatter.type === "skill" && s.frontmatter.targets.includes("claude")
  );
  const agents = skills.filter(
    (s) => s.frontmatter.type === "agent" && s.frontmatter.targets.includes("claude")
  );

  if (instructions.length > 0) {
    const sections = instructions.map((s) => {
      const content = composeContent(s.baseContent, s.targetSections, "claude" as ToolTarget);
      return wrapInSectionMarker(s.frontmatter.name, content);
    });
    files.push({
      path: instructionMd(scope),
      content: sections.join("\n\n") + "\n",
      mergeStrategy: "section-marker",
    });
  }

  for (const s of skillEntries) {
    const content = composeContent(s.baseContent, s.targetSections, "claude" as ToolTarget);
    files.push({
      path: path.resolve(skillsDir(scope), s.frontmatter.name, "SKILL.md"),
      content: buildClaudeSkillFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  for (const s of agents) {
    const content = composeContent(s.baseContent, s.targetSections, "claude" as ToolTarget);
    files.push({
      path: path.resolve(agentsDir(scope), `${s.frontmatter.name}.md`),
      content: buildClaudeAgentFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  return files;
}

function buildClaudeSkillFile(skill: ResolvedSkill, body: string): string {
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

function buildClaudeAgentFile(skill: ResolvedSkill, body: string): string {
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
