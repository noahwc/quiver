import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type QuiverConfig, type QuiverConfigSkill, type ToolTarget } from "./types.js";

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

export function configPath(projectDir: string): string {
  return path.resolve(projectDir, CONFIG_FILENAME);
}

export async function readConfig(projectDir: string): Promise<QuiverConfig | null> {
  const filePath = configPath(projectDir);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as QuiverConfig;
  } catch {
    return null;
  }
}

export async function readGlobalConfig(): Promise<QuiverConfig | null> {
  try {
    const raw = await fs.readFile(globalConfigPath(), "utf-8");
    return JSON.parse(raw) as QuiverConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(projectDir: string, config: QuiverConfig): Promise<void> {
  const filePath = configPath(projectDir);
  const json = JSON.stringify(config, null, 2) + "\n";
  await fs.writeFile(filePath, json, "utf-8");
}

export async function writeGlobalConfig(config: QuiverConfig): Promise<void> {
  await fs.mkdir(globalConfigDir(), { recursive: true });
  const json = JSON.stringify(config, null, 2) + "\n";
  await fs.writeFile(globalConfigPath(), json, "utf-8");
}

export async function initConfig(
  projectDir: string,
  tools: ToolTarget[],
  skills: QuiverConfigSkill[]
): Promise<QuiverConfig> {
  const config: QuiverConfig = {
    $schema: "https://quiver.ai/config.json",
    tools,
    skills,
  };
  await writeConfig(projectDir, config);
  return config;
}

export async function ensureGlobalConfig(
  tools: ToolTarget[],
  skills: QuiverConfigSkill[]
): Promise<QuiverConfig> {
  const existing = await readGlobalConfig();
  if (existing) return existing;
  const config: QuiverConfig = {
    $schema: "https://quiver.ai/config.json",
    tools,
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
