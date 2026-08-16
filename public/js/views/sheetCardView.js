// public/js/views/sheetCardView.js
//
// Shared rendering building-blocks for the "stat card" shown in both the
// Monsters sidebar (monsterSheetView.js) and the character sheets
// (characterSheetView.js). Characters and monster instances have different
// underlying schemas but the same *presentation* — name/meta/stats, an HP
// bar, an ability score grid, quick-edit controls, and a handful of
// collapsible <details> sections (attacks, features, spells, description).
// Each view file is responsible for mapping its own data into these
// generic pieces; this file only knows how to build DOM from them.

import { computeCondition, SPELL_LEVELS } from '/shared/schema.js';

export function buildHpBar(hp) {
  const track = document.createElement('div');
  track.className = 'hp-bar-track';
  const fill = document.createElement('div');
  const pct = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0;
  fill.className = 'hp-bar-fill ' + computeCondition(hp);
  fill.style.width = pct + '%';
  track.appendChild(fill);
  return track;
}

/**
 * Renders one small bright-blue vertical rectangle per spell level that has
 * slots (max > 0), stacked left-to-right directly under the HP bar. Each
 * rectangle fills bottom-up in proportion to slots remaining (current/max),
 * with the spell level printed centered on top of it. Left-click spends a
 * slot (fill drops), right-click restores one (fill rises) — the same
 * click-to-spend / right-click-to-undo pattern used nowhere else yet, so a
 * tooltip spells it out.
 *
 * @param {Record<number, {max:number, current:number}>} spellSlots
 * @param {(level: number, nextCurrent: number) => void} onChange
 */
export function buildSpellSlotsRow(spellSlots, onChange) {
  if (!spellSlots) return null;
  const levels = SPELL_LEVELS.filter((level) => (spellSlots[level]?.max || 0) > 0);
  if (!levels.length) return null;

  const row = document.createElement('div');
  row.className = 'spell-slots-row';

  levels.forEach((level) => {
    const { max, current } = spellSlots[level];

    const column = document.createElement('div');
    column.className = 'spell-slot-column';

    const track = document.createElement('div');
    track.className = 'spell-slot-track';
    track.title = `Level ${level} slots: ${current}/${max} — click to spend, right-click to restore`;

    const fill = document.createElement('div');
    fill.className = 'spell-slot-fill';
    fill.style.height = `${max > 0 ? (current / max) * 100 : 0}%`;
    track.appendChild(fill);

    const label = document.createElement('div');
    label.className = 'spell-slot-level-label';
    label.textContent = level;
    track.appendChild(label);

    track.addEventListener('click', () => {
      if (current > 0) onChange(level, current - 1);
    });
    track.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (current < max) onChange(level, current + 1);
    });

    column.appendChild(track);
    row.appendChild(column);
  });

  return row;
}


export function abilityMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Derives a `{str: '+2', ...}`-shaped modifier map from raw ability scores. */
export function computeModifiers(scores) {
  if (!scores) return null;
  const mods = {};
  Object.entries(scores).forEach(([key, score]) => {
    mods[key] = abilityMod(score);
  });
  return mods;
}

export function buildAbilityScoreGrid(scores, modifiers) {
  if (!scores) return null;
  const grid = document.createElement('div');
  grid.className = 'char-sheet-abilities';
  Object.entries(scores).forEach(([key, score]) => {
    const pill = document.createElement('div');
    pill.className = 'ability-pill';
    const mod = modifiers && modifiers[key] ? `<span class="mod">${modifiers[key]}</span>` : '';
    pill.innerHTML = `${key.toUpperCase()}<span class="val">${score}</span>${mod}`;
    grid.appendChild(pill);
  });
  return grid;
}

