import * as path from "node:path";

/** True when `target` resolves to `root` or a path inside it. */
export function isWithin(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  return (
    rel === "" ||
    (rel !== ".." &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel))
  );
}

/**
 * Resolves a relative path under `root`, rejecting anything that would escape
 * it. Used for paths derived from remote repository contents.
 */
export function safeJoin(root: string, relative: string): string {
  if (!relative || relative.includes("\0")) {
    throw new Error(`Invalid relative path: "${relative}"`);
  }

  const normalized = path.normalize(relative);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    throw new Error(`Refusing to write outside ${root}: ${relative}`);
  }

  const destination = path.resolve(root, normalized);
  if (!isWithin(root, destination)) {
    throw new Error(`Refusing to write outside ${root}: ${relative}`);
  }
  return destination;
}

/** Validates a single, non-traversing directory name for the skill cache. */
export function safeCacheName(name: string): string {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    path.isAbsolute(name) ||
    /^[A-Za-z]:/.test(name)
  ) {
    throw new Error(`Invalid skill cache name: "${name}"`);
  }
  return name;
}
