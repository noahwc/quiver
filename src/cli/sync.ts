import * as p from "@clack/prompts";
import { styleText } from "node:util";
import { sync } from "../core/sync.ts";

export async function syncCommand(
  options: { refresh?: boolean; dryRun?: boolean } = {},
): Promise<void> {
  p.intro(styleText("bgCyan", styleText("black", " quiver sync ")));

  try {
    await sync(options);
    p.log.success("All outputs up to date");
  } catch (err) {
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  p.outro(styleText("green", "Done!"));
}
