import { computeCondition } from '/shared/schema.js';
import { EVENTS } from '/shared/protocol.js';

import { socketClient } from '../socketClient.js';
import { clientState } from '../state.js';

import { buildQuickEditControls } from './quickEditControls.js';

const monstersView = document.getElementById('monsters-view');

export function monsterBadgeLabel(combatantId) {
  const match = /(\d+)$/.exec(combatantId || ''); // e.g. "moninst_42" → "42"
  return match ? `#${match[1]}` : '';
}

function buildAttacksList(attacks) {
  if (!attacks?.length) return null;

  const list = document.createElement('div');
  list.className = 'monster-attacks-list';

  attacks.forEach((attack) => {
    const item = document.createElement('div');
    item.className = 'monster-attack';

    // Attack name
    const name = document.createElement('div');
    name.className = 'monster-attack-name';
    name.textContent = attack.name || 'Unnamed Attack';
    item.appendChild(name);

    // Attack type / targeting information
    const details = document.createElement('div');
    details.className = 'monster-attack-details';

    const properties = [];

    if (attack.attackType) {
      properties.push(attack.attackType);
    }

    if (attack.reach) {
      properties.push(`Reach ${attack.reach}`);
    }

    if (attack.targets) {
      properties.push(`Targets ${attack.targets}`);
    }

    if (properties.length) {
      details.textContent = properties.join(' · ');
      item.appendChild(details);
    }

    // Attack roll
    if (attack.toHit) {
      const roll = document.createElement('div');
      roll.className = 'monster-attack-roll';
      roll.innerHTML = `<strong>${attack.toHit}</strong> to hit`;
      item.appendChild(roll);
    }

    // Damage
    if (attack.damage) {
      const damage = document.createElement('div');
      damage.className = 'monster-attack-damage';
      const damageText = attack.damageType ? `${attack.damage} ${attack.damageType}` : attack.damage;
      damage.innerHTML = `<strong>Damage:</strong> ${damageText}`;
      item.appendChild(damage);
    }

    list.appendChild(item);
  });

  return list;
}

