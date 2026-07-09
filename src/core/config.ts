import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type QuiverConfig, type QuiverConfigSkill } from "./types.js";

const CONFIG_FILENAME = "quiver.json";

export function globalConfigDir(): string {
  return path.resolve(os.homedir(), ".quiver");
}

export function globalConfigPath(): string {
  return path.resolve(globalConfigDir(), CONFIG_FILENAME);
}

export function globalCachePath(): string {
  return path.resolve(globalConfigDir(), "cache");
}

export async function readGlobalConfig(): Promise<QuiverConfig | null> {
  try {
    const raw = await fs.readFile(globalConfigPath(), "utf-8");
    return JSON.parse(raw) as QuiverConfig;
  } catch {
    return null;
  }
}

export async function writeGlobalConfig(config: QuiverConfig): Promise<void> {
  await fs.mkdir(globalConfigDir(), { recursive: true });
  const json = JSON.stringify(config, null, 2) + "\n";
  await fs.writeFile(globalConfigPath(), json, "utf-8");
}

export async function ensureGlobalConfig(
  skills: QuiverConfigSkill[],
): Promise<QuiverConfig> {
  const existing = await readGlobalConfig();
  if (existing) return existing;
  const config: QuiverConfig = {
    $schema: "https://quiver.ai/config.json",
    skills,
  };
  await writeGlobalConfig(config);
  return config;
}

export function addSkillToConfig(
  config: QuiverConfig,
  skill: QuiverConfigSkill
): QuiverConfig {
  if (config.skills.some((s) => s.name === skill.name)) {
    return config;
  }
  return { ...config, skills: [...config.skills, skill] };
}

export function removeSkillFromConfig(
  config: QuiverConfig,
  skillName: string
): QuiverConfig {
  return {
    ...config,
    skills: config.skills.filter((s) => s.name !== skillName),
  };
}
