import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import { type QuiverConfigSkill, parseSkillUrl } from "./types.js";
import {
  readGlobalConfig,
  globalCachePath,
  readManifest,
  writeManifest,
} from "./config.js";
import { loadAllSkills } from "./skill-loader.js";
import { discoverAllSkills } from "./skill-discovery.js";
import { withDependencies } from "./dependencies.js";
import { generateOutputs, generateAssetOutputs } from "../transpiler/index.js";
import { writeOutputs } from "../transpiler/writers/markdown-writer.js";
import { fetchThirdPartySkills } from "../third-party/github.js";

export interface SyncOptions {
  refresh?: boolean;
  dryRun?: boolean;
}

export async function sync(options: SyncOptions = {}): Promise<void> {
  const config = await readGlobalConfig();
  if (!config) {
    throw new Error("No quiver config found. Run `quiver add` first.");
  }

  const cacheDir = globalCachePath();
  await fs.mkdir(cacheDir, { recursive: true });

  const skillsToInstall = withDependencies(
    config.skills,
    await discoverAllSkills(),
  );
  const thirdParty = skillsToInstall.filter((s) => s.url !== "builtin");
  const toFetch = options.refresh
    ? thirdParty
    : await getMissingFromCache(thirdParty, cacheDir);

  if (toFetch.length > 0) {
    const s = p.spinner();
    s.start("Fetching third-party skills...");
    const failed = await fetchThirdPartySkills(toFetch, cacheDir, (name) =>
      s.message(`Fetched ${name}`),
    );
    if (failed.length > 0) {
      s.stop(`Failed to fetch: ${failed.join(", ")}`);
      throw new Error(`Sync aborted: could not fetch ${failed.join(", ")}`);
    }
    s.stop("Third-party skills ready");
  }

  const skills = await loadAllSkills(skillsToInstall, cacheDir);
  const outputs = [
    ...generateOutputs(skills),
    ...(await generateAssetOutputs(skills)),
  ];
  const manifest = await readManifest();

  if (options.dryRun) {
    const desiredOverwrites = outputs
      .filter((o) => o.mergeStrategy === "overwrite")
      .map((o) => o.path);
    const stale = manifest.files.filter((f) => !desiredOverwrites.includes(f));
    for (const o of outputs) {
      console.log(`[dry-run] Would write: ${o.path}`);
    }
    for (const f of stale) {
      console.log(`[dry-run] Would delete: ${f}`);
    }
    return;
  }

  await writeOutputs(outputs);

  const desiredOverwrites = new Set(
    outputs.filter((o) => o.mergeStrategy === "overwrite").map((o) => o.path),
  );
  const stale = manifest.files.filter((f) => !desiredOverwrites.has(f));
  for (const f of stale) {
    await fs.rm(f, { force: true }).catch(() => {});
  }

  await writeManifest({ files: [...desiredOverwrites].sort() });
}

async function getMissingFromCache(
  skills: QuiverConfigSkill[],
  cacheDir: string,
): Promise<QuiverConfigSkill[]> {
  const missing: QuiverConfigSkill[] = [];
  for (const s of skills) {
    const source = parseSkillUrl(s.url);
    if (source.type !== "github") continue;
    const skillName = path.basename(source.path) || s.name;
    const cachedSkillMd = path.join(cacheDir, skillName, "SKILL.md");
    try {
      await fs.access(cachedSkillMd);
    } catch {
      missing.push(s);
    }
  }
  return missing;
}
