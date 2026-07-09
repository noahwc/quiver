import * as p from "@clack/prompts";
import pc from "picocolors";
import * as os from "node:os";
import * as path from "node:path";
import { readGlobalConfig, writeGlobalConfig, removeSkillFromConfig } from "../core/config.js";
import { selectSkillsToRemove } from "../tui/skill-browser.js";
import { removeSkillFromMarkdown, removeSkillFiles } from "../transpiler/writers/markdown-writer.js";

export async function globalRemove(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver global-remove ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.error("No global quiver config found. Run `quiver global-add` first.");
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
    p.log.step(`Removed ${pc.red(name)}`);

    for (const tool of config.tools) {
      if (tool === "claude") {
        await removeSkillFromMarkdown(path.join(os.homedir(), ".claude", "CLAUDE.md"), name);
      } else if (tool === "opencode") {
        await removeSkillFromMarkdown(path.join(os.homedir(), ".config", "opencode", "AGENTS.md"), name);
      }
      await removeSkillFiles("", name, tool, "global");
    }
  }

  await writeGlobalConfig(updated);
  p.outro(pc.green("Done!"));
}
