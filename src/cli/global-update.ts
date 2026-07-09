import * as p from "@clack/prompts";
import pc from "picocolors";
import { parseSkillUrl } from "../core/types.js";
import { readGlobalConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build as transpileBuild } from "../transpiler/index.js";
import { fetchSkill, getGlobalCacheDir, ensureCacheDir } from "../third-party/github.js";

interface GlobalUpdateOptions {
  dryRun?: boolean;
}

export async function globalUpdate(options: GlobalUpdateOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver global-update ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.error("No global quiver config found. Run `quiver global-add` first.");
    process.exit(1);
  }

  const cacheDir = getGlobalCacheDir();
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
    await transpileBuild(resolved, config.tools, "global");
    p.log.success("User-level output files regenerated");
  } else {
    p.log.info("[dry-run] Would regenerate user-level output files");
  }

  p.outro(pc.green("Done!"));
}
