import * as p from "@clack/prompts";
import pc from "picocolors";
import { sync } from "../core/sync.js";

export async function syncCommand(
  options: { refresh?: boolean; dryRun?: boolean } = {},
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" quiver sync ")));

  try {
    await sync(options);
    p.log.success("All outputs up to date");
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  p.outro(pc.green("Done!"));
}
