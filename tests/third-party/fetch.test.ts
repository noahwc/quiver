import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  fetchSkill,
  getGitHubTokenCandidates,
} from "../../src/third-party/github.ts";
import { parseSkillUrl } from "../../src/core/types.ts";

const source = parseSkillUrl(
  "github:acme/private-skills/skills/my-skill@main",
);

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function rawResponse(body: string): Response {
  return new Response(body, { status: 200 });
}

describe("fetchSkill", () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiver-fetch-"));
  });

  afterEach(async () => {
    mock.restoreAll();
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("fetches SKILL.md plus bundled scripts, preserving structure", async () => {
    const dir = "skills/my-skill";
    mock.method(globalThis, "fetch", async (url: string | URL): Promise<Response> => {
      const u = String(url);
      if (u.includes(`/contents/${dir}?`)) {
        return jsonResponse([
          { type: "file", path: `${dir}/SKILL.md` },
          { type: "dir", path: `${dir}/scripts` },
          { type: "file", path: `${dir}/reference.md` },
        ]);
      }
      if (u.includes(`/contents/${dir}/scripts?`)) {
        return jsonResponse([
          { type: "file", path: `${dir}/scripts/run.sh` },
        ]);
      }
      if (u.includes("SKILL.md")) {
        return rawResponse(
          "---\nname: my-skill\ndescription: test\ntype: skill\n---\n\nBody",
        );
      }
      if (u.includes("reference.md")) return rawResponse("# Reference");
      if (u.includes("run.sh")) return rawResponse("echo hi");
      throw new Error(`unexpected url ${u}`);
    });

    const destDir = await fetchSkill(source, cacheDir, "tok");

    assert.ok(
      (await fs.readFile(path.join(destDir, "SKILL.md"), "utf-8")).includes(
        "Body",
      ),
    );
    assert.strictEqual(
      await fs.readFile(path.join(destDir, "reference.md"), "utf-8"),
      "# Reference",
    );
    assert.strictEqual(
      await fs.readFile(path.join(destDir, "scripts", "run.sh"), "utf-8"),
      "echo hi",
    );
  });

  it("removes files deleted upstream on a re-fetch (sync --refresh)", async () => {
    const dir = "skills/my-skill";
    const listing = (withRef: boolean) => [
      { type: "file", path: `${dir}/SKILL.md` },
      ...(withRef ? [{ type: "file", path: `${dir}/reference.md` }] : []),
    ];
    let hasRef = true;
    mock.method(globalThis, "fetch", async (url: string | URL): Promise<Response> => {
      const u = String(url);
      if (u.includes(`/contents/${dir}?`)) return jsonResponse(listing(hasRef));
      if (u.includes("SKILL.md"))
        return rawResponse("---\nname: my-skill\ndescription: t\n---\nBody");
      if (u.includes("reference.md")) return rawResponse("# Reference");
      throw new Error(`unexpected url ${u}`);
    });

    const destDir = await fetchSkill(source, cacheDir, "tok");
    assert.strictEqual(
      await fs.readFile(path.join(destDir, "reference.md"), "utf-8"),
      "# Reference",
    );

    // Upstream deletes reference.md, then we re-fetch.
    hasRef = false;
    await fetchSkill(source, cacheDir, "tok");

    await assert.rejects(
      fs.readFile(path.join(destDir, "reference.md"), "utf-8"),
    );
    assert.ok(
      (await fs.readFile(path.join(destDir, "SKILL.md"), "utf-8")).includes(
        "Body",
      ),
    );
  });

  it("sends an Authorization header when a token is provided", async () => {
    mock.method(globalThis, "fetch", async (
      url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const u = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      assert.strictEqual(headers.Authorization, "Bearer tok");
      if (u.includes("/contents/skills/my-skill?")) {
        return jsonResponse([
          { type: "file", path: "skills/my-skill/SKILL.md" },
        ]);
      }
      return rawResponse("---\nname: my-skill\n---\nBody");
    });

    await fetchSkill(source, cacheDir, "tok");
  });

  it("gives a private-repo hint on 404 without a token", async () => {
    mock.method(
      globalThis,
      "fetch",
      async (): Promise<Response> => new Response("", { status: 404 }),
    );

    await assert.rejects(fetchSkill(source, cacheDir, ""), /private repository/i);
  });
});

describe("getGitHubTokenCandidates", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("includes the environment token as a candidate", () => {
    process.env.GITHUB_TOKEN = "env-token";
    assert.ok(getGitHubTokenCandidates().includes("env-token"));
  });

  it("de-duplicates identical env and CLI tokens", () => {
    process.env.GITHUB_TOKEN = "dupe";
    process.env.GH_TOKEN = "dupe";
    const candidates = getGitHubTokenCandidates();
    assert.strictEqual(candidates.filter((t) => t === "dupe").length, 1);
  });
});
