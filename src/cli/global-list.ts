import * as p from "@clack/prompts";
import pc from "picocolors";
import { readGlobalConfig } from "../core/config.js";

export async function globalList(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver global-list ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.info("No global quiver config found. Run `quiver global-add` to install skills.");
    return;
  }

  if (config.skills.length === 0) {
    p.log.info("No skills installed globally.");
    return;
  }

  p.log.info(`Tools: ${config.tools.join(", ")}`);
  console.log("");

  for (const skill of config.skills) {
    const source = skill.url === "builtin" ? pc.dim("[builtin]") : pc.cyan("[third-party]");
    console.log(`  ${pc.bold(skill.name)} ${source}`);
    console.log(`    ${pc.dim(skill.url)}`);
  }

  console.log("");
  p.outro(pc.green(`${config.skills.length} skill(s) installed globally.`));
}
