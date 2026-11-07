import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type PortableSelection } from "./portable.js";

export interface PluginMeta {
  version: string;
  description: string;
  license: string;
  homepage: string;
  repository: string;
  author: { name: string; url: string };
}

export interface PluginRepoOptions {
  meta: PluginMeta;
  /** GitHub repository slug, e.g. `noahwc/quiver-plugin`. */
  repo: string;
  /** Plugin name; defaults to `quiver`. */
  pluginName?: string;
  /**
   * Emit only the plugin directory (`plugin.json` + `skills/`). Used when the
   * plugin lives in a subdirectory of another repo whose root catalog points
   * at it, so the nested marketplace/pi/README files would be misleading.
   */
  subtree?: boolean;
}

export type GeneratedFile =
  | { path: string; content: string }
  | { path: string; copyFrom: string };

export const DEFAULT_PLUGIN_REPO = "noahwc/quiver-plugin";
export const DEFAULT_PLUGIN_NAME = "quiver";

/**
 * Build the publishable plugin repository in memory. No filesystem writes
 * happen here, which keeps the layout testable and lets `--dry-run` reuse it.
 */
export function buildPluginRepo(
  selection: PortableSelection,
  options: PluginRepoOptions,
): GeneratedFile[] {
  const { meta, repo } = options;
  const pluginName = options.pluginName ?? DEFAULT_PLUGIN_NAME;
  const files: GeneratedFile[] = [];

  const manifest = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: pluginName,
    version: meta.version,
    description: meta.description,
    author: meta.author,
    homepage: meta.homepage,
    repository: meta.repository,
    license: meta.license,
    keywords: [
      "agent-skills",
      "claude-code",
      "copilot",
      "pi",
      "deepseek-harness",
    ],
  };
  files.push({ path: "plugin.json", content: toJson(manifest) });

  for (const skill of selection.skills) {
    files.push({
      path: path.posix.join("skills", skill.name, "SKILL.md"),
      content: skill.content,
    });
    for (const asset of skill.assets) {
      files.push({
        path: path.posix.join("skills", skill.name, asset),
        copyFrom: path.join(skill.skillDir, ...asset.split("/")),
      });
    }
  }

  if (!options.subtree) {
    const marketplace = {
      name: pluginName,
      owner: { name: meta.author.name, url: meta.author.url },
      description: meta.description,
      plugins: [
        {
          name: pluginName,
          source: ".",
          description: meta.description,
          version: meta.version,
          category: "productivity",
          tags: ["skills", "workflow", "agent-skills"],
        },
      ],
    };
    files.push({
      path: ".claude-plugin/marketplace.json",
      content: toJson(marketplace),
    });

    const piPackage = {
      name: `${pluginName}-skills`,
      version: meta.version,
      description: meta.description,
      keywords: ["pi-package", "agent-skills"],
      pi: { skills: ["./skills"] },
    };
    files.push({ path: "package.json", content: toJson(piPackage) });

    files.push({
      path: "README.md",
      content: renderReadme(selection, meta, repo, pluginName),
    });
  }

  // Track generated paths so `--force` can remove files that a later export no
  // longer produces (for example, a deleted skill) without touching anything
  // the user added.
  files.push({
    path: ".quiver-export.json",
    content: toJson({
      generator: "quiver",
      version: meta.version,
      files: files.map((file) => file.path),
    }),
  });

  return files;
}

export interface WritePluginOptions {
  force?: boolean;
  dryRun?: boolean;
}

