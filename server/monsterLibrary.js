import { monsters } from 'dnd-data';
import { MonsterInstance } from '../shared/schema.js';

function parseLeadingInt(value, fallback = null) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const match = value.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : fallback;
}

function parseXP(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function parseActions(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((a) => a && a.Name)
    .map((a) => ({
      name: a.Name,
      toHit: a['Hit Bonus'] !== undefined ? `+${a['Hit Bonus']}` : null,
      attackType: a['Type Attack'] || null,
      reach: a.Reach || null,
      targets: a.Targets || null,
      damage: a.Damage || null,
      damageType: a['Damage Type'] || null,
      desc: a.Desc || '',
    }))
    .slice(0, 20); // bounded — some entries have a long tail of minor options
}

function parseFeatureList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((f) => f && f.Name)
    .map((f) => ({ name: f.Name, desc: f.Desc || '' }))
    .slice(0, 20);
}

function parseSpellcasting(rawSpells, spellBookFallback, ability) {
  let structured = null;
  if (rawSpells && typeof rawSpells === 'string') {
    try {
      structured = JSON.parse(rawSpells);
    } catch {
      structured = null;
    }
  }
  const hasStructured = structured && (structured.spells || structured.innate);
  if (!hasStructured && !spellBookFallback) return null;

  return {
    ability: ability || null,
    innate: (structured && structured.innate) || null,
    spellsByLevel: (structured && structured.spells) || null,
    spellList: spellBookFallback
      ? spellBookFallback
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null,
  };
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function parseAbilityScores(p) {
  const scores = {};
  let any = false;
  for (const key of ABILITY_KEYS) {
    const raw = p[key.toUpperCase()];
    if (typeof raw === 'number') {
      scores[key] = raw;
      any = true;
    }
  }
  return any ? scores : null;
}

function parseAbilityModifiers(p, scores) {
  const mods = {};
  let any = false;
  for (const key of ABILITY_KEYS) {
    const raw = p[`data-${key.toUpperCase()}-mod`];
    if (typeof raw === 'string' && raw.trim()) {
      mods[key] = raw.trim();
      any = true;
    } else if (scores && typeof scores[key] === 'number') {
      const mod = Math.floor((scores[key] - 10) / 2);
      mods[key] = mod >= 0 ? `+${mod}` : `${mod}`;
      any = true;
    }
  }
  return any ? mods : null;
}

function toTemplate(entry, index) {
  const p = entry.properties || {};
  const actions = parseActions(p['data-Actions']);
  const attacks = actions.filter((a) => a.toHit !== null || a.damage !== null);
  const abilityScores = parseAbilityScores(p);

  const monster = MonsterInstance.default();

  monster.id = 'mon_' + index;
  monster.name = entry.name;
  monster.description = entry.description || '';
  monster.size = p.Size || '';
  monster.type = p.Type || '';
  monster.alignment = p.Alignment || '';
  monster.cr = p['data-CrNum'] ?? parseLeadingInt(p['Challenge Rating']);
  monster.ac = p['data-AcNum'] ?? parseLeadingInt(p.AC);
  monster.hpMax = p['data-HpNum'] ?? parseLeadingInt(p.HP);
  monster.hitDice = p['Hit Dice'] || null;
  monster.speed = p.Speed || '';
  monster.xp = parseXP(p['data-XP']);
  monster.proficiencyBonus = parseLeadingInt(p.PB);
  monster.passivePerception =
    typeof p['Passive Perception'] === 'number' ? p['Passive Perception'] : parseLeadingInt(p['Passive Perception']);
  monster.senses = p.Senses || null;
  monster.skills = p.Skills || null;
  monster.savingThrows = p['Saving Throws'] || null;
  monster.languages = p.Languages || null;
  monster.conditionImmunities = p['Condition Immunities'] || null;
  monster.damageImmunities = p.Immunities || null;
  monster.damageResistances = p.Resistances || null;
  monster.damageVulnerabilities = p.Vulnerabilities || null;
  monster.abilityScores = abilityScores;
  monster.abilityModifiers = parseAbilityModifiers(p, abilityScores);
  monster.traits = parseFeatureList(p['data-Traits']);
  monster.actions = actions;
  monster.attacks = attacks;
  monster.bonusActions = parseFeatureList(p['data-Bonus Actions']);
  monster.reactions = parseFeatureList(p['data-Reactions']);
  monster.legendaryActions = parseFeatureList(p['data-Legendary Actions']);
  monster.spellcasting = parseSpellcasting(p['data-Spells'], p['Spell Book'], p['Spellcasting Ability']);
  monster.tokenImageUrl = p.Token || null;
  monster.source = entry.book || entry.publisher || '';

  const template = monster.toJSON();

  delete template.hp;
  delete template.statusEffects;
  delete template.templateId;

  return template;
}

export class MonsterLibrary {
  constructor(rawMonsters) {
    this.templates = rawMonsters
      .map((entry, index) => toTemplate(entry, index))
      .filter((t) => t.ac !== null && t.hpMax !== null && t.speed);
    this.byId = new Map(this.templates.map((t) => [t.id, t]));
  }

  getTemplate(id) {
    return this.byId.get(id) || null;
  }

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
