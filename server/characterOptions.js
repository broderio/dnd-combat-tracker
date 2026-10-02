import { localRulesDatabase } from './localRules.js';

function nameSearch(list, { name, limit } = {}, { defaultLimit = 30, maxLimit = 200, map = (entry) => entry.name } = {}) {
  const needle = String(name || '').trim().toLocaleLowerCase();
  const cap = Math.max(1, Math.min(maxLimit, Number(limit) || defaultLimit));
  const results = [];
  for (const entry of list) {
    if (needle && !entry.name.toLocaleLowerCase().includes(needle)) continue;
    results.push(map(entry));
    if (results.length >= cap) break;
  }
  return results;
}

function getSources(record) {
  return (record?.sources || []).map((source) => source.publication || source.publications?.join(', ') || source.title || source.id).filter(Boolean);
}

export class CharacterOptionsLibrary {
  constructor(database = localRulesDatabase) {
    this.database = database;
    const manifest = database.getManifest();
    this.classEntries = manifest.classes || [];
    this.speciesEntries = database.getCatalog('species').items;
    this.weaponEntries = database.getCatalog('equipment').items
      .filter((entry) => entry.category === 'weapon')
      .map((entry) => {
        const record = database.getRecord(entry.path);
        return {
          id: entry.id,
          name: entry.name,
          description: record?.description || '',
          damage: record?.damage?.raw || record?.properties?.damage || '',
          damageType: record?.damage?.damageType || null,
          weaponProperties: record?.weaponProperties || [],
          mastery: record?.mastery || null,
          sources: getSources(record),
        };
      });
    this.spellEntries = database.getCatalog('spells').items;
  }

  searchClasses(options = {}) {
    return nameSearch(this.classEntries, options);
  }

  searchRaces(options = {}) {
    return nameSearch(this.speciesEntries, options);
  }

  searchWeapons(options = {}) {
    return nameSearch(this.weaponEntries, options, { defaultLimit: 200, maxLimit: 200, map: (entry) => entry });
  }

  searchSpells(options = {}) {
    return nameSearch(this.spellEntries, options, {
      defaultLimit: 20,
      maxLimit: 100,
      map: (entry) => ({
        id: entry.id,
        name: entry.name,
        level: Number.isInteger(entry.level) ? entry.level : 0,
        school: entry.school || null,
        sources: entry.publications || [],
      }),
    });
  }
}

export const characterOptionsLibrary = new CharacterOptionsLibrary();
