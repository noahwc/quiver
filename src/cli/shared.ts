import * as p from "@clack/prompts";
import { type QuiverConfigSkill, parseSkillUrl } from "../core/types.js";
import { fetchSkill, getProjectCacheDir, ensureCacheDir } from "../third-party/github.js";

export async function ensureProjectCache(projectDir: string): Promise<string> {
  const cacheDir = getProjectCacheDir(projectDir);
  await ensureCacheDir(cacheDir);
  return cacheDir;
}

export async function fetchThirdPartySkills(
  skills: QuiverConfigSkill[],
  cacheDir: string,
  dryRun?: boolean
): Promise<void> {
  const thirdParty = skills.filter((s) => s.url !== "builtin");
  if (thirdParty.length === 0) return;

  const s = p.spinner();
  s.start("Fetching third-party skills...");

  for (const entry of thirdParty) {
    if (!dryRun) {
      const source = parseSkillUrl(entry.url);
      try {
        await fetchSkill(source, cacheDir);
        s.message(`Fetched ${entry.name}`);
      } catch (err) {
        s.message(`Failed to fetch ${entry.name}: ${err}`);
      }
    } else {
      s.message(`[dry-run] Would fetch ${entry.name}`);
    }
  }

  s.stop("Third-party skills ready");
}

export async function fetchThirdPartySkillsByUrls(
  skills: QuiverConfigSkill[],
  cacheDir: string,
  dryRun?: boolean
): Promise<void> {
  return fetchThirdPartySkills(skills, cacheDir, dryRun);
}
