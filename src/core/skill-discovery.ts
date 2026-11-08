import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./frontmatter.ts";
import { type QuiverConfigSkill, type SkillType } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DiscoveredSkill {
  name: string;
  description: string;
  type: SkillType;
  "auto-trigger": boolean;
  url: string;
  /** Names of catalog skills this skill delegates to and cannot work without. */
  requires?: string[];
}

function skillsDir(): string {
  return path.resolve(__dirname, "../../skills");
}

function registryPath(): string {
  return path.resolve(__dirname, "../../registry.json");
}

export async function discoverAllSkills(): Promise<DiscoveredSkill[]> {
  const [builtin, thirdParty] = await Promise.all([
    discoverBuiltinSkills(),
    discoverThirdPartySkills(),
  ]);
  return [...builtin, ...thirdParty];
}

async function discoverBuiltinSkills(): Promise<DiscoveredSkill[]> {
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

async function discoverThirdPartySkills(): Promise<DiscoveredSkill[]> {
  try {
    const raw = await fs.readFile(registryPath(), "utf-8");
    const entries = JSON.parse(raw) as Array<{
      name: string;
      description: string;
      type: string;
      "auto-trigger": boolean;
      requires?: string[];
      url: string;
    }>;
    return entries.map((e) => ({
      name: e.name,
      description: e.description,
      type: (e.type ?? "skill") as SkillType,
      "auto-trigger": e["auto-trigger"] ?? true,
      url: e.url,
      requires: e.requires,
    }));
  } catch {
    return [];
  }
}

async function scanSkillDirs(baseDir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.resolve(baseDir, entry.name);
    if (entry.isDirectory()) {
      try {
        await fs.access(path.resolve(full, "SKILL.md"));
        results.push(full);
      } catch {
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
    const { data } = parseFrontmatter(raw);
    return {
      name: data.name as string,
      description: data.description as string,
      type: ((data.type as string | undefined) ?? "skill") as SkillType,
      "auto-trigger": (data["auto-trigger"] as boolean | undefined) ?? true,
      url: "builtin",
      requires: Array.isArray(data.requires) ? (data.requires as string[]) : undefined,
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
  installed: Set<string>,
): DiscoveredSkill[] {
  return available.filter((s) => !installed.has(s.name));
}

export function toConfigSkill(skill: DiscoveredSkill): QuiverConfigSkill {
  return { name: skill.name, url: skill.url };
}
