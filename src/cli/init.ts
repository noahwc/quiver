import * as p from "@clack/prompts";
import pc from "picocolors";
import { type ToolTarget } from "../core/types.js";
import { readConfig, initConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { generateEfficiencyMd } from "../core/efficiency.js";
import { selectTools } from "../tui/tool-select.js";
import { selectSkills } from "../tui/skill-browser.js";
import { fetchThirdPartySkills, ensureProjectCache } from "./shared.js";

interface InitOptions {
  dryRun?: boolean;
}

export async function init(projectDir: string, options: InitOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver init ")));

  const existing = await readConfig(projectDir);

  const tools: ToolTarget[] = existing
    ? existing.tools
    : await selectTools();

  const skills = await selectSkills(existing?.skills ?? []);

  if (!options.dryRun) {
    await initConfig(projectDir, tools, skills);
    p.log.success("Created quiver.json");
  } else {
    p.log.info("[dry-run] Would create quiver.json");
  }

  const cacheDir = await ensureProjectCache(projectDir);
  await fetchThirdPartySkills(skills, cacheDir, options.dryRun);

  const resolved = await loadAllSkills(skills, cacheDir);

  if (!options.dryRun) {
    await transpileBuild(resolved, tools, "project");
    p.log.success("Generated output files");

    await generateEfficiencyMd(projectDir);
    p.log.success("Created EFFICIENCY.md");
  } else {
    p.log.info("[dry-run] Would generate output files and EFFICIENCY.md");
  }

  p.outro(pc.green("Done! Run `quiver build` to regenerate outputs at any time."));
}
