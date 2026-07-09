import * as p from "@clack/prompts";
import pc from "picocolors";
import { parseSkillUrl } from "../core/types.js";
import { readConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { fetchSkill, getProjectCacheDir, ensureCacheDir } from "../third-party/github.js";

interface UpdateOptions {
  dryRun?: boolean;
}

export async function update(projectDir: string, options: UpdateOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver update ")));

  const config = await readConfig(projectDir);
  if (!config) {
    p.log.error("No quiver.json found. Run `quiver init` first.");
    process.exit(1);
  }

  const cacheDir = getProjectCacheDir(projectDir);
  await ensureCacheDir(cacheDir);

  const thirdParty = config.skills.filter((s) => s.url !== "builtin");

  if (thirdParty.length > 0) {
    const s = p.spinner();
    s.start("Re-fetching third-party skills...");

    for (const entry of thirdParty) {
      try {
        const source = parseSkillUrl(entry.url);
        await fetchSkill(source, cacheDir);
        s.message(`Fetched ${entry.name}`);
      } catch (err) {
        s.message(`Failed to fetch ${entry.name}: ${err}`);
      }
    }

    s.stop("Third-party skills updated");
  }

  const resolved = await loadAllSkills(config.skills, cacheDir);

  if (!options.dryRun) {
    await transpileBuild(resolved, config.tools, "project");
    p.log.success("Output files regenerated");
  } else {
    p.log.info("[dry-run] Would regenerate output files");
  }

  p.outro(pc.green("Done!"));
}
