import { MonsterInstance } from '../shared/schema.js';
import { localRulesDatabase } from './localRules.js';

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function signed(value) {
  return Number(value) >= 0 ? `+${value}` : String(value);
}

function formatSkills(skills) {
  if (!Array.isArray(skills) || !skills.length) return null;
  return skills.map((skill) => `${skill.name} ${signed(skill.bonus)}`).join(', ');
}

function formatSavingThrows(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const saves = ABILITY_KEYS
    .filter((key) => Number.isFinite(scores[key]?.savingThrow))
    .map((key) => `${key.toUpperCase()} ${signed(scores[key].savingThrow)}`);
  return saves.length ? saves.join(', ') : null;
}

function mapAbility(entry) {
  const damage = Array.isArray(entry.damage) ? entry.damage : [];
  const attackRolls = Array.isArray(entry.attackRolls) ? entry.attackRolls : [];
  const targeting = Array.isArray(entry.targeting) ? entry.targeting : [];
  const damageText = damage.map((part) => part.raw || `${part.average ?? ''} (${part.formula || ''}) ${part.damageType || ''} damage`.trim()).filter(Boolean).join('; ');
  const firstAttack = attackRolls[0];
  const reach = targeting.find((target) => target.kind === 'reach' || target.kind === 'range');
  return {
    id: entry.id || null,
    name: entry.name || 'Unnamed ability',
    toHit: Number.isFinite(firstAttack?.bonus) ? signed(firstAttack.bonus) : null,
    attackType: firstAttack?.kind || null,
    reach: reach ? `${reach.distanceFeet ?? ''}${reach.longDistanceFeet ? `/${reach.longDistanceFeet}` : ''} ft.` : null,
    targets: null,
    damage: damageText || null,
    damageType: damage.map((part) => part.damageType).filter(Boolean).join(', ') || null,
    mechanicsSummary: entry.mechanicsSummary || null,
    damageRolls: damage,
    attackRolls,
    savingThrows: entry.savingThrows || [],
    desc: entry.description || '',
  };
}

function mapAbilityList(list = []) {
  return Array.isArray(list) ? list.filter((entry) => entry && entry.name).map(mapAbility) : [];
}

function mapSpellcasting(abilities) {
  for (const section of Object.values(abilities || {})) {
    for (const entry of Array.isArray(section) ? section : []) {
      if (!entry?.spellcasting) continue;
      const groups = {};
      for (const group of entry.spellcasting.spellsByFrequency || []) {
        if (group.frequency && group.spellNames?.length) groups[group.frequency] = group.spellNames;
      }
      return {
        ability: entry.spellcasting.ability || null,
        spellsByLevel: groups,
        spellList: null,
        saveDC: entry.spellcasting.saveDC ?? null,
      };
    }
  }
  return null;
}

