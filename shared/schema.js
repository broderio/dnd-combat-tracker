export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const CHARACTER_FIELDS = [
  {
    key: 'name',
    kind: 'text',
    label: 'Name',
    maxLength: 60,
    default: 'New Character',
    emptyFallback: 'Unnamed',
  },
  { key: 'class', kind: 'text', label: 'Class', maxLength: 40, default: '' },
  { key: 'race', kind: 'text', label: 'Race', maxLength: 40, default: '' },
  { key: 'level', kind: 'int', label: 'Level', min: 1, max: 20, default: 1 },
  { key: 'ac', kind: 'int', label: 'Armor Class', min: 0, max: 40, default: 10 },
  { key: 'notes', kind: 'text', label: 'Notes', maxLength: 2000, default: '' },
  {
    key: 'tokenColor',
    kind: 'color',
    label: 'Token Color',
    maxLength: 7,
    default: '#e63946',
  },
];

export const HP_FIELDS = [
  { key: 'current', label: 'HP (current)', min: -9999, max: 9999, default: 10 },
  { key: 'max', label: 'HP (max)', min: 0, max: 9999, default: 10 },
];

export const GRID_FIELDS = [
  { key: 'cols', label: 'Columns', min: 1, max: 100, default: 20 },
  { key: 'rows', label: 'Rows', min: 1, max: 100, default: 15 },
  { key: 'cellSize', label: 'Cell size (px)', min: 10, max: 200, default: 40 },
];

export const TOKEN_FIELDS = [
  { key: 'name', kind: 'text', label: 'Name', maxLength: 40, default: 'Token' },
  {
    key: 'color',
    kind: 'color',
    label: 'Color',
    maxLength: 7,
    default: '#e63946',
  },
  { key: 'col', kind: 'int', label: 'Column', min: 0, max: 99, default: 0 },
  { key: 'row', kind: 'int', label: 'Row', min: 0, max: 99, default: 0 },
  {
    key: 'owner',
    kind: 'text',
    label: 'Owner username',
    maxLength: 40,
    default: null,
  },
  {
    key: 'combatantId',
    kind: 'text',
    label: 'Linked combatant id',
    maxLength: 40,
    default: null,
  },
  {
    key: 'combatantType',
    kind: 'text',
    label: 'Linked combatant type',
    maxLength: 20,
    default: null,
  },
];

export function computeCondition(hp) {
  if (!hp || hp.max <= 0) return 'healthy';
  if (hp.current <= 0) return 'dead';
  if (hp.current / hp.max <= 0.25) return 'critical';
  if (hp.current / hp.max <= 0.5) return 'hurt';
  return 'healthy';
}

export const STATUS_EFFECTS = {
  blinded: {
    icon: 'visibility_off',
    background: '#1c1c1c',
    color: '#f5f5f5',
  },

  charmed: {
    icon: 'favorite',
    background: '#8e2a72',
    color: '#ffd6f3',
  },

  deafened: {
    icon: 'hearing_disabled',
    background: '#4a3270',
    color: '#e6d8ff',
  },

  frightened: {
    icon: 'sentiment_very_dissatisfied',
    background: '#6b4f1d',
    color: '#ffe082',
  },

  grappled: {
    icon: 'front_hand',
    background: '#8a4b16',
    color: '#ffe0b2',
  },

  incapacitated: {
    icon: 'block',
    background: '#424242',
    color: '#eeeeee',
  },

  invisible: {
    icon: 'visibility',
    background: '#176b87',
    color: '#b8f0ff',
  },

  paralyzed: {
    icon: 'accessibility_new',
    background: '#b8860b',
    color: '#fff8d6',
  },

  petrified: {
    icon: 'landscape',
    background: '#696969',
    color: '#f1f1f1',
  },

  poisoned: {
    icon: 'science',
    background: '#397a24',
    color: '#dfffcc',
  },

  prone: {
    icon: 'airline_seat_flat',
    background: '#5a4632',
    color: '#ffe0b2',
  },

  restrained: {
    icon: 'link',
    background: '#8b2f2f',
    color: '#ffd0d0',
  },

  stunned: {
    icon: 'bolt',
    background: '#b05a00',
    color: '#fff0c2',
  },

  unconscious: {
    icon: 'bed',
    background: '#263238',
    color: '#d1b3e8',
  },
};