// Wraps content in a <details>/<summary> so the browser handles expand/
// collapse for free — no click handlers to write or maintain. Returns null
// when there's nothing to show, so callers can skip appending empty
// sections rather than rendering a dropdown with nothing inside it.
export function buildDetailsSection(title, contentEl, { open = false, count = null } = {}) {
  if (!contentEl) return null;

  const details = document.createElement('details');
  details.className = 'monster-details';
  if (open) details.open = true;

  const summary = document.createElement('summary');
  summary.textContent = count !== null ? `${title} (${count})` : title;
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'monster-details-body';
  body.appendChild(contentEl);
  details.appendChild(body);

  return details;
}

export function buildAttacksList(attacks) {
  if (!attacks?.length) return null;

  const list = document.createElement('div');
  list.className = 'monster-attacks-list';

  attacks.forEach((attack) => {
    const item = document.createElement('div');
    item.className = 'monster-attack';

    const name = document.createElement('div');
    name.className = 'monster-attack-name';
    name.textContent = attack.name || 'Unnamed Attack';
    item.appendChild(name);

    const details = document.createElement('div');
    details.className = 'monster-attack-details';
    const properties = [];
    if (attack.attackType) properties.push(attack.attackType);
    if (attack.reach) properties.push(`Reach ${attack.reach}`);
    if (attack.targets) properties.push(`Targets ${attack.targets}`);
    if (properties.length) {
      details.textContent = properties.join(' · ');
      item.appendChild(details);
    }

    if (attack.toHit) {
      const roll = document.createElement('div');
      roll.className = 'monster-attack-roll';
      roll.innerHTML = `<strong>${attack.toHit}</strong> to hit`;
      item.appendChild(roll);
    }

    if (attack.damage) {
      const damage = document.createElement('div');
      damage.className = 'monster-attack-damage';
      const damageText = attack.damageType ? `${attack.damage} ${attack.damageType}` : attack.damage;
      damage.innerHTML = `<strong>Damage:</strong> ${damageText}`;
      item.appendChild(damage);
    }

    if (attack.desc) {
      const desc = document.createElement('div');
      desc.className = 'monster-attack-details';
      desc.textContent = attack.desc;
      item.appendChild(desc);
    }

    list.appendChild(item);
  });

  return list;
}

// Traits, non-attack Actions, Bonus Actions, Reactions, and Legendary
// Actions are all the same { name, desc } shape in the underlying data —
// grouped into one section with a small tag per entry instead of five
// mostly-empty dropdowns. Character "Features" reuse the same renderer.
export function buildFeatureList(entries) {
  if (!entries?.length) return null;
  const wrap = document.createElement('div');
  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'monster-feature';
    const tagHtml = entry.tag ? `<span class="monster-feature-tag">${entry.tag}</span>` : '';
    const nameLine = document.createElement('div');
    nameLine.innerHTML = `<span class="monster-feature-name">${entry.name}</span>${tagHtml}`;
    item.appendChild(nameLine);
    if (entry.desc) {
      const desc = document.createElement('div');
      desc.className = 'monster-feature-desc';
      desc.textContent = entry.desc;
      item.appendChild(desc);
    }
    wrap.appendChild(item);
  });
  return wrap;
}

