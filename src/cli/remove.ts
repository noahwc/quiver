import * as p from "@clack/prompts";
import pc from "picocolors";
import * as os from "node:os";
import * as path from "node:path";
import {
  readGlobalConfig,
  writeGlobalConfig,
  removeSkillFromConfig,
} from "../core/config.js";
import { selectSkillsToRemove } from "../tui/skill-browser.js";
import { removeSkillFromMarkdown, removeSkillFiles } from "../transpiler/writers/markdown-writer.js";

export async function remove(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver remove ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.error("No quiver config found. Run `quiver add` first.");
    process.exit(1);
  }

  const toRemove = await selectSkillsToRemove(config.skills);
  if (toRemove.length === 0) {
    p.outro(pc.yellow("No skills to remove."));
    return;
  }

  let updated = config;
  for (const name of toRemove) {
    updated = removeSkillFromConfig(updated, name);
    await removeSkillFromMarkdown(
      path.join(os.homedir(), ".claude", "CLAUDE.md"),
      name,
    );
    await removeSkillFromMarkdown(
      path.join(os.homedir(), ".config", "opencode", "AGENTS.md"),
      name,
    );
    await removeSkillFiles(name);
    p.log.step(`Removed ${pc.red(name)}`);
  }

  await writeGlobalConfig(updated);
  p.outro(pc.green("Done!"));
}