export const OVERLAY_TYPES = {
  fire: { label: 'Fire', color: '#e0703f' },
  water: { label: 'Water', color: '#3f7fe0' },
  electric: { label: 'Electricity', color: '#e0d63f' },
  poison: { label: 'Poison', color: '#5c7a4f' },
  generic: { label: 'Generic', color: '#9c9c9c' },
};

export const OVERLAY_SHAPES = ['circle', 'square'];

export const OVERLAY_FIELDS = [
  { key: 'col', kind: 'int', label: 'Column', min: 0, max: 99, default: 0 },
  { key: 'row', kind: 'int', label: 'Row', min: 0, max: 99, default: 0 },
  { key: 'radius', kind: 'int', label: 'Radius (cells)', min: 1, max: 30, default: 2 },
  { key: 'label', kind: 'text', label: 'Label', maxLength: 40, default: '' },
];

export class Validators {
  static clampInt(val, min, max, fallback) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
}

export class HitPoints {
  constructor(current, max) {
    this.current = current;
    this.max = max;
  }

  /** A brand-new `{ current, max }` at schema defaults. */
  static default() {
    const defaults = {};
    for (const field of HP_FIELDS) defaults[field.key] = field.default;
    return new HitPoints(defaults.current, defaults.max);
  }

  static clone(existing) {
    return new HitPoints(existing.current, existing.max);
  }

  static fromInput(input, existing) {
    const hp = existing ? HitPoints.clone(existing) : HitPoints.default();
    for (const field of HP_FIELDS) {
      if (input[field.key] !== undefined) {
        hp[field.key] = Validators.clampInt(input[field.key], field.min, field.max, hp[field.key]);
      }
    }
    return hp;
  }

  toJSON() {
    return { current: this.current, max: this.max };
  }
}

export class Character {
  constructor() {
    this.id = null;
    this.hp = HitPoints.default();
    this.abilityScores = {};
    this.statusEffects = [];
    for (const key of ABILITY_KEYS) this.abilityScores[key] = 10;
    for (const field of CHARACTER_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Character();
  }

  static clone(existing) {
    const c = Object.assign(new Character(), existing);
    c.hp = HitPoints.clone(existing.hp);
    c.abilityScores = { ...existing.abilityScores };
    c.statusEffects = [...(existing.statusEffects || [])];
    return c;
  }

  static fromInput(input, existing) {
    const c = existing ? Character.clone(existing) : new Character();

    for (const field of CHARACTER_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === 'int') {
        c[field.key] = Validators.clampInt(input[field.key], field.min, field.max, c[field.key]);
      } else {
        const str = String(input[field.key]).trim().slice(0, field.maxLength);
        c[field.key] = str || (field.emptyFallback !== undefined ? field.emptyFallback : str);
      }
    }

    if (input.hp) c.hp = HitPoints.fromInput(input.hp, c.hp);

    if (input.abilityScores) {
      for (const key of ABILITY_KEYS) {
        if (input.abilityScores[key] !== undefined) {
          c.abilityScores[key] = Validators.clampInt(input.abilityScores[key], 1, 30, c.abilityScores[key]);
        }
      }
    }

    if (input.statusEffects !== undefined) {
      const list = Array.isArray(input.statusEffects) ? input.statusEffects : [];
      c.statusEffects = list.filter((tag) => STATUS_EFFECTS[tag]).slice(0, Object.keys(STATUS_EFFECTS).length);
    }

    return c;
  }

  condition() {
    return computeCondition(this.hp);
  }

  toJSON() {
    const out = {
      id: this.id,
      hp: this.hp.toJSON(),
      abilityScores: { ...this.abilityScores },
      statusEffects: [...this.statusEffects],
    };
    for (const field of CHARACTER_FIELDS) out[field.key] = this[field.key];
    return out;
  }
}

