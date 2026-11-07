import * as path from "node:path";
import pc from "picocolors";
import { readGlobalConfig } from "../core/config.js";
import { discoverAllSkills } from "../core/skill-discovery.js";
import { loadAllSkills } from "../core/skill-loader.js";
import { type QuiverConfigSkill } from "../core/types.js";
import {
  DEFAULT_PLUGIN_REPO,
  buildPluginRepo,
  writePluginRepo,
} from "../export/plugin.js";
import { collectPortableSkills } from "../export/portable.js";
import { readPluginMeta } from "../export/meta.js";

export interface ExportOptions {
  out?: string;
  fromConfig?: boolean;
  includeThirdParty?: boolean;
  force?: boolean;
  dryRun?: boolean;
  /** Emit only plugin.json + skills/, for a subdirectory of another repo. */
  subtree?: boolean;
}

export async function exportCommand(
  options: ExportOptions = {},
): Promise<void> {
  if (options.includeThirdParty) {
    throw new Error(
      "Third-party skills are not exported: they are fetched from upstream by the CLI, and vendoring them changes licensing and update semantics. Use `quiver sync --refresh` for those.",
    );
  }

  const outDir = path.resolve(
    process.cwd(),
    options.out ?? path.join("dist", "quiver-plugin"),
  );

  const entries = await selectEntries(options.fromConfig);
  if (entries.length === 0) {
    throw new Error("No built-in skills found to export.");
  }

  const resolved = await loadAllSkills(entries);
  const selection = await collectPortableSkills(resolved);
  if (selection.skills.length === 0) {
    throw new Error(
      "No portable skills selected. Always-on instructions are CLI-only and cannot be exported as an Agent Plugin.",
    );
  }

  const meta = await readPluginMeta();
  const files = buildPluginRepo(selection, {
    meta,
    repo: DEFAULT_PLUGIN_REPO,
    subtree: options.subtree,
  });

  await writePluginRepo(files, outDir, {
    force: options.force,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log(
      pc.dim(
        `Would generate ${files.length} files for ${selection.skills.length} skills in ${outDir}`,
      ),
    );
    return;
  }

  console.log(
    pc.green(
      `Generated ${selection.skills.length} skills (${files.length} files) in ${outDir}`,
    ),
  );
  if (selection.excludedInstructions.length > 0) {
    console.log(
      pc.yellow(
        `Excluded always-on instructions (CLI-only): ${selection.excludedInstructions.join(", ")}`,
      ),
    );
  }
  if (options.subtree) {
    console.log(
      pc.dim(
        "Subtree generated; point a root .claude-plugin/marketplace.json at it.",
      ),
    );
  } else {
    console.log(pc.dim(`Publish to github.com/${DEFAULT_PLUGIN_REPO}`));
  }
}

async function selectEntries(
  fromConfig?: boolean,
): Promise<QuiverConfigSkill[]> {
  if (fromConfig) {
    const config = await readGlobalConfig();
    if (!config) {
      throw new Error("No quiver config found. Run `quiver add` first.");
    }
    const builtin = config.skills.filter((s) => s.url === "builtin");
    const skipped = config.skills.length - builtin.length;
    if (skipped > 0) {
      console.warn(
        pc.yellow(
          `Skipping ${skipped} third-party skill(s); only built-in skills are exported.`,
        ),
      );
    }
    return builtin;
  }

  const discovered = await discoverAllSkills();
  return discovered
    .filter((skill) => skill.url === "builtin")
    .map((skill) => ({ name: skill.name, url: "builtin" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
