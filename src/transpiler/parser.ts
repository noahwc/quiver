import matter from "gray-matter";
import {
  type ParsedSkill,
  type SkillFrontmatter,
  type TargetSection,
  type ToolTarget,
  SKILL_NAME_REGEX,
} from "../core/types.js";

const TARGET_SECTION_RE = /<!--\s*target:(\w+)\s*-->\n([\s\S]*?)<!--\s*\/target:(\w+)\s*-->/g;

export function parseSkill(markdown: string): ParsedSkill {
  const { data, content } = matter(markdown);

  const frontmatter: SkillFrontmatter = {
    name: data.name,
    description: data.description,
    category: data.category,
    type: data.type,
    "auto-trigger": data["auto-trigger"] ?? true,
    targets: normalizeTargets(data.targets),
    source: data.source,
    path: data.path,
    ref: data.ref,
  };

  validateFrontmatter(frontmatter);

  const { baseContent, targetSections } = extractTargetSections(content);

  return { frontmatter, baseContent, targetSections };
}

function normalizeTargets(raw: unknown): ToolTarget[] {
  if (Array.isArray(raw)) return raw as ToolTarget[];
  if (typeof raw === "string") return [raw] as ToolTarget[];
  return ["claude", "opencode", "copilot"];
}

function validateFrontmatter(fm: SkillFrontmatter): void {
  if (!fm.name || !SKILL_NAME_REGEX.test(fm.name)) {
    throw new Error(
      `Invalid skill name: "${fm.name}". Must match ${SKILL_NAME_REGEX.source}`
    );
  }
  if (!fm.description || fm.description.length === 0) {
    throw new Error(`Skill "${fm.name}" requires a description`);
  }
  if (!fm.type || !["instruction", "skill", "agent"].includes(fm.type)) {
    throw new Error(
      `Skill "${fm.name}" has invalid type: "${fm.type}". Must be instruction, skill, or agent`
    );
  }
}

function extractTargetSections(content: string): {
  baseContent: string;
  targetSections: TargetSection[];
} {
  const sections: TargetSection[] = [];
  const targetsSeen = new Set<string>();

  const cleaned = content.replace(TARGET_SECTION_RE, (_match, openTarget, body, closeTarget) => {
    if (openTarget !== closeTarget) {
      throw new Error(
        `Mismatched target sections: <!-- target:${openTarget} --> closed with <!-- /target:${closeTarget} -->`
      );
    }
    if (targetsSeen.has(openTarget)) {
      throw new Error(`Duplicate target section for "${openTarget}"`);
    }
    targetsSeen.add(openTarget);
    sections.push({ target: openTarget as ToolTarget, content: body.trimEnd() });
    return "";
  });

  return {
    baseContent: cleaned.trimEnd(),
    targetSections: sections,
  };
}

export function composeContent(
  baseContent: string,
  targetSections: TargetSection[],
  target: ToolTarget
): string {
  const parts = [baseContent];

  for (const section of targetSections) {
    if (section.target === target) {
      parts.push(section.content);
    }
  }

  return parts.filter((p) => p.length > 0).join("\n\n");
}
