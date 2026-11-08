import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "../core/frontmatter.ts";
import { isWithin, safeCacheName, safeJoin } from "../core/paths.ts";
import {
  type QuiverConfigSkill,
  type SkillSource,
  parseSkillUrl,
} from "../core/types.ts";

const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

export function getGlobalCacheDir(): string {
  return path.resolve(os.homedir(), ".quiver/cache");
}

export async function ensureCacheDir(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
}

/**
 * Resolves GitHub credentials for authenticated requests so private repos the
 * user has access to can be fetched.
 *
 * NOTE: we deliberately do not rely on Personal Access Tokens being usable —
 * many orgs disable them. The GitHub CLI's stored credential is an OAuth token
 * (`gho_...`), which is unaffected by PAT restrictions, so it is treated as a
 * first-class source alongside the standard environment variables.
 *
 * Returns an ordered, de-duplicated list of candidate tokens. `resolveWorkingToken`
 * probes them so a broken/blocked token (e.g. a disabled PAT in the environment)
 * transparently falls back to the CLI's OAuth token.
 */
export function getGitHubTokenCandidates(): string[] {
  const candidates: string[] = [];
  const oauth = getGhKeyringToken();
  if (oauth) candidates.push(oauth);
  const env = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
  if (env) candidates.push(env);
  return [...new Set(candidates)];
}

