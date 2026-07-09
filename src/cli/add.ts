import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig, writeConfig, addSkillToConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { selectSkillsToAdd } from "../tui/skill-browser.js";
import { fetchThirdPartySkills, ensureProjectCache } from "./shared.js";

interface AddOptions {
  dryRun?: boolean;
}

export async function add(projectDir: string, options: AddOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver add ")));

  const config = await readConfig(projectDir);
  if (!config) {
    p.log.error("No quiver.json found. Run `quiver init` first.");
    process.exit(1);
  }

  const newSkills = await selectSkillsToAdd(config.skills);

  if (newSkills.length === 0) {
    p.outro(pc.yellow("No new skills to add."));
    return;
  }

  let updated = config;
  for (const skill of newSkills) {
    updated = addSkillToConfig(updated, skill);
    p.log.step(`Added ${pc.cyan(skill.name)}`);
  }

  if (!options.dryRun) {
    await writeConfig(projectDir, updated);
  }

  const cacheDir = await ensureProjectCache(projectDir);
  await fetchThirdPartySkills(updated.skills, cacheDir, options.dryRun);

  const resolved = await loadAllSkills(updated.skills, cacheDir);

  if (!options.dryRun) {
    await transpileBuild(resolved, updated.tools, "project");
    p.log.success("Regenerated output files");
  }

  p.outro(pc.green("Done!"));
}
