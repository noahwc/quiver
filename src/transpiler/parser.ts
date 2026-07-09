import matter from "gray-matter";
import {
  type ParsedSkill,
  type SkillFrontmatter,
  SKILL_NAME_REGEX,
} from "../core/types.js";

export function parseSkill(markdown: string): ParsedSkill {
  const { data, content } = matter(markdown);

  const frontmatter: SkillFrontmatter = {
    name: data.name,
    description: data.description,
    category: data.category ?? "productivity",
    type: data.type ?? "skill",
    "auto-trigger": data["auto-trigger"] ?? true,
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
