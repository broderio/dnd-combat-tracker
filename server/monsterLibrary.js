// server/monsterLibrary.js
//
// The one small adapter between the `dnd-data` npm package (11,463 local,
// bundled JSON entries — no network calls, see package.json) and this app's
// combat model. `dnd-data`'s `properties` bag isn't documented and isn't
// consistent entry-to-entry (older/simpler entries carry only Category/Size/
// Type/Alignment/Challenge Rating; richer ones — mostly 5e SRD content —
// also carry AC/HP/Speed/data-*Num/data-Actions). This module normalizes
// that into one `MonsterTemplate`-shaped object per entry, tolerating
// missing fields, so the rest of the app (search endpoint, DM picker, token
// placement) never has to know about `dnd-data`'s raw shape.
//
// Deliberately read-only reference data: no homebrew/custom monster editor,
// and this module never mutates `monsters`.

import { monsters } from 'dnd-data';

/**
 * Pulls the leading integer out of a string like "135 (18d10+36)" or
 * "17 (Natural Armor)". Falls back to `fallback` if nothing parses.
 */
function parseLeadingInt(value, fallback = null) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const match = value.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : fallback;
}

/**
 * `data-Actions` (and the Legendary/Reaction/Bonus Action variants) are a
 * JSON-encoded string, when present, shaped like
 * `[{ Name, Desc, "Type Attack"?, Type?, "Hit Bonus"?, Reach?, Target?,
 * Damage?, "Damage Type"? }, ...]`. Only entries that look like an actual
 * attack (have a "Hit Bonus" or "Damage") are kept — many are prose-only
 * traits/reactions with just a Name/Desc, which aren't useful as a
 * structured "attacks" list for the DM sidebar.
 */
function parseAttacks(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((a) => a && (a['Hit Bonus'] !== undefined || a['Damage'] !== undefined))
    .map((a) => ({
      name: a.Name || 'Attack',
      toHit: a['Hit Bonus'] !== undefined ? `+${a['Hit Bonus']}` : null,
      damage: a.Damage || null,
      damageType: a['Damage Type'] || null,
      desc: a.Desc || '',
    }))
    .slice(0, 10); // bounded — some entries have a long tail of minor options
}

/**
 * Normalizes one raw `dnd-data` monster entry (by its index in the array,
 * used as a stable-enough id for this read-only, never-reordered dataset)
 * into the flat shape the rest of the app consumes.
 */
function toTemplate(entry, index) {
  const p = entry.properties || {};
  return {
    id: 'mon_' + index,
    name: entry.name,
    size: p.Size || '',
    type: p.Type || '',
    alignment: p.Alignment || '',
    cr: p['data-CrNum'] ?? parseLeadingInt(p['Challenge Rating']),
    ac: p['data-AcNum'] ?? parseLeadingInt(p.AC),
    hpMax: p['data-HpNum'] ?? parseLeadingInt(p.HP),
    speed: p.Speed || '',
    attacks: parseAttacks(p['data-Actions']),
    source: entry.book || entry.publisher || '',
  };
}

/**
 * Owns the one-time normalization of the `dnd-data` array into
 * `MonsterTemplate`s, plus the bounded search/filter used by the monster
 * picker endpoint. Normalizing once at construction (not per-request) is
 * worth it at 11k entries; the raw `dnd-data` array and everything derived
 * from it stays server-side — only bounded, filtered results ever reach the
 * browser (see server/routes/monsters.js).
 */
export class MonsterLibrary {
  constructor(rawMonsters) {
    // Only monsters with a usable AC, HP, speed, and at least one parsed
    // attack are kept — `dnd-data` has many older/simpler entries that carry
    // just Category/Size/Type/Alignment/Challenge Rating, which aren't
    // playable as a placed combat token (no HP to track, no attacks to show
    // the DM), so they're filtered out of the picker entirely rather than
    // showing up as unusable search results.
    this.templates = rawMonsters
      .map((entry, index) => toTemplate(entry, index))
      .filter((t) => t.ac !== null && t.hpMax !== null && t.speed && t.attacks.length > 0);
    this.byId = new Map(this.templates.map((t) => [t.id, t]));
  }

  getTemplate(id) {
    return this.byId.get(id) || null;
  }

  /**
   * `{ name, crMin, crMax, type, limit }`, all optional. Returns a bounded,
   * lightweight summary list (no `attacks`/`source` — those are only needed
   * once the DM is looking at one specific monster) capped at `limit`
   * (default 50, max 200) so an unfiltered search can't ship a huge payload.
   */
  search({ name, crMin, crMax, type, limit } = {}) {
    const nameNeedle = (name || '').trim().toLowerCase();
    const typeNeedle = (type || '').trim().toLowerCase();
    const min = crMin !== undefined && crMin !== '' ? Number(crMin) : null;
    const max = crMax !== undefined && crMax !== '' ? Number(crMax) : null;
    const cap = Math.max(1, Math.min(200, Number(limit) || 50));

    const results = [];
    for (const t of this.templates) {
      if (nameNeedle && !t.name.toLowerCase().includes(nameNeedle)) continue;
      if (typeNeedle && t.type.toLowerCase() !== typeNeedle) continue;
      if (min !== null && !Number.isNaN(min) && (t.cr === null || t.cr < min)) continue;
      if (max !== null && !Number.isNaN(max) && (t.cr === null || t.cr > max)) continue;
      results.push({
        id: t.id,
        name: t.name,
        size: t.size,
        type: t.type,
        cr: t.cr,
        ac: t.ac,
        hpMax: t.hpMax,
      });
      if (results.length >= cap) break;
    }
    return results;
  }
}

export const monsterLibrary = new MonsterLibrary(monsters);
