#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./init.js";
import { add } from "./add.js";
import { remove } from "./remove.js";
import { build } from "./build.js";
import { update } from "./update.js";
import { globalAdd } from "./global-add.js";
import { globalRemove } from "./global-remove.js";
import { globalUpdate } from "./global-update.js";
import { globalList } from "./global-list.js";

const program = new Command();

program
  .name("quiver")
  .description("Manage AI coding assistant skills across Claude Code, OpenCode, and GitHub Copilot")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize quiver in the current project")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await init(process.cwd(), { dryRun: opts.dryRun });
  });

program
  .command("add")
  .description("Add new skills to the project")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await add(process.cwd(), { dryRun: opts.dryRun });
  });

program
  .command("remove")
  .description("Remove skills from the project")
  .action(async () => {
    await remove(process.cwd());
  });

program
  .command("build")
  .description("Generate output files from installed skills")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await build(process.cwd(), { dryRun: opts.dryRun });
  });

program
  .command("update")
  .description("Re-fetch third-party skills and rebuild outputs")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await update(process.cwd(), { dryRun: opts.dryRun });
  });

program
  .command("global-add")
  .description("Add skills globally (~/.quiver/) for all projects")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await globalAdd(process.cwd(), { dryRun: opts.dryRun });
  });

program
  .command("global-remove")
  .description("Remove globally installed skills")
  .action(async () => {
    await globalRemove();
  });

program
  .command("global-update")
  .description("Re-fetch third-party skills and rebuild global outputs")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await globalUpdate({ dryRun: opts.dryRun });
  });

program
  .command("global-list")
  .description("List globally installed skills")
  .action(async () => {
    await globalList();
  });

program.parse();
