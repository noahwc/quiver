#!/usr/bin/env node

import { ArgumentParser } from "argparse";
import { add } from "./add.ts";
import { remove } from "./remove.ts";
import { list } from "./list.ts";
import { syncCommand } from "./sync.ts";
import { exportCommand } from "./export.ts";

const VERSION = "0.1.0";

type CommandName = "add" | "remove" | "sync" | "list" | "export";
type CliCommand = CommandName | "help";

interface CliNamespace {
  command?: CliCommand;
  target?: string;
  dry_run?: boolean;
  refresh?: boolean;
  from_config?: boolean;
  include_third_party?: boolean;
  subtree?: boolean;
  force?: boolean;
  out?: string;
}

class CliParser extends ArgumentParser {
  error(message: string): never {
    throw new Error(message);
  }
}

function buildParser(): {
  parser: ArgumentParser;
  commands: Record<CommandName, ArgumentParser>;
} {
  const parser = new CliParser({
    prog: "quiver",
    description:
      "Install AI coding skills globally for Claude Code, OpenCode, GitHub Copilot, pi, and DeepSeek Harness",
  });
  parser.add_argument("-V", "--version", {
    action: "version",
    version: VERSION,
  });

  const sub = parser.add_subparsers({
    dest: "command",
    title: "commands",
    metavar: "<command>",
    parser_class: CliParser,
  });

  const commands = {} as Record<CommandName, ArgumentParser>;
  function command(name: CommandName, description: string): ArgumentParser {
    const commandParser = sub.add_parser(name, {
      description,
      help: description,
    });
    commands[name] = commandParser;
    return commandParser;
  }

  const addCommand = command(
    "add",
    "Install skills globally (~/.quiver/) for all projects",
  );
  addCommand.add_argument("--dry-run", {
    action: "store_true",
    help: "Preview changes without writing files",
  });

  command("remove", "Remove installed skills");

  const sync = command("sync", "Sync outputs with current config");
  sync.add_argument("--refresh", {
    action: "store_true",
    help: "Re-fetch all third-party skills from GitHub",
  });
  sync.add_argument("--dry-run", {
    action: "store_true",
    help: "Preview changes without writing files",
  });

  command("list", "List installed skills");

  const exporter = command(
    "export",
    "Generate a publishable Agent Plugin repository",
  );
  exporter.add_argument("--out", {
    default: "dist/quiver-plugin",
    help: 'Output directory (default: "dist/quiver-plugin")',
  });
  exporter.add_argument("--from-config", {
    action: "store_true",
    dest: "from_config",
    help: "Export only the built-in skills in ~/.quiver",
  });
  exporter.add_argument("--subtree", {
    action: "store_true",
    help: "Emit only plugin.json + skills/ for a subdirectory of another repo",
  });
  exporter.add_argument("--include-third-party", {
    action: "store_true",
    dest: "include_third_party",
    help: "Not supported yet: third-party skills are not vendored",
  });
  exporter.add_argument("--force", {
    action: "store_true",
    help: "Overwrite an existing output directory",
  });
  exporter.add_argument("--dry-run", {
    action: "store_true",
    help: "Print planned files without writing",
  });

  const help = sub.add_parser("help", {
    description: "Show help for a command",
    help: "Show help for a command",
  });
  help.add_argument("target", {
    nargs: "?",
    choices: Object.keys(commands),
    help: "Command to show help for",
  });

  return { parser, commands };
}

async function run(argv: string[]): Promise<number> {
  const { parser, commands } = buildParser();

  let cli: CliNamespace;
  try {
    cli = parser.parse_args(argv) as CliNamespace;
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (cli.command === "help") {
    const target = cli.target as CommandName | undefined;
    if (target && commands[target]) {
      commands[target].print_help();
    } else {
      parser.print_help();
    }
    return 0;
  }

  if (!cli.command) {
    console.error(parser.format_help());
    return 1;
  }

  switch (cli.command) {
    case "add":
      await add({ dryRun: cli.dry_run === true });
      break;
    case "remove":
      await remove();
      break;
    case "sync":
      await syncCommand({
        refresh: cli.refresh === true,
        dryRun: cli.dry_run === true,
      });
      break;
    case "list":
      await list();
      break;
    case "export":
      await exportCommand({
        out: cli.out,
        fromConfig: cli.from_config === true,
        includeThirdParty: cli.include_third_party === true,
        subtree: cli.subtree === true,
        force: cli.force === true,
        dryRun: cli.dry_run === true,
      });
      break;
  }

  return 0;
}

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  },
);
