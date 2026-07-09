export type Scope = "project" | "global";

export type ToolTarget = "claude" | "opencode" | "copilot";

export type SkillType = "instruction" | "skill" | "agent";

export type SkillCategory = "tokens" | "project" | "productivity" | "engineering";

export type SkillSource =
  | { type: "builtin" }
  | { type: "github"; owner: string; repo: string; path: string; ref: string };

export interface SkillFrontmatter {
  name: string;
  description: string;
  category: SkillCategory;
  type: SkillType;
  "auto-trigger": boolean;
  targets: ToolTarget[];
  source?: string;
  path?: string;
  ref?: string;
}

export interface TargetSection {
  target: ToolTarget;
  content: string;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  baseContent: string;
  targetSections: TargetSection[];
}

export interface ResolvedSkill extends ParsedSkill {
  source: SkillSource;
  skillDir: string;
}

export interface QuiverConfig {
  $schema?: string;
  tools: ToolTarget[];
  skills: QuiverConfigSkill[];
}

export interface QuiverConfigSkill {
  name: string;
  url: string;
}

export interface BuildOutput {
  files: OutputFile[];
}

export interface OutputFile {
  path: string;
  content: string;
  mergeStrategy: "section-marker" | "overwrite";
}

export interface SectionMarker {
  skillName: string;
  start: string;
  end: string;
}

export const SECTION_MARKER_START = (name: string) => `<!-- quiver:start:${name} -->`;
export const SECTION_MARKER_END = (name: string) => `<!-- quiver:end:${name} -->`;

export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseSkillUrl(url: string): SkillSource {
  if (url === "builtin") return { type: "builtin" };
  const match = url.match(/^github:([^/]+)\/([^/]+?)(?:\/(.+?))?(?:@(.+))?$/);
  if (!match) throw new Error(`Invalid skill URL: "${url}". Expected "builtin" or "github:owner/repo[/path][@ref]"`);
  return {
    type: "github",
    owner: match[1],
    repo: match[2],
    path: match[3] ?? "",
    ref: match[4] ?? "main",
  };
}

