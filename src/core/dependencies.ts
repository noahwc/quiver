import { type QuiverConfigSkill } from "./types.js";
import { type DiscoveredSkill } from "./skill-discovery.js";

/**
 * Expands a selection of skills with everything they depend on.
 *
 * Some skills are deliberately thin: `grill-me` just says "run a /grilling
 * session". Installing only the entry point leaves it pointing at a skill that
 * does not exist, so sync loads the whole transitive closure of `requires`
 * instead. Requirements are resolved by name against the catalog, which keeps
 * them out of the saved config — removing a skill drops its dependencies again.
 */
export function withDependencies(
  selected: QuiverConfigSkill[],
  catalog: DiscoveredSkill[],
): QuiverConfigSkill[] {
  const byName = new Map(catalog.map((skill) => [skill.name, skill]));
  const resolved = new Map(selected.map((skill) => [skill.name, skill]));
  const pending = [...selected];

  while (pending.length > 0) {
    const skill = pending.shift()!;
    for (const name of byName.get(skill.name)?.requires ?? []) {
      if (resolved.has(name)) continue;

      const required = byName.get(name);
      if (!required) {
        throw new Error(
          `Skill "${skill.name}" requires "${name}", which is not in the skill catalog`,
        );
      }

      const entry: QuiverConfigSkill = {
        name: required.name,
        url: required.url,
      };
      resolved.set(name, entry);
      pending.push(entry);
    }
  }

  return [...resolved.values()];
}
