import {
  SECTION_MARKER_START,
  SECTION_MARKER_END,
} from "../core/types.js";

export function wrapInSectionMarker(
  skillName: string,
  content: string
): string {
  const start = SECTION_MARKER_START(skillName);
  const end = SECTION_MARKER_END(skillName);
  return `${start}\n${content}\n${end}`;
}

export function findMarkedSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const re = /<!--\s*quiver:start:(\S+)\s*-->\n([\s\S]*?)\n<!--\s*quiver:end:\1\s*-->/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    sections.set(match[1], match[2]);
  }
  return sections;
}

export function removeMarkedSection(
  content: string,
  skillName: string
): string {
  const start = SECTION_MARKER_START(skillName);
  const end = SECTION_MARKER_END(skillName);
  const re = new RegExp(
    `\\s*${escapeRegex(start)}\\n[\\s\\S]*?\\n${escapeRegex(end)}\\s*`,
    "g"
  );
  return content.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function replaceMarkedSection(
  content: string,
  skillName: string,
  newContent: string
): string {
  const start = SECTION_MARKER_START(skillName);
  const end = SECTION_MARKER_END(skillName);
  const re = new RegExp(
    `${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`,
    "g"
  );
  const wrapped = wrapInSectionMarker(skillName, newContent);
  const result = content.replace(re, wrapped);
  if (result === content && !re.test(content)) {
    return appendSection(content, wrapped);
  }
  return result;
}

export function appendSection(content: string, wrappedSection: string): string {
  const trimmed = content.trimEnd();
  if (trimmed.length === 0) return wrappedSection;
  return `${trimmed}\n\n${wrappedSection}\n`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