export class MonsterInstance {
  constructor() {
    // Identity / runtime state
    this.id = null;
    this.templateId = null;
    this.hp = HitPoints.default();
    this.statusEffects = [];

    // Monster definition
    this.name = 'Monster';
    this.description = '';
    this.size = '';
    this.type = '';
    this.alignment = '';
    this.cr = null;
    this.ac = null;
    this.hpMax = 10;
    this.hitDice = null;
    this.speed = '';
    this.xp = null;
    this.proficiencyBonus = null;
    this.passivePerception = null;
    this.senses = null;
    this.skills = null;
    this.savingThrows = null;
    this.languages = null;
    this.conditionImmunities = null;
    this.damageImmunities = null;
    this.damageResistances = null;
    this.damageVulnerabilities = null;
    this.abilityScores = null;
    this.abilityModifiers = null;
    this.traits = [];
    this.actions = [];
    this.attacks = [];
    this.bonusActions = [];
    this.reactions = [];
    this.legendaryActions = [];
    this.spellcasting = null;
    this.tokenImageUrl = null;
    this.source = '';
  }

  static default() {
    return new MonsterInstance();
  }

  static clone(existing) {
    const m = Object.assign(new MonsterInstance(), existing);

    m.hp = HitPoints.clone(existing.hp);
    m.statusEffects = [...(existing.statusEffects || [])];

    m.abilityScores = existing.abilityScores ? { ...existing.abilityScores } : null;

    m.abilityModifiers = existing.abilityModifiers ? { ...existing.abilityModifiers } : null;

    m.traits = (existing.traits || []).map((trait) => ({ ...trait }));
    m.actions = (existing.actions || []).map((action) => ({ ...action }));
    m.attacks = (existing.attacks || []).map((attack) => ({ ...attack }));
    m.bonusActions = (existing.bonusActions || []).map((action) => ({ ...action }));
    m.reactions = (existing.reactions || []).map((action) => ({ ...action }));
    m.legendaryActions = (existing.legendaryActions || []).map((action) => ({ ...action }));

    if (existing.spellcasting) {
      m.spellcasting = {
        ...existing.spellcasting,
        innate: existing.spellcasting.innate ? { ...existing.spellcasting.innate } : null,
        spellsByLevel: existing.spellcasting.spellsByLevel ? { ...existing.spellcasting.spellsByLevel } : null,
        spellList: existing.spellcasting.spellList ? [...existing.spellcasting.spellList] : null,
      };
    }

    return m;
  }

  static fromTemplate(template) {
    const m = new MonsterInstance();

    m.templateId = template.id;
    m.name = template.name;
    m.description = template.description;
    m.size = template.size;
    m.type = template.type;
    m.alignment = template.alignment;
    m.cr = template.cr;
    m.ac = template.ac;
    m.hpMax = template.hpMax;
    m.hitDice = template.hitDice;
    m.speed = template.speed;
    m.xp = template.xp;
    m.proficiencyBonus = template.proficiencyBonus;
    m.passivePerception = template.passivePerception;
    m.senses = template.senses;
    m.skills = template.skills;
    m.savingThrows = template.savingThrows;
    m.languages = template.languages;
    m.conditionImmunities = template.conditionImmunities;
    m.damageImmunities = template.damageImmunities;
    m.damageResistances = template.damageResistances;
    m.damageVulnerabilities = template.damageVulnerabilities;

    m.abilityScores = template.abilityScores ? { ...template.abilityScores } : null;

    m.abilityModifiers = template.abilityModifiers ? { ...template.abilityModifiers } : null;

    m.traits = (template.traits || []).map((trait) => ({ ...trait }));
    m.actions = (template.actions || []).map((action) => ({ ...action }));
    m.attacks = (template.attacks || []).map((attack) => ({ ...attack }));
    m.bonusActions = (template.bonusActions || []).map((action) => ({ ...action }));
    m.reactions = (template.reactions || []).map((action) => ({ ...action }));
    m.legendaryActions = (template.legendaryActions || []).map((action) => ({ ...action }));

    m.spellcasting = template.spellcasting
      ? {
          ...template.spellcasting,
          innate: template.spellcasting.innate ? { ...template.spellcasting.innate } : null,
          spellsByLevel: template.spellcasting.spellsByLevel ? { ...template.spellcasting.spellsByLevel } : null,
          spellList: template.spellcasting.spellList ? [...template.spellcasting.spellList] : null,
        }
      : null;

    m.tokenImageUrl = template.tokenImageUrl;
    m.source = template.source;

    const hpMax = Validators.clampInt(template.hpMax, 0, 9999, 10);

    m.hpMax = hpMax;
    m.hp = new HitPoints(hpMax, hpMax);

    return m;
  }

