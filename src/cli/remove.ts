import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig, writeConfig, removeSkillFromConfig } from "../core/config.js";
import { selectSkillsToRemove } from "../tui/skill-browser.js";
import { removeSkillFromMarkdown, removeSkillFiles } from "../transpiler/writers/markdown-writer.js";

export async function remove(projectDir: string): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver remove ")));

  const config = await readConfig(projectDir);
  if (!config) {
    p.log.error("No quiver.json found. Run `quiver init` first.");
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
      if (tool === "claude" || tool === "opencode") {
        const mdFile = tool === "claude" ? "CLAUDE.md" : "AGENTS.md";
        await removeSkillFromMarkdown(mdFile, name);
      }
      await removeSkillFiles(projectDir, name, tool, "project");
    }
  }

  await writeConfig(projectDir, updated);
  p.outro(pc.green("Done!"));
}
