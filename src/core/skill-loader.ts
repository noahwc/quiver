import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type QuiverConfigSkill,
  type ResolvedSkill,
  type SkillSource,
  SKILL_NAME_REGEX,
  parseSkillUrl,
} from "./types.ts";
import { safeCacheName } from "./paths.ts";
import { parseSkill } from "../transpiler/parser.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function skillsDir(): string {
  return path.resolve(__dirname, "../../skills");
}

export async function loadSkill(
  entry: QuiverConfigSkill,
  cacheDir?: string
): Promise<ResolvedSkill> {
  if (!SKILL_NAME_REGEX.test(entry.name)) {
    throw new Error(
      `Invalid skill name: "${entry.name}". Must match ${SKILL_NAME_REGEX.source}`,
    );
  }

  const source = parseSkillUrl(entry.url);
  const skillDir = await resolveSkillDir(entry, source, cacheDir);
  const skillMdPath = path.resolve(skillDir, "SKILL.md");

  let raw: string;
  try {
    raw = await fs.readFile(skillMdPath, "utf-8");
  } catch {
    throw new Error(`Skill SKILL.md not found at ${skillMdPath}`);
  }

  const parsed = parseSkill(raw);
  return { ...parsed, source, skillDir };
}

export async function loadAllSkills(
  entries: QuiverConfigSkill[],
  cacheDir?: string
): Promise<ResolvedSkill[]> {
  const skills: ResolvedSkill[] = [];
  for (const entry of entries) {
    skills.push(await loadSkill(entry, cacheDir));
  }
  return skills;
}

async function resolveSkillDir(
  entry: QuiverConfigSkill,
  source: SkillSource,
  cacheDir?: string
): Promise<string> {
  if (source.type === "builtin") {
    const found = await findWithCategory(entry.name);
    if (found) return found;
    throw new Error(`Built-in skill "${entry.name}" not found in skills/ directory`);
  }

  if (cacheDir) {
    const skillName = safeCacheName(path.basename(source.path) || entry.name);
    return path.resolve(cacheDir, skillName);
  }

  throw new Error(
    `Third-party skill "${entry.name}" needs to be fetched first. Run "quiver init" or "quiver update".`
  );
}

async function findWithCategory(name: string): Promise<string | null> {
  const base = skillsDir();
  const entries = await fs.readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.resolve(base, entry.name, name);
    try {
      await fs.access(path.resolve(candidate, "SKILL.md"));
      return candidate;
    } catch {
      continue;
    }
  }
  try {
    await fs.access(path.resolve(base, name, "SKILL.md"));
    return path.resolve(base, name);
  } catch {
    return null;
  }
}
