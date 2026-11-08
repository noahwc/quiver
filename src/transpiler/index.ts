import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { stringifyFrontmatter } from "../core/frontmatter.ts";
import { type OutputFile, type ResolvedSkill } from "../core/types.ts";
import { writeOutputs } from "./writers/markdown-writer.ts";

const home = os.homedir();

/**
 * Skills are written to every native global root. The content is identical;
 * each tool discovers the root it expects:
 *
 * - `~/.claude/skills`   Claude Code, OpenCode, VS Code (Claude / Local harness)
 * - `~/.copilot/skills`  GitHub Copilot CLI and the VS Code Copilot harness
 * - `~/.agents/skills`   Codex, pi, DeepSeek Harness, OpenCode, VS Code Local
 *
 * Clients that read more than one root (OpenCode, VS Code Local) may list the
 * same skill twice. The files are identical and name collisions resolve to the
 * first discovery, so this is cosmetic rather than a correctness problem.
 */
export const SKILL_ROOTS = [
  path.join(home, ".claude", "skills"),
  path.join(home, ".copilot", "skills"),
  path.join(home, ".agents", "skills"),
] as const;

/**
 * Always-on instructions have no shared path. Each tool reads its own
 * AGENTS/CLAUDE file, so the same managed block is merged into all of them.
 */
export const INSTRUCTION_FILES = [
  path.join(home, ".claude", "CLAUDE.md"),
  path.join(home, ".config", "opencode", "AGENTS.md"),
  path.join(home, ".pi", "agent", "AGENTS.md"),
  path.join(home, ".dsh", "AGENTS.md"),
] as const;

// Always-on instructions -> individual Copilot file per instruction.
const COPILOT_INSTRUCTIONS_DIR = path.join(home, ".copilot", "instructions");

export function generateOutputs(skills: ResolvedSkill[]): OutputFile[] {
  const outputs: OutputFile[] = [];
  const instructions = skills.filter(
    (s) => s.frontmatter.type === "instruction",
  );
  const skillEntries = skills.filter((s) => s.frontmatter.type === "skill");

  // On-demand skills -> every native global skills root.
  for (const root of SKILL_ROOTS) {
    for (const s of skillEntries) {
      outputs.push({
        path: path.join(root, s.frontmatter.name, "SKILL.md"),
        content: renderSkillMarkdown(s),
        mergeStrategy: "overwrite",
      });
    }
  }

  // Always-on instructions -> individual Copilot file per skill.
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

  // Always-on instructions -> one managed block in each instruction file.
  // Empty content when there are no instructions — writer removes the block.
  const instructionContent = instructions
    .map((s) => s.baseContent)
    .join("\n\n");

  for (const instructionFile of INSTRUCTION_FILES) {
    outputs.push({
      path: instructionFile,
      content: instructionContent,
      mergeStrategy: "section-marker",
    });
  }

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
 * its installed dir under each native skills root, preserving nested paths, so
 * the skill can reference bundled assets at a predictable location at runtime.
 */
export async function generateAssetOutputs(
  skills: ResolvedSkill[],
): Promise<OutputFile[]> {
  const outputs: OutputFile[] = [];
  const skillEntries = skills.filter((s) => s.frontmatter.type === "skill");
  for (const s of skillEntries) {
    const assetFiles = await listSkillAssets(s.skillDir);
    const contents: Array<{ rel: string; content: string }> = [];
    for (const rel of assetFiles) {
      contents.push({
        rel,
        content: await fs.readFile(path.join(s.skillDir, rel), "utf-8"),
      });
    }
    for (const root of SKILL_ROOTS) {
      for (const { rel, content } of contents) {
        outputs.push({
          path: path.join(root, s.frontmatter.name, rel),
          content,
          mergeStrategy: "overwrite",
        });
      }
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

/**
 * Render a portable Agent Skills `SKILL.md`. The output keeps only the fields
 * the Agent Skills specification defines (plus the widely supported
 * `disable-model-invocation`), so the same file is valid for Claude Code,
 * Copilot, pi, DSH, and OpenCode.
 */
export function renderSkillMarkdown(skill: ResolvedSkill): string {
  const fm = skill.frontmatter;
  const data: Record<string, unknown> = {
    name: fm.name,
    description: fm.description,
  };
  if (!fm["auto-trigger"]) data["disable-model-invocation"] = true;
  // Keep descriptions on one line — strict clients have historically tripped
  // on folded scalars.
  return stringifyFrontmatter(`${skill.baseContent.trimEnd()}\n`, data, {
    lineWidth: -1,
  });
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
