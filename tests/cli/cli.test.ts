import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const cli = path.resolve(import.meta.dirname, "../../src/cli/index.ts");

function quiver(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}

describe("quiver CLI", () => {
  it("prints the version", () => {
    const result = quiver(["--version"]);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout.trim(), "0.1.0");
  });

  it("prints top-level and command help", () => {
    const top = quiver(["--help"]);
    assert.strictEqual(top.status, 0);
    assert.match(top.stdout, /usage: quiver/);
    for (const command of ["add", "remove", "sync", "list", "export", "help"]) {
      assert.ok(top.stdout.includes(command), `missing ${command}`);
    }

    const add = quiver(["add", "--help"]);
    assert.strictEqual(add.status, 0);
    assert.match(add.stdout, /usage: quiver add/);
    assert.match(add.stdout, /--dry-run/);

    const viaHelp = quiver(["help", "export"]);
    assert.strictEqual(viaHelp.status, 0);
    assert.match(viaHelp.stdout, /usage: quiver export/);
    assert.match(viaHelp.stdout, /--include-third-party/);
  });

  it("rejects unknown commands and options with exit 1", () => {
    const command = quiver(["bogus"]);
    assert.strictEqual(command.status, 1);
    assert.match(command.stderr, /error:/);

    const option = quiver(["add", "--bogus"]);
    assert.strictEqual(option.status, 1);
    assert.match(option.stderr, /error:/);
  });

  it("runs a command with no options", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-cli-"));
    try {
      const result = quiver(["list"], { HOME: home });
      assert.strictEqual(result.status, 0);
      assert.match(result.stdout, /No skills installed/);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
