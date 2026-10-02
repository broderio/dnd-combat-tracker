import { classes, species, items, spells } from 'dnd-data';

// Mirrors monsterLibrary.js's approach of pre-processing the raw dnd-data
// tables once at startup into small, search-friendly lists. Unlike monsters,
// classes/races/weapons are almost entirely prose in this dataset (no
// structured level/damage fields), so these only offer name lookups for
// autocomplete — combat stats and class features are filled in by hand.
// Spells are the exception: they do carry structured level/school fields.

function dedupeByName(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Case-insensitive substring search over a list of `{ name, ... }` entries,
 * capped at `maxLimit` (or `defaultLimit` when no explicit limit is given).
 * `map` controls what's returned per match — plain names for classes/races,
 * full entries for weapons/spells.
 */
function nameSearch(list, { name, limit } = {}, { defaultLimit = 30, maxLimit = 200, map = (entry) => entry.name } = {}) {
  const needle = (name || '').trim().toLowerCase();
  const cap = Math.max(1, Math.min(maxLimit, Number(limit) || defaultLimit));
  const out = [];
  for (const entry of list) {
    if (needle && !entry.name.toLowerCase().includes(needle)) continue;
    out.push(map(entry));
    if (out.length >= cap) break;
  }
  return out;
}

const classNames = dedupeByName(classes.filter((c) => c.name));
const raceNames = dedupeByName(species.filter((s) => s.name));
const weaponEntries = dedupeByName(
  items
    .filter((i) => i.name && i.properties && typeof i.properties['Item Type'] === 'string')
    .filter((i) => i.properties['Item Type'].toLowerCase().includes('weapon'))
    .map((i) => ({ name: i.name, description: i.description || '' }))
);

const spellEntries = dedupeByName(
  spells
    .filter((s) => s.name)
    .map((s) => ({
      name: s.name,
      level: typeof s.properties?.Level === 'number' ? s.properties.Level : 0,
      school: s.properties?.School || null,
    }))
);

export class CharacterOptionsLibrary {
  searchClasses({ name, limit } = {}) {
    return nameSearch(classNames, { name, limit });
  }

  searchRaces({ name, limit } = {}) {
    return nameSearch(raceNames, { name, limit });
  }

  searchWeapons({ name, limit } = {}) {
    return nameSearch(weaponEntries, { name, limit }, { defaultLimit: 200, maxLimit: 200, map: (entry) => entry });
  }

  searchSpells({ name, limit } = {}) {
    return nameSearch(spellEntries, { name, limit }, { defaultLimit: 20, maxLimit: 100, map: (entry) => entry });
  }
}

export const characterOptionsLibrary = new CharacterOptionsLibrary();
