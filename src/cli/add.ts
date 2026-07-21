import * as p from "@clack/prompts";
import pc from "picocolors";
import { type QuiverConfigSkill } from "../core/types.js";
import {
  readGlobalConfig,
  ensureGlobalConfig,
  addSkillToConfig,
  writeGlobalConfig,
} from "../core/config.js";
import { selectSkills, selectSkillsToAdd } from "../tui/skill-browser.js";
import { sync } from "../core/sync.js";

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

  await sync({ dryRun: options.dryRun });

  p.outro(pc.green("Done!"));
}
