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

function nameSearch(list, name, limit) {
  const needle = (name || '').trim().toLowerCase();
  const cap = Math.max(1, Math.min(200, Number(limit) || 30));
  const out = [];
  for (const entry of list) {
    if (needle && !entry.name.toLowerCase().includes(needle)) continue;
    out.push(entry.name);
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
    return nameSearch(classNames, name, limit);
  }

  searchRaces({ name, limit } = {}) {
    return nameSearch(raceNames, name, limit);
  }

  searchWeapons({ name, limit } = {}) {
    const needle = (name || '').trim().toLowerCase();
    const cap = Math.max(1, Math.min(200, Number(limit) || 200));
    const out = [];
    for (const entry of weaponEntries) {
      if (needle && !entry.name.toLowerCase().includes(needle)) continue;
      out.push(entry);
      if (out.length >= cap) break;
    }
    return out;
  }

  searchSpells({ name, limit } = {}) {
    const needle = (name || '').trim().toLowerCase();
    const cap = Math.max(1, Math.min(100, Number(limit) || 20));
    const out = [];
    for (const entry of spellEntries) {
      if (needle && !entry.name.toLowerCase().includes(needle)) continue;
      out.push(entry);
      if (out.length >= cap) break;
    }
    return out;
  }
}

export const characterOptionsLibrary = new CharacterOptionsLibrary();
