import * as os from "node:os";
import * as path from "node:path";
import {
  type OutputFile,
  type ResolvedSkill,
  type ToolTarget,
} from "../../core/types.js";
import { composeContent } from "../parser.js";
import { wrapInSectionMarker } from "../section-marker.js";
import { type Scope } from "./claude.js";

function agentsMd(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".config", "opencode", "AGENTS.md") : "AGENTS.md";
}

function skillsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".config", "opencode", "skills") : ".opencode/skills";
}

function agentsDir(scope: Scope): string {
  return scope === "global" ? path.join(os.homedir(), ".config", "opencode", "agents") : ".opencode/agents";
}

export function generateOpenCodeOutputs(skills: ResolvedSkill[], scope: Scope = "project"): OutputFile[] {
  const files: OutputFile[] = [];

  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction" && s.frontmatter.targets.includes("opencode")
  );
  const skillEntries = skills.filter(
    (s) => s.frontmatter.type === "skill" && s.frontmatter.targets.includes("opencode")
  );
  const agents = skills.filter(
    (s) => s.frontmatter.type === "agent" && s.frontmatter.targets.includes("opencode")
  );

  if (instructions.length > 0) {
    const sections = instructions.map((s) => {
      const content = composeContent(s.baseContent, s.targetSections, "opencode" as ToolTarget);
      return wrapInSectionMarker(s.frontmatter.name, content);
    });
    files.push({
      path: agentsMd(scope),
      content: sections.join("\n\n") + "\n",
      mergeStrategy: "section-marker",
    });
  }

  for (const s of skillEntries) {
    const content = composeContent(s.baseContent, s.targetSections, "opencode" as ToolTarget);
    files.push({
      path: path.resolve(skillsDir(scope), s.frontmatter.name, "SKILL.md"),
      content: buildOpenCodeSkillFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  for (const s of agents) {
    const content = composeContent(s.baseContent, s.targetSections, "opencode" as ToolTarget);
    files.push({
      path: path.resolve(agentsDir(scope), `${s.frontmatter.name}.md`),
      content: buildOpenCodeAgentFile(s, content),
      mergeStrategy: "overwrite",
    });
  }

  return files;
}

function buildOpenCodeSkillFile(skill: ResolvedSkill, body: string): string {
  const fm = skill.frontmatter;
  const lines: string[] = ["---"];
  lines.push(`name: ${fm.name}`);
  lines.push(`description: ${fm.description}`);
  lines.push("license: MIT");
  lines.push("compatibility: opencode");
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n") + "\n";
}

function buildOpenCodeAgentFile(skill: ResolvedSkill, body: string): string {
  const fm = skill.frontmatter;
  const lines: string[] = ["---"];
  lines.push(`description: ${fm.description}`);
  lines.push("mode: subagent");
  lines.push("---");
  lines.push("");
  lines.push(body);
  return lines.join("\n") + "\n";
}
