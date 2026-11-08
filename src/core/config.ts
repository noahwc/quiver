import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  type QuiverConfig,
  type QuiverConfigSkill,
  type Manifest,
} from "./types.ts";

const CONFIG_FILENAME = "quiver.json";
const MANIFEST_FILENAME = "manifest.json";

export function globalConfigDir(): string {
  return path.resolve(os.homedir(), ".quiver");
}

export function globalCachePath(): string {
  return path.resolve(globalConfigDir(), "cache");
}

export async function readGlobalConfig(): Promise<QuiverConfig | null> {
  try {
    const raw = await fs.readFile(
      path.resolve(globalConfigDir(), CONFIG_FILENAME),
      "utf-8",
    );
    return JSON.parse(raw) as QuiverConfig;
  } catch {
    return null;
  }
}

export async function writeGlobalConfig(config: QuiverConfig): Promise<void> {
  await fs.mkdir(globalConfigDir(), { recursive: true });
  const json = JSON.stringify(config, null, 2) + "\n";
  await fs.writeFile(
    path.resolve(globalConfigDir(), CONFIG_FILENAME),
    json,
    "utf-8",
  );
}

export async function readManifest(): Promise<Manifest> {
  try {
    const raw = await fs.readFile(
      path.resolve(globalConfigDir(), MANIFEST_FILENAME),
      "utf-8",
    );
    return JSON.parse(raw) as Manifest;
  } catch {
    return { files: [] };
  }
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await fs.mkdir(globalConfigDir(), { recursive: true });
  const json = JSON.stringify(manifest, null, 2) + "\n";
  await fs.writeFile(
    path.resolve(globalConfigDir(), MANIFEST_FILENAME),
    json,
    "utf-8",
  );
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