  static fromInput(input, existing) {
    const m = MonsterInstance.clone(existing);

    if (input.hp) {
      m.hp = HitPoints.fromInput(input.hp, m.hp);
    }

    if (input.statusEffects !== undefined) {
      const list = Array.isArray(input.statusEffects) ? input.statusEffects : [];

      m.statusEffects = list.filter((tag) => STATUS_EFFECTS[tag]).slice(0, Object.keys(STATUS_EFFECTS).length);
    }

    return m;
  }

  condition() {
    return computeCondition(this.hp);
  }

  toJSON() {
    return {
      id: this.id,
      templateId: this.templateId,

      name: this.name,
      description: this.description,
      size: this.size,
      type: this.type,
      alignment: this.alignment,
      cr: this.cr,
      ac: this.ac,
      hpMax: this.hpMax,
      hitDice: this.hitDice,
      speed: this.speed,
      xp: this.xp,
      proficiencyBonus: this.proficiencyBonus,
      passivePerception: this.passivePerception,
      senses: this.senses,
      skills: this.skills,
      savingThrows: this.savingThrows,
      languages: this.languages,
      conditionImmunities: this.conditionImmunities,
      damageImmunities: this.damageImmunities,
      damageResistances: this.damageResistances,
      damageVulnerabilities: this.damageVulnerabilities,
      abilityScores: this.abilityScores ? { ...this.abilityScores } : null,
      abilityModifiers: this.abilityModifiers ? { ...this.abilityModifiers } : null,
      traits: this.traits.map((trait) => ({ ...trait })),
      actions: this.actions.map((action) => ({ ...action })),
      attacks: this.attacks.map((attack) => ({ ...attack })),
      bonusActions: this.bonusActions.map((action) => ({ ...action })),
      reactions: this.reactions.map((action) => ({ ...action })),
      legendaryActions: this.legendaryActions.map((action) => ({ ...action })),
      spellcasting: this.spellcasting
        ? {
            ...this.spellcasting,
            innate: this.spellcasting.innate ? { ...this.spellcasting.innate } : null,
            spellsByLevel: this.spellcasting.spellsByLevel ? { ...this.spellcasting.spellsByLevel } : null,
            spellList: this.spellcasting.spellList ? [...this.spellcasting.spellList] : null,
          }
        : null,
      tokenImageUrl: this.tokenImageUrl,
      source: this.source,

      hp: this.hp.toJSON(),
      statusEffects: [...this.statusEffects],
    };
  }
}

export class Encounter {
  constructor() {
    this.id = null;
    this.name = 'New Encounter';
    this.snapshot = null;
  }

  static default() {
    return new Encounter();
  }

  static clone(existing) {
    const e = Object.assign(new Encounter(), existing);
    e.snapshot = existing.snapshot;
    return e;
  }

  static fromInput(input, existing) {
    const e = existing ? Encounter.clone(existing) : new Encounter();
    if (input.name !== undefined) {
      const str = String(input.name).trim().slice(0, 60);
      e.name = str || 'Unnamed Encounter';
    }
    if (input.snapshot !== undefined) {
      e.snapshot = input.snapshot;
    }
    return e;
  }

  toJSON() {
    return { id: this.id, name: this.name, snapshot: this.snapshot };
  }
}

