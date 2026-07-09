import * as p from "@clack/prompts";
import pc from "picocolors";
import { readGlobalConfig } from "../core/config.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { build } from "../transpiler/index.js";
import {
  getGlobalCacheDir,
  ensureCacheDir,
  fetchThirdPartySkills,
} from "../third-party/github.js";

interface UpdateOptions {
  dryRun?: boolean;
}

export async function update(options: UpdateOptions = {}): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver update ")));

  const config = await readGlobalConfig();
  if (!config) {
    p.log.error("No quiver config found. Run `quiver add` first.");
    process.exit(1);
  }

  const cacheDir = getGlobalCacheDir();
  await ensureCacheDir(cacheDir);

  const s = p.spinner();
  s.start("Re-fetching third-party skills...");
  const failed = await fetchThirdPartySkills(config.skills, cacheDir, (name) =>
    s.message(`Fetched ${name}`),
  );
  s.stop(
    failed.length
      ? `Failed: ${failed.join(", ")}`
      : "Third-party skills updated",
  );

  const resolved = await loadAllSkills(config.skills, cacheDir);

  if (!options.dryRun) {
    await build(resolved);
    p.log.success("User-level output files regenerated");
  } else {
    p.log.info("[dry-run] Would regenerate user-level output files");
  }

  p.outro(pc.green("Done!"));
}
