import * as p from "@clack/prompts";
import { styleText } from "node:util";
import { type QuiverConfigSkill } from "../core/types.ts";
import {
  readGlobalConfig,
  ensureGlobalConfig,
  addSkillToConfig,
  writeGlobalConfig,
} from "../core/config.ts";
import { selectSkills, selectSkillsToAdd } from "../tui/skill-browser.ts";
import { sync } from "../core/sync.ts";

interface AddOptions {
  dryRun?: boolean;
}

export async function add(options: AddOptions = {}): Promise<void> {
  p.intro(styleText("bgCyan", styleText("black", " quiver add ")));

  let config = await readGlobalConfig();

  let newSkills: QuiverConfigSkill[];
  if (!config) {
    newSkills = await selectSkills([]);
  } else {
    newSkills = await selectSkillsToAdd(config.skills);
  }

  if (newSkills.length === 0) {
    p.outro(styleText("yellow", "No skills to add."));
    return;
  }

  if (!config) {
    config = await ensureGlobalConfig(newSkills);
  } else {
    for (const skill of newSkills) {
      config = addSkillToConfig(config, skill);
      p.log.step(`Added ${styleText("cyan", skill.name)}`);
    }
    if (!options.dryRun) {
      await writeGlobalConfig(config);
    }
  }

  await sync({ dryRun: options.dryRun });

  p.outro(styleText("green", "Done!"));
}
