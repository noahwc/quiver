import * as p from "@clack/prompts";
import pc from "picocolors";
import { type ToolTarget, type QuiverConfigSkill } from "../core/types.js";
import { readGlobalConfig, ensureGlobalConfig, addSkillToConfig, writeGlobalConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { selectSkillsToAdd, selectSkills } from "../tui/skill-browser.js";
import { getGlobalCacheDir, ensureCacheDir } from "../third-party/github.js";
import { fetchThirdPartySkillsByUrls } from "./shared.js";

interface GlobalAddOptions {
  dryRun?: boolean;
}

export async function globalAdd(projectDir: string, options: GlobalAddOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver global-add ")));

  let config = await readGlobalConfig();

  let tools: ToolTarget[];
  let newSkills: QuiverConfigSkill[];

  if (!config) {
    const { selectTools } = await import("../tui/tool-select.js");
    tools = await selectTools();
    newSkills = await selectSkills([]);
  } else {
    tools = config.tools;
    newSkills = await selectSkillsToAdd(config.skills);
  }

  if (newSkills.length === 0) {
    if (!config) {
      p.log.info("No skills selected. Run `quiver global-add` again to add skills.");
    } else {
      p.outro(pc.yellow("No new skills to add."));
    }
    return;
  }

  if (!config) {
    config = await ensureGlobalConfig(tools, newSkills);
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
  await fetchThirdPartySkillsByUrls(config.skills, cacheDir, options.dryRun);

  const resolved = await loadAllSkills(config.skills, cacheDir);

  if (!options.dryRun) {
    await transpileBuild(resolved, config.tools, "global");
    p.log.success("Generated user-level output files");
  } else {
    p.log.info("[dry-run] Would generate user-level output files");
  }

  p.outro(pc.green("Done!"));
}
