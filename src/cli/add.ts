import * as p from "@clack/prompts";
import pc from "picocolors";
import { type QuiverConfigSkill } from "../core/types.js";
import {
  readGlobalConfig,
  ensureGlobalConfig,
  addSkillToConfig,
  writeGlobalConfig,
} from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build } from "../transpiler/index.js";
import { selectSkills, selectSkillsToAdd } from "../tui/skill-browser.js";
import {
  getGlobalCacheDir,
  ensureCacheDir,
  fetchThirdPartySkills,
} from "../third-party/github.js";

interface AddOptions {
  dryRun?: boolean;
}

export async function add(options: AddOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver add ")));

  let config = await readGlobalConfig();

  let newSkills: QuiverConfigSkill[];
  if (!config) {
    newSkills = await selectSkills([]);
  } else {
    newSkills = await selectSkillsToAdd(config.skills);
  }

  if (newSkills.length === 0) {
    p.outro(pc.yellow("No skills to add."));
    return;
  }

  if (!config) {
    config = await ensureGlobalConfig(newSkills);
  } else {
    for (const skill of newSkills) {
      config = addSkillToConfig(config, skill);
      p.log.step(`Added ${pc.cyan(skill.name)}`);
    }
    if (!options.dryRun) {
      await writeGlobalConfig(config);
    }
  }

  const cacheDir = getGlobalCacheDir();
  await ensureCacheDir(cacheDir);

  if (!options.dryRun) {
    const s = p.spinner();
    s.start("Fetching third-party skills...");
    const failed = await fetchThirdPartySkills(
      config.skills,
      cacheDir,
      (name) => s.message(`Fetched ${name}`),
    );
    s.stop(
      failed.length
        ? `Failed: ${failed.join(", ")}`
        : "Third-party skills ready",
    );
  }

  const resolved = await loadAllSkills(config.skills, cacheDir);

  if (!options.dryRun) {
    await build(resolved);
    p.log.success("Generated user-level output files");
  } else {
    p.log.info("[dry-run] Would generate user-level output files");
  }

  p.outro(pc.green("Done!"));
}
