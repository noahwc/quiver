import * as p from "@clack/prompts";
import pc from "picocolors";
import { readGlobalConfig } from "../core/config.ts";

export async function list(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver list ")));

  const config = await readGlobalConfig();
  if (!config || config.skills.length === 0) {
    p.log.info("No skills installed. Run `quiver add` to install skills.");
    return;
  }

  console.log("");
  for (const skill of config.skills) {
    const source =
      skill.url === "builtin" ? pc.dim("[builtin]") : pc.cyan("[third-party]");
    console.log(`  ${pc.bold(skill.name)} ${source}`);
    console.log(`    ${pc.dim(skill.url)}`);
  }
  console.log("");

  p.outro(pc.green(`${config.skills.length} skill(s) installed.`));
}