// Wraps content in a <details>/<summary> so the browser handles expand/
// collapse for free — no click handlers to write or maintain. Returns null
// when there's nothing to show, so callers can skip appending empty
// sections rather than rendering a dropdown with nothing inside it.
function buildDetailsSection(title, contentEl, { open = false, count = null } = {}) {
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

// Traits, non-attack Actions (e.g. Multiattack), Bonus Actions, Reactions,
// and Legendary Actions are all the same { name, desc } shape in the
// underlying data — grouped into one section with a small tag per entry
// instead of five mostly-empty dropdowns.
function buildFeatureEntries(instance) {
  const nonAttackActions = (instance.actions || []).filter((a) => a.toHit === null && a.damage === null);
  return [
    ...(instance.traits || []).map((f) => ({ ...f, tag: 'Trait' })),
    ...nonAttackActions.map((f) => ({ ...f, tag: 'Action' })),
    ...(instance.bonusActions || []).map((f) => ({ ...f, tag: 'Bonus Action' })),
    ...(instance.reactions || []).map((f) => ({ ...f, tag: 'Reaction' })),
    ...(instance.legendaryActions || []).map((f) => ({ ...f, tag: 'Legendary' })),
  ];
}

function buildFeatureList(entries) {
  if (!entries.length) return null;
  const wrap = document.createElement('div');
  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'monster-feature';
    const nameLine = document.createElement('div');
    nameLine.innerHTML = `<span class="monster-feature-name">${entry.name}</span><span class="monster-feature-tag">${entry.tag}</span>`;
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

function buildSpellcastingContent(spellcasting) {
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

  // Only fall back to the flat list if neither structured group rendered
  // anything — avoids showing the same spells twice.
  if (!innate && !byLevel && spellcasting.spellList && spellcasting.spellList.length) {
    const flat = document.createElement('div');
    flat.textContent = spellcasting.spellList.join(', ');
    wrap.appendChild(flat);
  }

  return wrap.childElementCount ? wrap : null;
}

function buildLabelValueRow(label, value) {
  if (!value && value !== 0) return null;
  const row = document.createElement('div');
  row.innerHTML = `<strong>${label}:</strong> ${value}`;
  return row;
}

function buildAbilityScoreGrid(scores, modifiers) {
  if (!scores) return null;
  const grid = document.createElement('div');
  grid.className = 'char-sheet-abilities'; // reuse the player character-sheet ability grid styling
  Object.entries(scores).forEach(([key, score]) => {
    const pill = document.createElement('div');
    pill.className = 'ability-pill';
    const mod = modifiers && modifiers[key] ? `<span class="mod">${modifiers[key]}</span>` : '';
    pill.innerHTML = `${key.toUpperCase()}<span class="val">${score}</span>${mod}`;
    grid.appendChild(pill);
  });
  return grid;
}

function buildStatBlockContent(instance) {
  const wrap = document.createElement('div');

  const abilityGrid = buildAbilityScoreGrid(instance.abilityScores, instance.abilityModifiers);
  if (abilityGrid) wrap.appendChild(abilityGrid);

  const rows = [
    ['Saving Throws', instance.savingThrows],
    ['Skills', instance.skills],
    ['Senses', instance.senses],
    ['Passive Perception', instance.passivePerception],
    ['Languages', instance.languages],
    ['Condition Immunities', instance.conditionImmunities],
    ['Damage Immunities', instance.damageImmunities],
    ['Damage Resistances', instance.damageResistances],
    ['Damage Vulnerabilities', instance.damageVulnerabilities],
    ['Hit Dice', instance.hitDice],
    ['Proficiency Bonus', instance.proficiencyBonus],
    ['XP', instance.xp],
    ['Source', instance.source],
  ];

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
  if (any) wrap.appendChild(grid);

  return wrap.childElementCount ? wrap : null;
}

function buildDescriptionContent(description) {
  if (!description) return null;
  const p = document.createElement('p');
  p.className = 'char-sheet-notes'; // reuse existing notes styling (dim, wrapped text)
  p.textContent = description;
  return p;
}

function buildMonsterCard(instance) {
  const card = document.createElement('div');
  card.className = 'char-sheet-card';

  const name = document.createElement('div');
  name.className = 'char-sheet-name';
  name.textContent = `${monsterBadgeLabel(instance.id)} ${instance.name}`.trim();

  const meta = document.createElement('div');
  meta.className = 'char-sheet-meta';
  const crText = instance.cr === null || instance.cr === undefined ? '?' : instance.cr;
  meta.textContent = `${instance.size || ''} ${instance.type || ''} · CR ${crText}`.trim();

  const stats = document.createElement('div');
  stats.className = 'char-sheet-stats';
  stats.innerHTML = `<div>AC <strong>${instance.ac}</strong></div><div>Speed <strong>${
    instance.speed || '—'
  }</strong></div>`;

  const hpTrack = document.createElement('div');
  hpTrack.className = 'hp-bar-track';
  const hpFill = document.createElement('div');
  const pct = instance.hp.max > 0 ? Math.max(0, Math.min(100, (instance.hp.current / instance.hp.max) * 100)) : 0;
  hpFill.className = 'hp-bar-fill ' + computeCondition(instance.hp);
  hpFill.style.width = pct + '%';
  hpTrack.appendChild(hpFill);

  card.append(name, meta, stats, hpTrack);

  card.appendChild(
    buildQuickEditControls(instance.hp, instance.statusEffects, {
      onAdjustHp: (delta) => {
        const next = Math.max(-9999, Math.min(9999, instance.hp.current + delta));
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { current: next } });
      },
      onSetCurrentHp: (current) => {
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { current } });
      },
      onSetMaxHp: (max) => {
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { max } });
      },
      onToggleEffect: (effect, checked) => {
        const current = new Set(instance.statusEffects || []);
        if (checked) current.add(effect);
        else current.delete(effect);
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, {
          id: instance.id,
          statusEffects: Array.from(current),
        });
      },
    })
  );

  if (instance.attacks && instance.attacks.length) {
    const attacksSection = buildDetailsSection('Attacks', buildAttacksList(instance.attacks), {
      open: true,
      count: instance.attacks.length,
    });
    card.appendChild(attacksSection);
  }

  const featureEntries = buildFeatureEntries(instance);
  const traitsSection = buildDetailsSection('Traits & Special Actions', buildFeatureList(featureEntries), {
    count: featureEntries.length,
  });
  if (traitsSection) card.appendChild(traitsSection);

  const spellcastingSection = buildDetailsSection('Spellcasting', buildSpellcastingContent(instance.spellcasting));
  if (spellcastingSection) card.appendChild(spellcastingSection);

  const statBlockSection = buildDetailsSection('Stat Block', buildStatBlockContent(instance));
  if (statBlockSection) card.appendChild(statBlockSection);

  const descriptionSection = buildDetailsSection('Description', buildDescriptionContent(instance.description));
  if (descriptionSection) card.appendChild(descriptionSection);

  return card;
}

/** Renders every placed monster instance into the Monsters sidebar — DM-only, a no-op for players. */
export function renderMonsterSidebar() {
  if (clientState.session.mode !== 'dm') return;
  monstersView.innerHTML = '';
  const instances = Object.values(clientState.dmMonsterInstances);
  if (instances.length === 0) return;
  instances.forEach((instance) => monstersView.appendChild(buildMonsterCard(instance)));
}
