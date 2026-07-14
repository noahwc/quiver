import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as p from "@clack/prompts";
import pc from "picocolors";

const execFileAsync = promisify(execFile);

const RTK_INSTALL = "brew install rtk";

async function isRtkInstalled(): Promise<boolean> {
  try {
    await execFileAsync("rtk", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Suggests installing RTK — a CLI proxy that reduces LLM token consumption —
 * unless it is already on PATH. Prints a copyable install command.
 */
export async function suggestRtk(): Promise<void> {
  if (await isRtkInstalled()) return;

  p.note(
    `${pc.dim("RTK is a CLI proxy that reduces LLM token consumption.")}\n${pc.cyan(RTK_INSTALL)}`,
    "Tip: install RTK",
  );
}