/** Reads the GitHub CLI's stored OAuth token, ignoring any env-var override. */
function getGhKeyringToken(): string | undefined {
  try {
    const token = execFileSync("gh", ["auth", "token"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      // Blank the env vars so `gh` returns its keyring OAuth token rather than
      // echoing back a (possibly PAT) GH_TOKEN/GITHUB_TOKEN from the environment.
      env: { ...process.env, GH_TOKEN: "", GITHUB_TOKEN: "" },
    }).trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

/** Back-compat single-token accessor: the highest-precedence candidate. */
export function getGitHubToken(): string | undefined {
  return getGitHubTokenCandidates()[0];
}

/**
 * Picks the first candidate token that can actually access the repo, so a
 * disabled/expired token doesn't block a working one. Returns undefined when
 * there are no candidates (public repos are then fetched unauthenticated).
 */
export async function resolveWorkingToken(
  source: Extract<SkillSource, { type: "github" }>,
  candidates: string[] = getGitHubTokenCandidates(),
): Promise<string | undefined> {
  if (candidates.length === 0) return undefined;
  const repoUrl = `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}`;
  for (const token of candidates) {
    try {
      const res = await fetch(repoUrl, { headers: apiHeaders(token) });
      if (res.ok) return token;
    } catch {
      // network error — try the next candidate
    }
  }
  // None verified (repo may be genuinely missing); use the first so the real
  // fetch surfaces an accurate, actionable error.
  return candidates[0];
}

function apiHeaders(
  token: string | undefined,
  accept = "application/vnd.github+json",
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "quiver",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Rejects repository paths that are not contained by the skill directory. */
function assertRepoPathWithin(base: string, candidate: string): void {
  if (candidate.includes("\\")) {
    throw new Error(`Refusing to fetch a path with a backslash: ${candidate}`);
  }
  const rel = path.posix.relative(base, candidate);
  if (
    path.posix.isAbsolute(rel) ||
    rel === ".." ||
    rel.startsWith("../")
  ) {
    throw new Error(
      `Refusing to fetch a file outside the skill directory: ${candidate}`,
    );
  }
}

/** Joins repo-relative path segments with forward slashes, ignoring empties. */
function repoJoin(...segments: string[]): string {
  return segments
    .flatMap((s) => s.split("/"))
    .filter((s) => s.length > 0)
    .join("/");
}

/** Percent-encodes each path segment while preserving separators. */
function encodeRepoPath(repoPath: string): string {
  return repoPath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

/** Fetches every non-builtin skill into the cache. Returns names that failed. */
export async function fetchThirdPartySkills(
  skills: QuiverConfigSkill[],
  cacheDir: string,
  onProgress?: (name: string) => void,
): Promise<string[]> {
  const candidates = getGitHubTokenCandidates();
  const failed: string[] = [];
  for (const entry of skills.filter((s) => s.url !== "builtin")) {
    try {
      const source = parseSkillUrl(entry.url);
      const token =
        source.type === "github"
          ? await resolveWorkingToken(source, candidates)
          : undefined;
      await fetchSkill(source, cacheDir, token);
      onProgress?.(entry.name);
    } catch {
      failed.push(entry.name);
    }
  }
  return failed;
}

/**
 * Fetches a skill's entire source directory into the cache — SKILL.md plus any
 * bundled scripts, reference docs, templates, or additional instruction files —
 * preserving the nested directory structure. Uses the authenticated GitHub
 * Contents API so private repositories the token has access to are supported.
 *
 * Pass `token` explicitly to force a credential; omit it to auto-resolve a
 * working token (GitHub CLI OAuth token or GITHUB_TOKEN/GH_TOKEN).
 */
export async function fetchSkill(
  source: SkillSource,
  cacheDir: string,
  token?: string,
): Promise<string> {
  if (source.type !== "github") {
    throw new Error("fetchSkill only supports github sources");
  }

  const authToken =
    token === undefined ? await resolveWorkingToken(source) : token || undefined;

  const skillName = safeCacheName(path.basename(source.path) || source.repo);
  const destDir = path.resolve(cacheDir, skillName);
  if (!isWithin(cacheDir, destDir)) {
    throw new Error(`Invalid skill cache directory: ${destDir}`);
  }

  const repoPaths = await listSkillFiles(source, authToken);
  const hasSkillMd = repoPaths.some(
    (p) => path.posix.relative(source.path, p) === "SKILL.md",
  );
  if (!hasSkillMd) {
    throw new Error(
      `No SKILL.md found under ${source.owner}/${source.repo}/${source.path}`,
    );
  }

  // Download everything first so a mid-fetch failure never leaves a good cache
  // half-wiped.
  const downloaded: Array<{ rel: string; content: Buffer | string }> = [];
  for (const repoPath of repoPaths) {
    const rel = path.posix.relative(source.path, repoPath);
    if (
      path.posix.isAbsolute(rel) ||
      rel === ".." ||
      rel.startsWith("../")
    ) {
      throw new Error(
        `Refusing to fetch a file outside the skill directory: ${repoPath}`,
      );
    }
    const bytes = await fetchFileBytes(source, repoPath, authToken);
    downloaded.push({
      rel,
      content:
        rel === "SKILL.md" ? sanitizeFrontmatter(bytes.toString("utf-8")) : bytes,
    });
  }

  // Replace the cached copy wholesale so files removed upstream don't linger on
  // `sync --refresh`; the cache always mirrors the source exactly.
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });
  for (const { rel, content } of downloaded) {
    const destPath = safeJoin(destDir, rel);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, content);
  }

  return destDir;
}

/** Recursively lists every file path under the skill directory in the repo. */
async function listSkillFiles(
  source: Extract<SkillSource, { type: "github" }>,
  token: string | undefined,
): Promise<string[]> {
  const files: string[] = [];
  const visited = new Set<string>();

  async function walk(dir: string): Promise<void> {
    if (visited.has(dir)) {
      throw new Error(`Refusing to recurse into ${dir} twice`);
    }
    visited.add(dir);

    const url =
      `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}/contents/` +
      `${encodeRepoPath(dir)}?ref=${encodeURIComponent(source.ref)}`;
    const res = await fetch(url, { headers: apiHeaders(token) });
    if (!res.ok) throw describeError(res, source, dir, token);

    const entries = (await res.json()) as Array<{
      type: string;
      path: string;
    }>;
    for (const entry of entries) {
      const entryPath = path.posix.normalize(entry.path);
      assertRepoPathWithin(dir, entryPath);
      if (entry.type === "dir") {
        await walk(entryPath);
      } else if (entry.type === "file") {
        files.push(entryPath);
      }
    }
  }

  await walk(source.path);
  return files;
}

/** Downloads a single file's raw bytes via the Contents API. */
async function fetchFileBytes(
  source: Extract<SkillSource, { type: "github" }>,
  repoPath: string,
  token: string | undefined,
): Promise<Buffer> {
  const url =
    `${GITHUB_API_BASE}/repos/${source.owner}/${source.repo}/contents/` +
    `${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(source.ref)}`;
  const res = await fetch(url, {
    headers: apiHeaders(token, "application/vnd.github.raw"),
  });
  if (!res.ok) throw describeError(res, source, repoPath, token);
  return Buffer.from(await res.arrayBuffer());
}

function describeError(
  res: Response,
  source: Extract<SkillSource, { type: "github" }>,
  repoPath: string,
  token: string | undefined,
): Error {
  const target = `${source.owner}/${source.repo}/${repoJoin(repoPath)}@${source.ref}`;
  if (res.status === 404 && !token) {
    return new Error(
      `Failed to fetch ${target} (404). If this is a private repository, ` +
        `sign in with the GitHub CLI: \`gh auth login\` (its OAuth token works ` +
        `even where Personal Access Tokens are disabled).`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    return new Error(
      `Failed to fetch ${target} (${res.status}). Your GitHub credential may ` +
        `lack access to this repository or the required scopes — try ` +
        `\`gh auth login\` / \`gh auth refresh -s repo\`.`,
    );
  }
  return new Error(`Failed to fetch ${target}: ${res.status} ${res.statusText}`);
}

function yamlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function yamlString(value: string): string {
  // JSON's double-quoted strings are valid YAML and escape backslashes,
  // quotes, and control characters correctly.
  return JSON.stringify(value.replace(/[\r\n]+/g, " ").trim());
}

/**
 * Rewrites YAML frontmatter so every value is a double-quoted string.
 * This prevents folded (`>`) and literal (`|`) block scalars from causing
 * "Nested mappings are not allowed in compact mappings" errors in strict
 * YAML parsers (e.g. pi.dev).
 */
export function sanitizeFrontmatter(markdown: string): string {
  const { data, content } = parseFrontmatter(markdown);
  if (!data || Object.keys(data).length === 0) return markdown;

  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      lines.push(`${yamlKey(key)}: ${yamlString(value)}`);
    } else if (typeof value === "boolean" || typeof value === "number") {
      lines.push(`${yamlKey(key)}: ${String(value)}`);
    } else {
      // Fallback: coerce to string
      lines.push(`${yamlKey(key)}: ${JSON.stringify(value) ?? "null"}`);
    }
  }
  lines.push("---");

  return lines.join("\n") + content;
}
