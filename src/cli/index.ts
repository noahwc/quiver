#!/usr/bin/env node

import { Command } from "commander";
import { add } from "./add.js";
import { remove } from "./remove.js";
import { list } from "./list.js";
import { update } from "./update.js";

const program = new Command();

program
  .name("quiver")
  .description(
    "Install AI coding skills globally for Claude Code, OpenCode, and GitHub Copilot",
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
  .command("update")
  .description("Re-fetch third-party skills and rebuild outputs")
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) => {
    await update({ dryRun: opts.dryRun });
  });

program
  .command("list")
  .description("List installed skills")
  .action(async () => {
    await list();
  });

program.parse();
