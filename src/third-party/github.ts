import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type SkillSource } from "../core/types.js";

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";

export function getProjectCacheDir(projectDir: string): string {
  return path.resolve(projectDir, "node_modules/.quiver/cache");
}

export function getGlobalCacheDir(): string {
  return path.resolve(os.homedir(), ".quiver/cache");
}

export async function ensureCacheDir(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
}

export async function isCached(cacheDir: string, skillName: string): Promise<boolean> {
  try {
    await fs.access(path.resolve(cacheDir, skillName, "SKILL.md"));
    return true;
  } catch {
    return false;
  }
}

export async function fetchSkill(
  source: SkillSource,
  cacheDir: string
): Promise<string> {
  if (source.type !== "github") {
    throw new Error("fetchSkill only supports github sources");
  }

  const skillName = path.basename(source.path) || source.repo;
  const destDir = path.resolve(cacheDir, skillName);
  await fs.mkdir(destDir, { recursive: true });

  const skillMd = await fetchRaw(source.owner, source.repo, source.ref, path.join(source.path, "SKILL.md"));
  await fs.writeFile(path.resolve(destDir, "SKILL.md"), skillMd, "utf-8");

  const refs = findReferencedFiles(skillMd);
  for (const ref of refs) {
    try {
      const content = await fetchRaw(source.owner, source.repo, source.ref, path.join(source.path, ref));
      await fs.mkdir(path.resolve(destDir, path.dirname(ref)), { recursive: true });
      await fs.writeFile(path.resolve(destDir, ref), content, "utf-8");
    } catch (err) {
      console.warn(`Could not fetch ${ref}: ${err}`);
    }
  }

  return destDir;
}

async function fetchRaw(owner: string, repo: string, ref: string, filePath: string): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${ref}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function findReferencedFiles(skillMd: string): string[] {
  const files: string[] = [];
  const re = /\[([^\]]+)\]\(\.\/([^)]+)\)/g;
  let match;
  while ((match = re.exec(skillMd)) !== null) {
    files.push(match[2]);
  }
  return files;
}
