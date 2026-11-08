import * as p from "@clack/prompts";
import { styleText } from "node:util";
import { readGlobalConfig } from "../core/config.ts";

export async function list(): Promise<void> {
  p.intro(styleText("bgCyan", styleText("black", " quiver list ")));

  const config = await readGlobalConfig();
  if (!config || config.skills.length === 0) {
    p.log.info("No skills installed. Run `quiver add` to install skills.");
    return;
  }

  console.log("");
  for (const skill of config.skills) {
    const source =
      skill.url === "builtin"
        ? styleText("dim", "[builtin]")
        : styleText("cyan", "[third-party]");
    console.log(`  ${styleText("bold", skill.name)} ${source}`);
    console.log(`    ${styleText("dim", skill.url)}`);
  }
  console.log("");

  p.outro(styleText("green", `${config.skills.length} skill(s) installed.`));
}