function parsePassivePerception(senses) {
  const match = String(senses || '').match(/passive perception\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function numericValue(value, key) {
  if (Number.isFinite(value)) return value;
  return Number.isFinite(value?.[key]) ? value[key] : null;
}

function toTemplate(summary, record) {
  const armorClass = numericValue(record?.armorClass, 'value');
  const hitPoints = numericValue(record?.hitPoints, 'average');
  if (!record || record.detailAvailable === false || armorClass === null || hitPoints === null) {
    return null;
  }
  const abilityScores = {};
  const abilityModifiers = {};
  for (const key of ABILITY_KEYS) {
    const value = record.abilityScores?.[key];
    if (Number.isFinite(value?.score)) abilityScores[key] = value.score;
    if (Number.isFinite(value?.modifier)) abilityModifiers[key] = signed(value.modifier);
  }
  const abilities = record.abilities || {};
  const actions = mapAbilityList(abilities.actions);
  const attacks = actions.filter((action) => action.attackRolls.length || action.damageRolls.length);
  const monster = MonsterInstance.default();

  monster.id = summary.id;
  monster.name = record.name || summary.name;
  monster.description = record.description || '';
  monster.size = record.size || summary.size || '';
  monster.type = record.creatureType || summary.creatureType || '';
  monster.alignment = record.alignment || summary.alignment || '';
  monster.cr = record.challengeRating?.numeric ?? summary.challengeRating?.numeric ?? null;
  monster.ac = armorClass;
  monster.hpMax = hitPoints;
  monster.hitDice = record.hitPoints?.hitDice || null;
  monster.speed = record.speed?.raw || '';
  monster.xp = record.experiencePoints ?? null;
  monster.proficiencyBonus = record.proficiencyBonus ?? record.challengeRating?.proficiencyBonus ?? null;
  monster.passivePerception = parsePassivePerception(record.senses);
  monster.senses = record.senses || null;
  monster.skills = formatSkills(record.skills);
  monster.savingThrows = formatSavingThrows(record.abilityScores);
  monster.languages = Array.isArray(record.languages) ? record.languages.join(', ') : record.languages || null;
  monster.conditionImmunities = Array.isArray(record.conditionImmunities) ? record.conditionImmunities.join(', ') : record.conditionImmunities || null;
  monster.damageImmunities = Array.isArray(record.damageImmunities) ? record.damageImmunities.join(', ') : record.damageImmunities || null;
  monster.damageResistances = Array.isArray(record.damageResistances) ? record.damageResistances.join(', ') : record.damageResistances || null;
  monster.damageVulnerabilities = Array.isArray(record.damageVulnerabilities) ? record.damageVulnerabilities.join(', ') : record.damageVulnerabilities || null;
  monster.abilityScores = Object.keys(abilityScores).length ? abilityScores : null;
  monster.abilityModifiers = Object.keys(abilityModifiers).length ? abilityModifiers : null;
  monster.traits = mapAbilityList(abilities.traits);
  monster.actions = actions;
  monster.attacks = attacks;
  monster.bonusActions = mapAbilityList(abilities.bonusActions);
  monster.reactions = mapAbilityList(abilities.reactions);
  monster.legendaryActions = mapAbilityList(abilities.legendaryActions);
  monster.spellcasting = record.spellcasting || mapSpellcasting(abilities);
  monster.source = (record.publications || summary.publications || []).join(', ');

  const template = monster.toJSON();
  delete template.hp;
  delete template.statusEffects;
  delete template.templateId;
  return template;
}

export class MonsterLibrary {
  constructor(database = localRulesDatabase) {
    this.database = database;
    this.summaries = database.getCatalog('monsters').items.filter((entry) => entry.detailAvailable !== false);
    this.byId = new Map(this.summaries.map((entry) => [entry.id, entry]));
  }

  getTemplate(id) {
    const summary = this.byId.get(id);
    if (!summary) return null;
    const record = this.database.getRecord(summary.path);
    return toTemplate(summary, record);
  }

  search({ name, crMin, crMax, type, limit } = {}) {
    const nameNeedle = (name || '').trim().toLocaleLowerCase();
    const typeNeedle = (type || '').trim().toLocaleLowerCase();
    const min = crMin !== undefined && crMin !== '' ? Number(crMin) : null;
    const max = crMax !== undefined && crMax !== '' ? Number(crMax) : null;
    const cap = Math.max(1, Math.min(200, Number(limit) || 50));
    const results = [];
    for (const entry of this.summaries) {
      const cr = entry.challengeRating?.numeric ?? null;
      if (nameNeedle && !entry.name.toLocaleLowerCase().includes(nameNeedle)) continue;
      if (typeNeedle && !(entry.creatureType || '').toLocaleLowerCase().includes(typeNeedle)) continue;
      if (min !== null && !Number.isNaN(min) && (cr === null || cr < min)) continue;
      if (max !== null && !Number.isNaN(max) && (cr === null || cr > max)) continue;
      results.push({
        id: entry.id,
        name: entry.name,
        size: entry.size || '',
        type: entry.creatureType || '',
        cr,
        ac: entry.armorClass ?? null,
        hpMax: entry.hitPoints ?? null,
        source: (entry.publications || []).join(', '),
      });
      if (results.length >= cap) break;
    }
    return results;
  }
}

export const monsterLibrary = new MonsterLibrary();
