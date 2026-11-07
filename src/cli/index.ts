#!/usr/bin/env node

import { Command } from "commander";
import { add } from "./add.js";
import { remove } from "./remove.js";
import { list } from "./list.js";
import { syncCommand } from "./sync.js";
import { exportCommand } from "./export.js";

const program = new Command();

program
  .name("quiver")
  .description(
    "Install AI coding skills globally for Claude Code, OpenCode, GitHub Copilot, pi, and DeepSeek Harness",
  )
  .version("0.1.0");

program
  .command("add")
  .description("Install skills globally (~/.quiver/) for all projects")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await add({ dryRun: opts.dryRun });
  });

program
  .command("remove")
  .description("Remove installed skills")
  .action(async () => {
    await remove();
  });

program
  .command("sync")
  .description("Sync outputs with current config")
  .option("--refresh", "Re-fetch all third-party skills from GitHub")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await syncCommand({ refresh: opts.refresh, dryRun: opts.dryRun });
  });

program
  .command("list")
  .description("List installed skills")
  .action(async () => {
    await list();
  });

program
  .command("export")
  .description("Generate a publishable Agent Plugin repository")
  .option("--out <dir>", "Output directory", "dist/quiver-plugin")
  .option("--from-config", "Export only the built-in skills in ~/.quiver")
  .option(
    "--subtree",
    "Emit only plugin.json + skills/ for a subdirectory of another repo",
  )
  .option(
    "--include-third-party",
    "Not supported yet: third-party skills are not vendored",
  )
  .option("--force", "Overwrite an existing output directory")
  .option("--dry-run", "Print planned files without writing")
  .action(async (opts) => {
    await exportCommand({
      out: opts.out,
      fromConfig: opts.fromConfig,
      includeThirdParty: opts.includeThirdParty,
      subtree: opts.subtree,
      force: opts.force,
      dryRun: opts.dryRun,
    });
  });

program.parse();
