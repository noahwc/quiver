export type SkillType = "instruction" | "skill";

export type SkillSource =
  | { type: "builtin" }
  | { type: "github"; owner: string; repo: string; path: string; ref: string };

export interface SkillFrontmatter {
  name: string;
  description: string;
  type: SkillType;
  "auto-trigger": boolean;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  baseContent: string;
}

export interface ResolvedSkill extends ParsedSkill {
  source: SkillSource;
  skillDir: string;
}

export interface QuiverConfig {
  $schema?: string;
  skills: QuiverConfigSkill[];
}

export interface QuiverConfigSkill {
  name: string;
  url: string;
}

export interface OutputFile {
  path: string;
  content: string;
  mergeStrategy: "section-marker" | "overwrite";
}

export interface Manifest {
  files: string[];
}

/** Name used for the single managed block in CLAUDE.md and AGENTS.md. */
export const QUIVER_BLOCK_NAME = "quiver";

export const SECTION_MARKER_START = (name: string) =>
  `<!-- quiver:start:${name} -->`;
export const SECTION_MARKER_END = (name: string) =>
  `<!-- quiver:end:${name} -->`;

export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const GITHUB_COMPONENT_REGEX = /^[A-Za-z0-9._-]+$/;

function isValidGithubComponent(value: string): boolean {
  return (
    GITHUB_COMPONENT_REGEX.test(value) &&
    value !== "." &&
    value !== ".."
  );
}

function isSafeRepoPath(repoPath: string): boolean {
  if (repoPath.includes("\\")) return false;
  return repoPath
    .split("/")
    .every((segment) => segment !== "." && segment !== "..");
}

export function parseSkillUrl(url: string): SkillSource {
  if (url === "builtin") return { type: "builtin" };
  const match = url.match(/^github:([^/]+)\/([^/]+?)(?:\/(.+?))?(?:@(.+))?$/);
  if (!match)
    throw new Error(
      `Invalid skill URL: "${url}". Expected "builtin" or "github:owner/repo[/path][@ref]"`,
    );

  const owner = match[1];
  const repo = match[2];
  const repoPath = (match[3] ?? "").replace(/^\/+|\/+$/g, "");
  const ref = match[4] ?? "main";

  if (
    !isValidGithubComponent(owner) ||
    !isValidGithubComponent(repo) ||
    !isSafeRepoPath(repoPath) ||
    !ref ||
    /[\s\u0000-\u001f\u007f]/.test(ref)
  ) {
    throw new Error(
      `Invalid skill URL: "${url}". Expected "builtin" or "github:owner/repo[/path][@ref]"`,
    );
  }

  return { type: "github", owner, repo, path: repoPath, ref };
}
