import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type ResolvedSkill,
  SKILL_NAME_REGEX,
} from "../core/types.js";
import { renderSkillMarkdown } from "../transpiler/index.js";

export interface PortableSkill {
  name: string;
  description: string;
  skillDir: string;
  /** Rendered SKILL.md with Agent Skills + portable frontmatter only. */
  content: string;
  /** POSIX-relative paths of every bundled file except SKILL.md. */
  assets: string[];
}

export interface PortableSelection {
  skills: PortableSkill[];
  /** Instruction skills that cannot be represented in an Agent Plugins package. */
  excludedInstructions: string[];
}

const MAX_DESCRIPTION_LENGTH = 1024;

export function validatePortableSkill(skill: ResolvedSkill): void {
  const { name, description } = skill.frontmatter;
  if (!SKILL_NAME_REGEX.test(name)) {
    throw new Error(
      `Skill "${name}" cannot be exported: name must match ${SKILL_NAME_REGEX.source}`,
    );
  }
  if (!description || description.trim().length === 0) {
    throw new Error(`Skill "${name}" cannot be exported: description is empty`);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Skill "${name}" cannot be exported: description is ${description.length} characters (max ${MAX_DESCRIPTION_LENGTH})`,
    );
  }
}

/**
 * Split a resolved skill list into portable skills and instructions that only
 * the CLI can install. Throws on invalid or duplicate names so a broken
 * package never gets published.
 */
export async function collectPortableSkills(
  skills: ResolvedSkill[],
): Promise<PortableSelection> {
  const portable: PortableSkill[] = [];
  const excludedInstructions: string[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    if (skill.frontmatter.type === "instruction") {
      excludedInstructions.push(skill.frontmatter.name);
      continue;
    }
    validatePortableSkill(skill);
    if (seen.has(skill.frontmatter.name)) {
      throw new Error(`Duplicate skill name "${skill.frontmatter.name}"`);
    }
    seen.add(skill.frontmatter.name);
    portable.push({
      name: skill.frontmatter.name,
      description: skill.frontmatter.description,
      skillDir: skill.skillDir,
      content: renderSkillMarkdown(skill),
      assets: await listSkillAssets(skill.skillDir),
    });
  }

  portable.sort((a, b) => a.name.localeCompare(b.name));
  excludedInstructions.sort();
  return { skills: portable, excludedInstructions };
}

/**
 * Walk a skill directory and return every bundled file except the top-level
 * SKILL.md, using POSIX separators. Symlinks are allowed only when they resolve
 * inside the skill directory, matching the Agent Plugins containment rule.
 */
export async function listSkillAssets(skillDir: string): Promise<string[]> {
  const root = await fs.realpath(skillDir);
  const results: string[] = [];
  const visitedDirs = new Set<string>();

  async function walk(dir: string, prefix: string): Promise<void> {
    const realDir = await fs.realpath(dir);
    if (visitedDirs.has(realDir)) return;
    visitedDirs.add(realDir);

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;

      if (entry.isSymbolicLink()) {
        const target = await fs.realpath(full);
        if (!isWithin(root, target)) {
          throw new Error(
            `Skill "${skillDir}" has a symlink that escapes the skill directory: ${rel} -> ${target}`,
          );
        }
        const stat = await fs.stat(target);
        if (stat.isDirectory()) {
          await walk(target, rel);
        } else if (stat.isFile() && !isTopLevelSkillFile(prefix, entry.name)) {
          results.push(toPosix(rel));
        }
        continue;
      }

      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile() && !isTopLevelSkillFile(prefix, entry.name)) {
        results.push(toPosix(rel));
      }
    }
  }

  await walk(skillDir, "");
  return results.sort();
}

function isTopLevelSkillFile(prefix: string, name: string): boolean {
  return prefix === "" && name === "SKILL.md";
}

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