export class Grid {
  constructor() {
    this.visible = true;
    for (const field of GRID_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Grid();
  }

  static fromInput(input, existing) {
    const g = Object.assign(new Grid(), existing);
    for (const field of GRID_FIELDS) {
      if (input[field.key] !== undefined) {
        g[field.key] = Validators.clampInt(input[field.key], field.min, field.max, g[field.key]);
      }
    }
    if (input.visible !== undefined) g.visible = !!input.visible;
    return g;
  }

  toJSON() {
    const out = { visible: this.visible };
    for (const field of GRID_FIELDS) out[field.key] = this[field.key];
    return out;
  }
}

export class Token {
  constructor() {
    this.id = null;
    for (const field of TOKEN_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Token();
  }

  static clone(existing) {
    return Object.assign(new Token(), existing);
  }

  static fromInput(input, grid, existing) {
    const t = existing ? Token.clone(existing) : new Token();

    for (const field of TOKEN_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === 'int') {
        t[field.key] = Validators.clampInt(input[field.key], field.min, field.max, t[field.key]);
      } else if (field.kind === 'color') {
        t[field.key] = input[field.key] || field.default;
      } else {
        t[field.key] = String(input[field.key]).trim().slice(0, field.maxLength) || field.default;
      }
    }

    if (grid) {
      t.col = Validators.clampInt(t.col, 0, Math.max(0, grid.cols - 1), t.col);
      t.row = Validators.clampInt(t.row, 0, Math.max(0, grid.rows - 1), t.row);
    }

    return t;
  }

  toJSON() {
    const out = { id: this.id };
    for (const field of TOKEN_FIELDS) out[field.key] = this[field.key];
    return out;
  }
}

export class Overlay {
  constructor() {
    this.id = null;
    this.type = 'generic';
    this.shape = 'circle';
    for (const field of OVERLAY_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Overlay();
  }

  static fromInput(input, grid) {
    const o = new Overlay();
    if (OVERLAY_TYPES[input.type]) o.type = input.type;
    if (OVERLAY_SHAPES.includes(input.shape)) o.shape = input.shape;

    for (const field of OVERLAY_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === 'int') {
        o[field.key] = Validators.clampInt(input[field.key], field.min, field.max, o[field.key]);
      } else {
        o[field.key] = String(input[field.key]).trim().slice(0, field.maxLength);
      }
    }

    if (grid) {
      o.col = Validators.clampInt(o.col, 0, Math.max(0, grid.cols - 1), o.col);
      o.row = Validators.clampInt(o.row, 0, Math.max(0, grid.rows - 1), o.row);
    }

    return o;
  }

  toJSON() {
    const out = { id: this.id, type: this.type, shape: this.shape };
    for (const field of OVERLAY_FIELDS) out[field.key] = this[field.key];
    return out;
  }
}

export class TurnOrder {
  constructor() {
    this.combatants = [];
    this.currentIndex = -1;
    this.round = 0;
  }

  static default() {
    return new TurnOrder();
  }

  static fromEntries(entries, tokens) {
    const list = Array.isArray(entries) ? entries : [];
    const combatants = list
      .filter((e) => e && tokens[e.tokenId])
      .map((e) => ({ tokenId: e.tokenId, initiative: Validators.clampInt(e.initiative, -99, 99, 0) }))
      .map((e, i) => ({ ...e, _i: i }))
      .sort((a, b) => b.initiative - a.initiative || a._i - b._i)
      .map(({ tokenId, initiative }) => ({ tokenId, initiative }));

    const order = new TurnOrder();
    order.combatants = combatants;
    order.currentIndex = combatants.length ? 0 : -1;
    order.round = combatants.length ? 1 : 0;
    return order;
  }

  advance() {
    if (this.combatants.length === 0) return;
    this.currentIndex += 1;
    if (this.currentIndex >= this.combatants.length) {
      this.currentIndex = 0;
      this.round += 1;
    }
  }

  removeCombatant(tokenId) {
    const idx = this.combatants.findIndex((c) => c.tokenId === tokenId);
    if (idx === -1) return;
    this.combatants.splice(idx, 1);
    if (this.combatants.length === 0) {
      this.currentIndex = -1;
      this.round = 0;
    } else if (this.currentIndex >= this.combatants.length) {
      this.currentIndex = 0;
    }
  }

  currentCombatantTokenId() {
    if (this.currentIndex < 0) return null;
    return this.combatants[this.currentIndex]?.tokenId ?? null;
  }

  toJSON() {
    return {
      combatants: this.combatants.map((c) => ({ ...c })),
      currentIndex: this.currentIndex,
      round: this.round,
    };
  }
}
