import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { findMarkedSections, replaceMarkedSection, removeMarkedSection, appendSection, wrapInSectionMarker } from "../section-marker.js";
import { type OutputFile } from "../../core/types.js";

export async function writeOutputs(
  outputs: OutputFile[],
  options?: { dryRun?: boolean }
): Promise<void> {
  for (const output of outputs) {
    const filePath = path.isAbsolute(output.path)
      ? output.path
      : path.resolve(process.cwd(), output.path);

    if (output.mergeStrategy === "section-marker") {
      await writeWithMarkers(filePath, output.content, output.path, options);
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

async function writeWithMarkers(
  filePath: string,
  newContent: string,
  label: string,
  options?: { dryRun?: boolean }
): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    // file doesn't exist yet
  }

  const incomingSections = findMarkedSections(newContent);
  let result = existing;

  for (const [name, sectionContent] of incomingSections) {
    const wrapped = wrapInSectionMarker(name, sectionContent);
    if (result.length === 0) {
      result = wrapped + "\n";
    } else if (findMarkedSections(result).has(name)) {
      result = replaceMarkedSection(result, name, sectionContent);
    } else {
      result = appendSection(result, wrapped);
    }
  }

  if (options?.dryRun) {
    console.log(`[dry-run] Would write: ${label}`);
  } else {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, result, "utf-8");
  }
}

export async function removeSkillFromMarkdown(
  filePath: string,
  skillName: string
): Promise<void> {
  let existing: string;
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    return;
  }
  const result = removeMarkedSection(existing, skillName);
  if (result.trim().length === 0) {
    await fs.unlink(filePath);
  } else {
    await fs.writeFile(filePath, result, "utf-8");
  }
}

/** Removes a skill's generated files: the shared SKILL.md and the Copilot instruction copy. */
export async function removeSkillFiles(skillName: string): Promise<void> {
  const targets = [
    path.join(os.homedir(), ".claude", "skills", skillName),
    path.join(os.homedir(), ".copilot", "instructions", `${skillName}.instructions.md`),
  ];
  for (const target of targets) {
    try {
      await fs.rm(target, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
