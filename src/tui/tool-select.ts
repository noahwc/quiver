import * as p from "@clack/prompts";
import pc from "picocolors";
import { type ToolTarget } from "../core/types.js";

const TOOL_OPTIONS: { value: ToolTarget; label: string; hint: string }[] = [
  { value: "claude", label: "Claude Code", hint: "CLAUDE.md, .claude/skills/, .claude/agents/" },
  { value: "opencode", label: "OpenCode", hint: "AGENTS.md, .opencode/skills/, .opencode/agents/" },
  { value: "copilot", label: "GitHub Copilot", hint: ".github/instructions/, .github/prompts/, .github/agents/" },
];

export async function selectTools(): Promise<ToolTarget[]> {
  const selected = await p.multiselect({
    message: "Which AI coding tools do you use?",
    options: TOOL_OPTIONS,
    required: true,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return selected as ToolTarget[];
}
