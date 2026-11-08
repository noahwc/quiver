import * as p from "@clack/prompts";
import pc from "picocolors";
import { type QuiverConfigSkill } from "../core/types.ts";
import {
  discoverAllSkills,
  getInstalledSkillNames,
  getUninstalledSkills,
  toConfigSkill,
  type DiscoveredSkill,
} from "../core/skill-discovery.ts";

const TYPE_LABEL: Record<string, string> = {
  instruction: "always-on",
  skill: "on-demand",
};

/** Keeps hints to a single, terminal-friendly line so long descriptions
 * don't wrap into many rows and corrupt the multiselect's redraw. */
function truncate(text: string, max = 100): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}

/** Bounds the scrolling viewport to the terminal height so the full option
 * list never overflows (which garbles @clack's cursor math). */
function viewportSize(): number {
  const rows = process.stdout.rows ?? 24;
  return Math.max(5, Math.min(12, rows - 6));
}

function skillOption(s: DiscoveredSkill) {
  const sourceTag = s.url === "builtin" ? pc.dim("[builtin]") : pc.cyan("[3rd-party]");
  const typeTag = pc.dim(`[${TYPE_LABEL[s.type] ?? s.type}]`);
  return {
    value: s.name,
    label: s.name,
    hint: `${truncate(s.description)} ${typeTag} ${sourceTag}`,
  };
}

export async function selectSkills(
  existingSkills: QuiverConfigSkill[]
): Promise<QuiverConfigSkill[]> {
  const all = await discoverAllSkills();
  const installed = getInstalledSkillNames(existingSkills);
  const defaults = all.filter((s) => installed.has(s.name)).map((s) => s.name);

  const selected = await p.multiselect({
    message: "Which skills do you want to install?",
    options: all.map(skillOption),
    initialValues: defaults,
    maxItems: viewportSize(),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  const names = new Set(selected as string[]);
  return all.filter((s) => names.has(s.name)).map(toConfigSkill);
}

export async function selectSkillsToAdd(
  existingSkills: QuiverConfigSkill[]
): Promise<QuiverConfigSkill[]> {
  const all = await discoverAllSkills();
  const installed = getInstalledSkillNames(existingSkills);
  const uninstalled = getUninstalledSkills(all, installed);

  if (uninstalled.length === 0) {
    p.log.info("All available skills are already installed.");
    return [];
  }

  const selected = await p.multiselect({
    message: "Which skills do you want to add?",
    options: uninstalled.map(skillOption),
    maxItems: viewportSize(),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  const names = new Set(selected as string[]);
  return uninstalled.filter((s) => names.has(s.name)).map(toConfigSkill);
}

export async function selectSkillsToRemove(
  existingSkills: QuiverConfigSkill[]
): Promise<string[]> {
  if (existingSkills.length === 0) {
    p.log.info("No skills are installed.");
    return [];
  }

  const selected = await p.multiselect({
    message: "Which skills do you want to remove?",
    options: existingSkills.map((s) => ({
      value: s.name,
      label: s.name,
    })),
    maxItems: viewportSize(),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return selected as string[];
}
