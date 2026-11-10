import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const script = path.resolve(
  import.meta.dirname,
  "../../skills/productivity/habit-miner/scripts/agent-cli",
);

function repo(remote?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-cli-repo-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  if (remote) execFileSync("git", ["remote", "add", "origin", remote], { cwd: dir });
  return fs.realpathSync(dir);
}

function run(cwd: string, home: string, ...args: string[]) {
  const r = spawnSync("sh", [script, ...args], {
    cwd,
    env: { ...process.env, AGENT_CLI_HOME: home },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function home(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-cli-home-"));
}

describe("agent-cli dispatcher", () => {
  it("keys subcommand dirs by normalized origin remote", () => {
    const h = home();
    for (const remote of [
      "git@github.com:owner/repo.git",
      "https://github.com/owner/repo.git/",
      "ssh://git@host:22/owner/repo.git",
      "https://user:token@ghe.example/org/sub/owner/repo",
    ]) {
      assert.equal(run(repo(remote), h, "--where").out.trim(), path.join(h, "owner/repo"), remote);
    }
  });

  it("falls back to local/<toplevel> without an origin", () => {
    const h = home();
    const dir = repo();
    assert.equal(run(dir, h, "--where").out.trim(), path.join(h, "local", path.basename(dir)));
  });

  it("exits 3 outside a git repo or with no subcommands", () => {
    const h = home();
    assert.equal(run(os.tmpdir(), h).code, 3);
    const dir = repo("git@github.com:o/r.git");
    assert.equal(run(dir, h).code, 3);
    assert.deepEqual(run(dir, h, "--json"), { code: 3, out: "[]\n", err: "" });
  });

  it("lists, emits JSON, and dispatches with AGENT_CLI_REPO set", () => {
    const h = home();
    const dir = repo("git@github.com:o/r.git");
    fs.mkdirSync(path.join(h, "o/r"), { recursive: true });
    fs.writeFileSync(
      path.join(h, "o/r/where-am-i"),
      '#!/bin/sh\n# summary: say "root" \\o/\necho "$AGENT_CLI_REPO" "$@"\n',
    );

    assert.equal(run(dir, h).out, 'where-am-i\tsay "root" \\o/\n');
    assert.deepEqual(JSON.parse(run(dir, h, "--json").out), [
      { name: "where-am-i", summary: 'say "root" \\o/' },
    ]);
    const sub = path.join(dir, "nested");
    fs.mkdirSync(sub);
    assert.equal(run(sub, h, "where-am-i", "a", "b").out, `${dir} a b\n`);
  });

  it("rejects unknown and path-like subcommands", () => {
    const h = home();
    const dir = repo("git@github.com:o/r.git");
    assert.equal(run(dir, h, "nope").code, 2);
    assert.equal(run(dir, h, "../x").code, 2);
    assert.equal(run(dir, h, "--bogus").code, 2);
  });
});
