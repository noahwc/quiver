import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  replaceMarkedSection,
  removeMarkedSection,
  stripLegacyMarkers,
} from "../section-marker.js";
import { type OutputFile, QUIVER_BLOCK_NAME } from "../../core/types.js";

export async function writeOutputs(
  outputs: OutputFile[],
  options?: { dryRun?: boolean },
): Promise<void> {
  for (const output of outputs) {
    const filePath = path.isAbsolute(output.path)
      ? output.path
      : path.resolve(process.cwd(), output.path);

    if (output.mergeStrategy === "section-marker") {
      await writeMergedFile(filePath, output.content, options);
    } else {
      if (options?.dryRun) {
        console.log(`[dry-run] Would write: ${output.path}`);
      } else {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, output.content, "utf-8");
      }
    }
  }
}

async function writeMergedFile(
  filePath: string,
  newContent: string,
  options?: { dryRun?: boolean },
): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    // file doesn't exist yet
  }

  // Migrate: strip any legacy per-skill quiver markers left from the old model
  let result = stripLegacyMarkers(existing);

  if (newContent.trim().length === 0) {
    // No instructions: remove the quiver block if present
    result = removeMarkedSection(result, QUIVER_BLOCK_NAME);
  } else {
    // Replace or append the single quiver block
    result = replaceMarkedSection(result, QUIVER_BLOCK_NAME, newContent);
  }

  if (options?.dryRun) {
    console.log(`[dry-run] Would write: ${filePath}`);
    return;
  }

  // Skip writing if file is empty and never existed
  if (result.trim().length === 0 && existing.trim().length === 0) {
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const final = result.trim().length > 0 ? result.trim() + "\n" : result;
  await fs.writeFile(filePath, final, "utf-8");
}
