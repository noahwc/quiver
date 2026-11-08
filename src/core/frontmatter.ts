import { load, dump } from "js-yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  /** File body with the frontmatter block removed. */
  content: string;
}

export interface StringifyOptions {
  /** Preferred line width for the dumped block. `-1` = unlimited. */
  lineWidth?: number;
}

const OPENING_FENCE = /^ {0,3}---[ \t]*\r?\n/;
const CLOSING_FENCE = /(?:^|\r?\n) {0,3}(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/**
 * Extracts YAML frontmatter from a markdown file. Mirrors gray-matter's
 * contract: a leading `---` fence (with an optional closing `---`/`...` fence)
 * is parsed as YAML; everything after the closing fence is `content`. Files
 * without a frontmatter block pass through with an empty `data`.
 */
export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const text = markdown.startsWith("\uFEFF") ? markdown.slice(1) : markdown;
  if (!OPENING_FENCE.test(text)) return { data: {}, content: text };

  const rest = text.slice(text.match(OPENING_FENCE)![0].length);
  const closer = CLOSING_FENCE.exec(rest);
  if (!closer) return { data: {}, content: text };

  const data = loadFrontmatterYaml(rest.slice(0, closer.index));
  return { data, content: rest.slice(closer.index + closer[0].length) };
}

function loadFrontmatterYaml(body: string): Record<string, unknown> {
  if (!body.trim()) return {};
  const parsed = load(body);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/**
 * Builds `---` fenced frontmatter for `data`, followed by `content`.
 */
export function stringifyFrontmatter(
  content: string,
  data: Record<string, unknown>,
  options?: StringifyOptions,
): string {
  return `---\n${dump(data, { lineWidth: options?.lineWidth ?? 80 })}---\n${content}`;
}
