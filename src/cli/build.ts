import * as p from "@clack/prompts";
import pc from "picocolors";
import { readConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { ensureProjectCache } from "./shared.js";

interface BuildOptions {
  dryRun?: boolean;
}

export async function build(projectDir: string, options: BuildOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver build ")));

  const config = await readConfig(projectDir);
  if (!config) {
    p.log.error("No quiver.json found. Run `quiver init` first.");
    process.exit(1);
  }

  const cacheDir = await ensureProjectCache(projectDir);
  const resolved = await loadAllSkills(config.skills, cacheDir);

  await transpileBuild(resolved, config.tools, "project", options);

  if (!options.dryRun) {
    p.log.success("Output files generated");
  }

  p.outro(pc.green("Done!"));
}
