import { describe, it, expect } from "vitest";
import { withDependencies } from "../../src/core/dependencies.js";
import { type DiscoveredSkill } from "../../src/core/skill-discovery.js";

function skill(
  name: string,
  overrides: Partial<DiscoveredSkill> = {},
): DiscoveredSkill {
  return {
    name,
    description: `${name} description`,
    type: "skill",
    "auto-trigger": false,
    url: `github:owner/repo/skills/${name}`,
    ...overrides,
  };
}

describe("withDependencies", () => {
  it("leaves skills without dependencies untouched", () => {
    const catalog = [skill("no-yap", { url: "builtin" })];
    expect(withDependencies([{ name: "no-yap", url: "builtin" }], catalog)).toEqual([
      { name: "no-yap", url: "builtin" },
    ]);
  });

  it("adds a required skill", () => {
    const catalog = [
      skill("grill-me", { requires: ["grilling"] }),
      skill("grilling"),
    ];

    const result = withDependencies(
      [{ name: "grill-me", url: "github:owner/repo/skills/grill-me" }],
      catalog,
    );

    expect(result).toEqual([
      { name: "grill-me", url: "github:owner/repo/skills/grill-me" },
      { name: "grilling", url: "github:owner/repo/skills/grilling" },
    ]);
  });

  it("resolves dependencies transitively and de-duplicates them", () => {
    const catalog = [
      skill("grill-with-docs", {
        requires: ["grilling", "domain-modeling"],
      }),
      skill("grilling", { requires: ["domain-modeling"] }),
      skill("domain-modeling"),
    ];

    const result = withDependencies(
      [{ name: "grill-with-docs", url: "github:owner/repo/skills/grill-with-docs" }],
      catalog,
    );

    expect(result.map((s) => s.name)).toEqual([
      "grill-with-docs",
      "grilling",
      "domain-modeling",
    ]);
  });

  it("keeps an explicitly selected dependency once", () => {
    const catalog = [
      skill("grill-me", { requires: ["grilling"] }),
      skill("grilling"),
    ];

    const result = withDependencies(
      [
        { name: "grill-me", url: "github:owner/repo/skills/grill-me" },
        { name: "grilling", url: "github:owner/repo/skills/grilling" },
      ],
      catalog,
    );

    expect(result.filter((s) => s.name === "grilling")).toHaveLength(1);
  });

  it("fails loudly when a requirement is missing from the catalog", () => {
    const catalog = [skill("grill-me", { requires: ["grilling"] })];

    expect(() =>
      withDependencies(
        [{ name: "grill-me", url: "github:owner/repo/skills/grill-me" }],
        catalog,
      ),
    ).toThrow(/requires "grilling"/);
  });

  it("terminates on dependency cycles", () => {
    const catalog = [skill("a", { requires: ["b"] }), skill("b", { requires: ["a"] })];

    const result = withDependencies([{ name: "a", url: "github:owner/repo/skills/a" }], catalog);

    expect(result.map((s) => s.name).sort()).toEqual(["a", "b"]);
  });
});