export async function writePluginRepo(
  files: GeneratedFile[],
  outDir: string,
  options: WritePluginOptions = {},
): Promise<void> {
  const absOut = path.resolve(outDir);

  if (options.force && !options.dryRun) {
    await removeStaleGeneratedFiles(absOut, files);
  }

  if (!options.dryRun && !options.force) {
    let existing: string[] = [];
    try {
      existing = await fs.readdir(absOut);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (existing.length > 0) {
      throw new Error(
        `Output directory is not empty: ${absOut}. Use --force to overwrite.`,
      );
    }
  }

  for (const file of files) {
    const dest = safeJoin(absOut, file.path);
    if (options.dryRun) {
      console.log(`[dry-run] Would write: ${dest}`);
      continue;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if ("copyFrom" in file) {
      await fs.copyFile(file.copyFrom, dest);
    } else {
      await fs.writeFile(dest, file.content, "utf-8");
    }
  }
}

function safeJoin(root: string, relative: string): string {
  const dest = path.resolve(root, relative);
  const rel = path.relative(root, dest);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write outside the output directory: ${relative}`);
  }
  return dest;
}

/**
 * With `--force`, remove files that the previous export generated but this one
 * does not. Only paths listed in the previous `.quiver-export.json` are
 * touched, so user additions survive. Best-effort: a missing or malformed
 * marker simply skips cleanup.
 */
async function removeStaleGeneratedFiles(
  outDir: string,
  files: GeneratedFile[],
): Promise<void> {
  let previous: { files?: unknown };
  try {
    previous = JSON.parse(
      await fs.readFile(path.join(outDir, ".quiver-export.json"), "utf-8"),
    ) as { files?: unknown };
  } catch {
    return;
  }

  const current = new Set(files.map((file) => file.path));
  const oldFiles = Array.isArray(previous.files) ? previous.files : [];
  for (const rel of oldFiles) {
    if (typeof rel !== "string" || current.has(rel)) continue;
    try {
      await fs.rm(safeJoin(outDir, rel), { force: true });
    } catch {
      // Ignore invalid marker entries rather than failing the export.
    }
  }
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function renderReadme(
  selection: PortableSelection,
  meta: PluginMeta,
  repo: string,
  pluginName: string,
): string {
  const skillLines = selection.skills
    .map((skill) => `- \`${skill.name}\` — ${skill.description}`)
    .join("\n");

  const instructionLines =
    selection.excludedInstructions.length > 0
      ? selection.excludedInstructions.map((name) => `- \`${name}\``).join("\n")
      : "";

  return `# ${pluginName}

Curated AI coding skills from [quiver](https://github.com/noahwc/quiver), packaged as an [Agent Plugin](https://agent-plugins.org/).

Generated by \`quiver export\`. Do not edit by hand; edit the source skills in the quiver repository and regenerate.

## Install

### Claude Code

\`\`\`text
/plugin marketplace add ${repo}
/plugin install ${pluginName}@${pluginName}
\`\`\`

### GitHub Copilot and VS Code Copilot

Add \`${repo}\` as a plugin source in the Agent Customizations editor. The catalog contains a single plugin, so VS Code registers the marketplace and installs \`${pluginName}\`.

- Install: \`vscode://chat-plugin/install?source=${repo.replace("/", "%2F")}&plugin=${pluginName}\`
- Add the marketplace only: \`vscode://chat-plugin/add-marketplace?ref=${repo.replace("/", "%2F")}\`

You can also run **Chat: Install Plugin from Source** with the repository URL. Agent plugins must be enabled (\`chat.plugins.enabled\`).

### pi

\`\`\`sh
pi install git:github.com/${repo}
\`\`\`

### DeepSeek Harness and Codex

This repository is also a plain Agent Skills tree at \`skills/\`. Point DeepSeek Harness's \`customSkillDirs\` (or Codex's skill configuration) at that directory, or run \`quiver sync\` from the quiver CLI, which installs the selected skills into \`~/.agents/skills\`.

## Skills

${skillLines}
${
  instructionLines
    ? `
## Installed by the CLI only

These are always-on instructions, which Agent Plugins v1 cannot represent. Install them with the quiver CLI:

${instructionLines}
`
    : ""
}
## Not included

- **Always-on instructions** — Agent Plugins v1 has no rules/instructions component. Use the quiver CLI.
- **Third-party skills** — fetched and refreshed by the quiver CLI from their upstream repositories; not vendored here.

## Updating

The version follows quiver releases. Regenerate with \`quiver export\` and bump the version in the quiver repository before tagging.

## License

${meta.license}
`;
}
