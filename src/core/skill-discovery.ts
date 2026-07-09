import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import {
  type QuiverConfigSkill,
  type SkillCategory,
  type SkillType,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DiscoveredSkill {
  name: string;
  description: string;
  category: SkillCategory;
  type: SkillType;
  "auto-trigger": boolean;
  url: string;
}

function skillsDir(): string {
  return path.resolve(__dirname, "../../skills");
}

function thirdPartyDir(): string {
  return path.resolve(__dirname, "../../third-party-references");
}

export async function discoverAllSkills(): Promise<DiscoveredSkill[]> {
  const [builtin, thirdParty] = await Promise.all([
    discoverBuiltinSkills(),
    discoverThirdPartySkills(),
  ]);
  return [...builtin, ...thirdParty];
}

export async function discoverBuiltinSkills(): Promise<DiscoveredSkill[]> {
  const dir = skillsDir();
  const skills: DiscoveredSkill[] = [];

  try {
    const entries = await scanSkillDirs(dir);
    for (const skillPath of entries) {
      const skill = await readBuiltinSkill(skillPath);
      if (skill) skills.push(skill);
    }
  } catch {
    // skills dir doesn't exist yet
  }

  return skills;
}

export async function discoverThirdPartySkills(): Promise<DiscoveredSkill[]> {
  const dir = thirdPartyDir();
  const skills: DiscoveredSkill[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const refPath = path.resolve(dir, entry.name, "reference.json");
      try {
        const raw = await fs.readFile(refPath, "utf-8");
        const data = JSON.parse(raw);
        skills.push({
          name: data.name,
          description: data.description,
          category: data.category,
          type: data.type,
          "auto-trigger": data["auto-trigger"] ?? true,
          url: data.url,
        });
      } catch {
        // skip invalid references
      }
    }
  } catch {
    // third-party dir doesn't exist yet
  }

  return skills;
}

async function scanSkillDirs(baseDir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.resolve(baseDir, entry.name);
    if (entry.isDirectory()) {
      const hasSkill = await fileExists(path.resolve(full, "SKILL.md"));
      if (hasSkill) {
        results.push(full);
      } else {
        const nested = await scanSkillDirs(full);
        results.push(...nested);
      }
    }
  }

  return results;
}

async function readBuiltinSkill(skillDir: string): Promise<DiscoveredSkill | null> {
  const mdPath = path.resolve(skillDir, "SKILL.md");
  try {
    const raw = await fs.readFile(mdPath, "utf-8");
    const { data } = matter(raw);
    return {
      name: data.name,
      description: data.description,
      category: data.category,
      type: data.type,
      "auto-trigger": data["auto-trigger"] ?? true,
      url: "builtin",
    };
  } catch {
    return null;
  }
}

export function getInstalledSkillNames(configSkills: QuiverConfigSkill[]): Set<string> {
  return new Set(configSkills.map((s) => s.name));
}

export function getUninstalledSkills(
  available: DiscoveredSkill[],
  installed: Set<string>
): DiscoveredSkill[] {
  return available.filter((s) => !installed.has(s.name));
}

export function toConfigSkill(skill: DiscoveredSkill): QuiverConfigSkill {
  return { name: skill.name, url: skill.url };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
