import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type OutputFile, type ResolvedSkill } from "../core/types.js";
import { writeOutputs } from "./writers/markdown-writer.js";

const home = os.homedir();

// Skills write once here — Claude Code, OpenCode, and VS Code Copilot all
// discover ~/.claude/skills/.
const CLAUDE_SKILLS_DIR = path.join(home, ".claude", "skills");

// Always-on instructions have no shared path, so they go to each tool's file.
const CLAUDE_MD = path.join(home, ".claude", "CLAUDE.md");
const OPENCODE_MD = path.join(home, ".config", "opencode", "AGENTS.md");
const COPILOT_INSTRUCTIONS_DIR = path.join(home, ".copilot", "instructions");

export function generateOutputs(skills: ResolvedSkill[]): OutputFile[] {
  const outputs: OutputFile[] = [];
  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction",
  );
  const skillEntries = skills.filter((s) => s.frontmatter.type === "skill");

  // On-demand skills → shared ~/.claude/skills/ directory (discovered by all tools)
  for (const s of skillEntries) {
    outputs.push({
      path: path.join(CLAUDE_SKILLS_DIR, s.frontmatter.name, "SKILL.md"),
      content: claudeSkillFile(s),
      mergeStrategy: "overwrite",
    });
  }

  // Always-on instructions → individual Copilot file per skill
  for (const s of instructions) {
    outputs.push({
      path: path.join(
        COPILOT_INSTRUCTIONS_DIR,
        `${s.frontmatter.name}.instructions.md`,
      ),
      content: copilotFile(s),
      mergeStrategy: "overwrite",
    });
  }

  // Always-on instructions → single managed block in CLAUDE.md and AGENTS.md.
  // Empty content when there are no instructions — writer removes the block.
  const instructionContent = instructions
    .map((s) => s.baseContent)
    .join("\n\n");

  outputs.push({
    path: CLAUDE_MD,
    content: instructionContent,
    mergeStrategy: "section-marker",
  });
  outputs.push({
    path: OPENCODE_MD,
    content: instructionContent,
    mergeStrategy: "section-marker",
  });

  return outputs;
}

export async function build(
  skills: ResolvedSkill[],
  options?: { dryRun?: boolean },
): Promise<void> {
  const outputs = [...generateOutputs(skills), ...(await generateAssetOutputs(skills))];
  await writeOutputs(outputs, options);
}

/**
 * Skills may bundle extra files alongside SKILL.md (e.g. an HTML template or a
 * helper script). Copy every non-SKILL.md file from each skill's source dir into
 * its installed dir under ~/.claude/skills/<name>/, preserving nested paths, so
 * the skill can reference bundled assets at a predictable location at runtime.
 */
export async function generateAssetOutputs(
  skills: ResolvedSkill[],
): Promise<OutputFile[]> {
  const outputs: OutputFile[] = [];
  const skillEntries = skills.filter((s) => s.frontmatter.type === "skill");
  for (const s of skillEntries) {
    const assetFiles = await listSkillAssets(s.skillDir);
    for (const rel of assetFiles) {
      const content = await fs.readFile(path.join(s.skillDir, rel), "utf-8");
      outputs.push({
        path: path.join(CLAUDE_SKILLS_DIR, s.frontmatter.name, rel),
        content,
        mergeStrategy: "overwrite",
      });
    }
  }
  return outputs;
}

async function listSkillAssets(skillDir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else if (entry.name !== "SKILL.md") {
        results.push(rel);
      }
    }
  }
  await walk(skillDir, "");
  return results;
}

function claudeSkillFile(skill: ResolvedSkill): string {
  const fm = skill.frontmatter;
  const desc = fm.description.replace(/"/g, '\\"');
  const lines = ["---", `name: ${fm.name}`, `description: "${desc}"`];
  if (!fm["auto-trigger"]) lines.push("disable-model-invocation: true");
  lines.push("---", "", skill.baseContent);
  return lines.join("\n") + "\n";
}

function copilotFile(skill: ResolvedSkill): string {
  const fm = skill.frontmatter;
  return (
    [
      "---",
      `name: "${fm.name}"`,
      `description: "${fm.description}"`,
      'applyTo: "**"',
      "---",
      "",
      skill.baseContent,
    ].join("\n") + "\n"
  );
}

