import * as p from "@clack/prompts";
import { styleText } from "node:util";
import {
  readGlobalConfig,
  writeGlobalConfig,
  removeSkillFromConfig,
} from "../core/config.ts";
import { selectSkillsToRemove } from "../tui/skill-browser.ts";
import { sync } from "../core/sync.ts";

export async function remove(): Promise<void> {
  p.intro(styleText("bgCyan", styleText("black", " quiver remove ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.error("No quiver config found. Run `quiver add` first.");
    process.exit(1);
  }

  const toRemove = await selectSkillsToRemove(config.skills);
  if (toRemove.length === 0) {
    p.outro(styleText("yellow", "No skills to remove."));
    return;
  }

  let updated = config;
  for (const name of toRemove) {
    updated = removeSkillFromConfig(updated, name);
    p.log.step(`Removed ${styleText("red", name)}`);
  }

  await writeGlobalConfig(updated);
  await sync();

  p.outro(styleText("green", "Done!"));
}
