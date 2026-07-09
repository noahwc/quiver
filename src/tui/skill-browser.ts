import * as p from "@clack/prompts";
import pc from "picocolors";
import { type QuiverConfigSkill } from "../core/types.js";
import {
  discoverAllSkills,
  getInstalledSkillNames,
  getUninstalledSkills,
  toConfigSkill,
  type DiscoveredSkill,
} from "../core/skill-discovery.js";

const TYPE_LABEL: Record<string, string> = {
  instruction: "always-on",
  skill: "on-demand",
};

function skillOption(s: DiscoveredSkill) {
  const sourceTag = s.url === "builtin" ? pc.dim("[builtin]") : pc.cyan("[3rd-party]");
  const typeTag = pc.dim(`[${TYPE_LABEL[s.type] ?? s.type}]`);
  return {
    value: s.name,
    label: s.name,
    hint: `${s.description} ${typeTag} ${sourceTag}`,
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
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return selected as string[];
}
