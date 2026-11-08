import { parseFrontmatter } from "../core/frontmatter.ts";
import {
  type ParsedSkill,
  type SkillFrontmatter,
  type SkillType,
  SKILL_NAME_REGEX,
} from "../core/types.ts";

export function parseSkill(markdown: string): ParsedSkill {
  const { data, content } = parseFrontmatter(markdown);

  const frontmatter: SkillFrontmatter = {
    name: data.name as string,
    description: data.description as string,
    type: ((data.type as string | undefined) ?? "skill") as SkillType,
    "auto-trigger": (data["auto-trigger"] as boolean | undefined) ?? true,
  };

  validateFrontmatter(frontmatter);

  return { frontmatter, baseContent: content.trimEnd() };
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
  if (!fm.type || !["instruction", "skill"].includes(fm.type)) {
    throw new Error(
      `Skill "${fm.name}" has invalid type: "${fm.type}". Must be instruction or skill`,
    );
  }
}