function titleCase(str) {
  return str.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

function buildSpellGroupList(groups) {
  if (!groups) return null;
  const entries = Object.entries(groups).filter(([, spells]) => spells && spells.length);
  if (!entries.length) return null;
  const wrap = document.createElement('div');
  entries.forEach(([label, spells]) => {
    const group = document.createElement('div');
    group.className = 'monster-spell-group';
    group.innerHTML = `<span class="monster-spell-group-label">${label}:</span> ${spells.map(titleCase).join(', ')}`;
    wrap.appendChild(group);
  });
  return wrap;
}

/** Monster-style spellcasting: ability + grouped-by-level/innate spell lists. */
export function buildSpellcastingContent(spellcasting) {
  if (!spellcasting) return null;
  const wrap = document.createElement('div');

  if (spellcasting.ability) {
    const ability = document.createElement('div');
    ability.className = 'monster-feature';
    ability.innerHTML = `<strong>Spellcasting Ability:</strong> ${spellcasting.ability}`;
    wrap.appendChild(ability);
  }

  const innate = buildSpellGroupList(spellcasting.innate);
  if (innate) wrap.appendChild(innate);

  const byLevel = buildSpellGroupList(spellcasting.spellsByLevel);
  if (byLevel) wrap.appendChild(byLevel);

  if (!innate && !byLevel && spellcasting.spellList && spellcasting.spellList.length) {
    const flat = document.createElement('div');
    flat.textContent = spellcasting.spellList.join(', ');
    wrap.appendChild(flat);
  }

  return wrap.childElementCount ? wrap : null;
}

/** Character-style spellcasting: a flat list of { name, level, school } picked from dnd-data search. */
export function buildFlatSpellList(spells) {
  if (!spells?.length) return null;
  const wrap = document.createElement('div');
  spells.forEach((spell) => {
    const row = document.createElement('div');
    row.className = 'monster-spell-group';
    const levelLabel = spell.level ? `Level ${spell.level}` : 'Cantrip';
    row.innerHTML = `<span class="monster-spell-group-label">${spell.name}</span> — ${levelLabel}${
      spell.school ? ' · ' + titleCase(spell.school) : ''
    }`;
    wrap.appendChild(row);
  });
  return wrap;
}

export function buildLabelValueRow(label, value) {
  if (!value && value !== 0) return null;
  const row = document.createElement('div');
  row.innerHTML = `<strong>${label}:</strong> ${value}`;
  return row;
}

/** Builds a two-column grid of label/value rows, skipping any with no value. Returns null if none rendered. */
export function buildRowsGrid(rows) {
  const grid = document.createElement('div');
  grid.className = 'monster-statblock-grid';
  let any = false;
  rows.forEach(([label, value]) => {
    const row = buildLabelValueRow(label, value);
    if (row) {
      grid.appendChild(row);
      any = true;
    }
  });
  return any ? grid : null;
}

export function buildDescriptionContent(text, className = 'char-sheet-notes') {
  if (!text) return null;
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/**
 * Assembles a full `.char-sheet-card` from a normalized model:
 * @param {{
 *   badge?: string, name: string, meta?: string, stats?: [string, string|number][],
 *   hp: {current:number,max:number}, topAbilitiesEl?: Element, notes?: string,
 *   quickEditEl?: Element, editButtonEl?: Element,
 *   sections?: Array<{title: string, contentEl: Element|null, open?: boolean, count?: number|null}>
 * }} model
 */
export function buildSheetCard(model) {
  const card = document.createElement('div');
  card.className = 'char-sheet-card';

  const nameEl = document.createElement('div');
  nameEl.className = 'char-sheet-name';
  nameEl.textContent = model.badge ? `${model.badge} ${model.name}`.trim() : model.name;
  card.appendChild(nameEl);

  if (model.meta) {
    const metaEl = document.createElement('div');
    metaEl.className = 'char-sheet-meta';
    metaEl.textContent = model.meta;
    card.appendChild(metaEl);
  }

  if (model.stats?.length) {
    const statsEl = document.createElement('div');
    statsEl.className = 'char-sheet-stats';
    statsEl.innerHTML = model.stats.map(([label, value]) => `<div>${label} <strong>${value}</strong></div>`).join('');
    card.appendChild(statsEl);
  }

  card.appendChild(buildHpBar(model.hp));

  if (model.spellSlotsEl) card.appendChild(model.spellSlotsEl);

  if (model.topAbilitiesEl) card.appendChild(model.topAbilitiesEl);

  if (model.notes) {
    const notes = document.createElement('div');
    notes.className = 'char-sheet-notes';
    notes.textContent = model.notes;
    card.appendChild(notes);
  }

  if (model.quickEditEl) card.appendChild(model.quickEditEl);
  if (model.editButtonEl) card.appendChild(model.editButtonEl);

  (model.sections || []).forEach(({ title, contentEl, open, count }) => {
    const section = buildDetailsSection(title, contentEl, { open, count: count ?? null });
    if (section) card.appendChild(section);
  });

  return card;
}
