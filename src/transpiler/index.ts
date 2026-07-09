import * as os from "node:os";
import * as path from "node:path";
import { type OutputFile, type ResolvedSkill } from "../core/types.js";
import { wrapInSectionMarker } from "./section-marker.js";
import { writeOutputs } from "./writers/markdown-writer.js";

const home = os.homedir();

// Skills write once here — Claude Code, OpenCode, and VS Code Copilot all
// discover ~/.claude/skills/.
const CLAUDE_SKILLS_DIR = path.join(home, ".claude", "skills");

// Always-on instructions have no shared path, so they go to each tool's file.
const CLAUDE_MD = path.join(home, ".claude", "CLAUDE.md");
const OPENCODE_MD = path.join(home, ".config", "opencode", "AGENTS.md");
const COPILOT_INSTRUCTIONS_DIR = path.join(home, ".copilot", "instructions");

export interface BuildOptions {
  dryRun?: boolean;
}

export function generateOutputs(skills: ResolvedSkill[]): OutputFile[] {
  const outputs: OutputFile[] = [];
  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction",
  );
  const skillEntries = skills.filter((s) => s.frontmatter.type === "skill");

  for (const s of skillEntries) {
    outputs.push({
      path: path.join(CLAUDE_SKILLS_DIR, s.frontmatter.name, "SKILL.md"),
      content: skillFile(s),
      mergeStrategy: "overwrite",
    });
  }

  if (instructions.length > 0) {
    const merged =
      instructions
        .map((s) => wrapInSectionMarker(s.frontmatter.name, s.baseContent))
        .join("\n\n") + "\n";
    outputs.push({
      path: CLAUDE_MD,
      content: merged,
      mergeStrategy: "section-marker",
    });
    outputs.push({
      path: OPENCODE_MD,
      content: merged,
      mergeStrategy: "section-marker",
    });

    for (const s of instructions) {
      outputs.push({
        path: path.join(
          COPILOT_INSTRUCTIONS_DIR,
          `${s.frontmatter.name}.instructions.md`,
        ),
        content: copilotInstructionFile(s),
        mergeStrategy: "overwrite",
      });
    }
  }

  return outputs;
}

export async function build(
  skills: ResolvedSkill[],
  options?: BuildOptions,
): Promise<void> {
  await writeOutputs(generateOutputs(skills), options);
}

function skillFile(skill: ResolvedSkill): string {
  const fm = skill.frontmatter;
  const lines = ["---", `name: ${fm.name}`, `description: ${fm.description}`];
  if (!fm["auto-trigger"]) lines.push("disable-model-invocation: true");
  lines.push("---", "", skill.baseContent);
  return lines.join("\n") + "\n";
}

function copilotInstructionFile(skill: ResolvedSkill): string {
  const fm = skill.frontmatter;
  const lines = [
    "---",
    `name: "${fm.name}"`,
    `description: "${fm.description}"`,
    'applyTo: "**"',
    "---",
    "",
    skill.baseContent,
  ];
  return lines.join("\n") + "\n";
}
