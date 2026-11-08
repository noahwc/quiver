import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type PluginMeta } from "./plugin.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version?: string;
  description?: string;
  license?: string;
  homepage?: string;
  repository?: string | { url?: string };
  author?: string | { name?: string; url?: string };
}

const DEFAULT_AUTHOR = {
  name: "Noah Clarke",
  url: "https://github.com/noahwc",
};
const DEFAULT_REPOSITORY = "https://github.com/noahwc/quiver";

/**
 * Read plugin metadata from quiver's own package.json. The generated plugin
 * repo intentionally inherits the CLI's version so the two never drift.
 */
export async function readPluginMeta(): Promise<PluginMeta> {
  const raw = await fs.readFile(
    path.resolve(__dirname, "../../package.json"),
    "utf-8",
  );
  const pkg = JSON.parse(raw) as PackageJson;

  const repository = normalizeRepository(
    typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url,
  );
  const author = normalizeAuthor(pkg.author);

  return {
    version: pkg.version ?? "0.0.0",
    description:
      pkg.description ?? "A curated library of AI coding assistant skills",
    license: pkg.license ?? "MIT",
    homepage: pkg.homepage ?? repository,
    repository,
    author,
  };
}

function normalizeRepository(value: string | undefined): string {
  if (!value) return DEFAULT_REPOSITORY;
  return value.replace(/^git\+/, "").replace(/\.git$/, "");
}

function normalizeAuthor(
  value: PackageJson["author"],
): { name: string; url: string } {
  if (!value) return DEFAULT_AUTHOR;
  if (typeof value === "string") {
    const match = value.match(/^([^<(]+?)\s*(?:\(([^)]+)\))?\s*$/);
    return {
      name: match?.[1]?.trim() || DEFAULT_AUTHOR.name,
      url: match?.[2]?.trim() || DEFAULT_AUTHOR.url,
    };
  }
  return {
    name: value.name?.trim() || DEFAULT_AUTHOR.name,
    url: value.url?.trim() || DEFAULT_AUTHOR.url,
  };
}
