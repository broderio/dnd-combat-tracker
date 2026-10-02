const LEVEL_CAP = 20;
const RULE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

function numericLevel(value) {
  const level = Number.parseInt(value, 10);
  return Number.isFinite(level) ? Math.max(1, Math.min(LEVEL_CAP, level)) : 1;
}

/** Returns class and subclass features gained by the requested level, in level order. */
export function getCharacterFeatures(classRecord, subclassRecord, requestedLevel) {
  const level = numericLevel(requestedLevel);
  const collect = (record, source) => Object.entries(record?.featuresByLevel || {})
    .filter(([featureLevel]) => Number(featureLevel) <= level)
    .flatMap(([featureLevel, features]) => (Array.isArray(features) ? features : []).map((feature) => ({
      source,
      level: Number(featureLevel),
      name: String(feature.name || 'Feature'),
      description: String(feature.description || ''),
      tables: Array.isArray(feature.tables) ? feature.tables : [],
    })));

  return [...collect(classRecord, 'class'), ...collect(subclassRecord, 'subclass')]
    .sort((a, b) => a.level - b.level || a.source.localeCompare(b.source) || a.name.localeCompare(b.name));
}

/**
 * Resolve the currently supported generated option-source types. An unsupported or
 * unresolved source is explicit so callers can show a manual-choice warning rather
 * than presenting an empty list as if the rule had no options.
 */
export function resolveChoiceOptions(choice, { catalogs = {}, classId = null } = {}) {
  const inlineOptions = Array.isArray(choice?.options) ? choice.options : [];
  if (!choice?.optionSource) {
    return { supported: inlineOptions.length > 0, reason: inlineOptions.length ? null : 'No structured options are present.', items: inlineOptions };
  }

  const source = choice.optionSource;
  let items;
  switch (source.type) {
    case 'feat-list':
      items = (catalogs.feats || []).filter((feat) => {
        const isFightingStyle = source.eligibility === 'fighting-style'
          || source.id === 'fighting-style-feats'
          || choice.feature?.toLocaleLowerCase() === 'fighting style';
        return !isFightingStyle || /fighting style/i.test(feat.category || '');
      });
      break;
    case 'spell-list': {
      const classListId = source.id === 'class-spell-list' ? classId : source.id;
      if (!classListId) return { supported: false, reason: 'This spell list needs a selected class.', items: [] };
      items = (catalogs.spells || []).filter((spell) =>
        (spell.classes || []).some((entry) => (typeof entry === 'string' ? entry : entry.id) === classListId)
      );
      if (source.spellKind === 'cantrip') items = items.filter((spell) => Number(spell.level) === 0);
      if (source.spellKind === 'spell') items = items.filter((spell) => Number(spell.level) > 0);
      break;
    }
    case 'weapon-list':
      items = (catalogs.equipment || []).filter((item) =>
        item.category === 'weapon' || item.kind === 'weapon' || (item.weaponProperties || []).length > 0
      );
      break;
    case 'equipment-list':
      items = catalogs.equipment || [];
      break;
    case 'skill-list':
      items = catalogs.skills || [];
      break;
    case 'tool-list':
      items = catalogs.tools || [];
      break;
    case 'language-list':
      items = catalogs.languages || [];
      break;
    default:
      return { supported: false, reason: `Option source “${source.type}” is not supported by the builder yet.`, items: [] };
  }

  const result = Array.isArray(items) ? items : [];
  return {
    supported: true,
    reason: result.length ? null : 'The local database did not resolve any options for this source.',
    items: result,
  };
}

/** Create or replace one persisted choice selection without disturbing other choices. */
export function setBuildSelection(build, choiceId, selectedOptionIds) {
  const existing = Array.isArray(build?.selections) ? build.selections : [];
  const normalizedIds = [...new Set((Array.isArray(selectedOptionIds) ? selectedOptionIds : [])
    .map((id) => String(id || '').trim())
    .filter((id) => RULE_ID_PATTERN.test(id)))];
  const selections = existing.filter((selection) => selection?.choiceId !== choiceId);
  if (normalizedIds.length) selections.push({ choiceId, selectedOptionIds: normalizedIds });
  return { ...(build || {}), selections };
}

/** Adds or updates a spell's builder state without disturbing unrelated spells. */
export function setBuildSpell(build, spell, { status = 'known', sourceClassId = null } = {}) {
  const spells = Array.isArray(build?.spells) ? [...build.spells] : [];
  const id = String(spell?.id || '').trim();
  if (!RULE_ID_PATTERN.test(id)) return { ...(build || {}), spells };
  const next = {
    spellId: id,
    status: ['known', 'prepared', 'always-prepared'].includes(status) ? status : 'known',
    sourceClassId: sourceClassId ? String(sourceClassId) : null,
  };
  const index = spells.findIndex((entry) => entry.spellId === id && entry.sourceClassId === next.sourceClassId);
  if (index < 0) spells.push(next);
  else spells[index] = next;
  return { ...(build || {}), spells };
}
