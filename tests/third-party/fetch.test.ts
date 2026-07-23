import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  fetchSkill,
  getGitHubTokenCandidates,
} from "../../src/third-party/github.js";
import { parseSkillUrl } from "../../src/core/types.js";

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
    vi.restoreAllMocks();
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("fetches SKILL.md plus bundled scripts, preserving structure", async () => {
    const dir = "skills/my-skill";
    const fetchMock = vi.fn(async (url: string | URL): Promise<Response> => {
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
    vi.stubGlobal("fetch", fetchMock);

    const destDir = await fetchSkill(source, cacheDir, "tok");

    expect(await fs.readFile(path.join(destDir, "SKILL.md"), "utf-8")).toContain(
      "Body",
    );
    expect(
      await fs.readFile(path.join(destDir, "reference.md"), "utf-8"),
    ).toBe("# Reference");
    expect(
      await fs.readFile(path.join(destDir, "scripts", "run.sh"), "utf-8"),
    ).toBe("echo hi");
  });

  it("sends an Authorization header when a token is provided", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      jsonResponse([{ type: "file", path: "skills/my-skill/SKILL.md" }]),
    );
    // Fail fast after listing by making the raw fetch throw via missing SKILL.md check.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit): Promise<Response> => {
        const u = String(url);
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer tok");
        if (u.includes("/contents/skills/my-skill?")) {
          return jsonResponse([
            { type: "file", path: "skills/my-skill/SKILL.md" },
          ]);
        }
        return rawResponse("---\nname: my-skill\n---\nBody");
      }),
    );

    await fetchSkill(source, cacheDir, "tok");
    void fetchMock;
  });

  it("gives a private-repo hint on 404 without a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> => new Response("", { status: 404 })),
    );

    await expect(fetchSkill(source, cacheDir, "")).rejects.toThrow(
      /private repository/i,
    );
  });
});

describe("getGitHubTokenCandidates", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("includes the environment token as a candidate", () => {
    process.env.GITHUB_TOKEN = "env-token";
    expect(getGitHubTokenCandidates()).toContain("env-token");
  });

  it("de-duplicates identical env and CLI tokens", () => {
    process.env.GITHUB_TOKEN = "dupe";
    process.env.GH_TOKEN = "dupe";
    const candidates = getGitHubTokenCandidates();
    expect(candidates.filter((t) => t === "dupe")).toHaveLength(1);
  });
});
