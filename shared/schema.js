// shared/schema.js
//
// Single source of truth for the shape, defaults, and validation of the app's
// core domain objects: Character, Grid, and Token.
//
// This file is loaded by BOTH sides of the app, as the exact same file on disk:
//   - the server loads it with a plain `import` (Node ESM, via `require`-free
//     `import ... from './shared/schema.js'` in server-side files)
//   - the browser loads it with `import ... from '/shared/schema.js'` inside a
//     `<script type="module">` — the server exposes the `shared/` folder as a
//     static route so the browser can fetch it directly (see server.js).
//
// Because it's the same file both places, adding a new character stat (for
// example) means adding one entry to CHARACTER_FIELDS here — the form, the
// validation/defaults, and the sheet rendering can all read from this list
// instead of each hard-coding their own copy of "what fields exist".
//
// Browser note: this file intentionally avoids any Node-only APIs (no
// `require`, no `fs`, no `path`) so it works unmodified in both environments.

/** Ability score keys, in the conventional D&D order. */
export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Declarative list of the simple (non-nested) Character fields.
 * `kind` drives both validation (server) and form-input type (client, stage 3).
 *   - 'text'   -> validated as a trimmed string, capped at maxLength
 *   - 'int'    -> validated as an integer, clamped to [min, max]
 *   - 'color'  -> validated as a string, capped at maxLength (e.g. "#rrggbb" =
 * 7 chars)
 */
export const CHARACTER_FIELDS = [
  {
    key: "name",
    kind: "text",
    label: "Name",
    maxLength: 60,
    default: "New Character",
    emptyFallback: "Unnamed",
  },
  { key: "class", kind: "text", label: "Class", maxLength: 40, default: "" },
  { key: "race", kind: "text", label: "Race", maxLength: 40, default: "" },
  { key: "level", kind: "int", label: "Level", min: 1, max: 20, default: 1 },
  { key: "ac", kind: "int", label: "Armor Class", min: 0, max: 40, default: 10 },
  { key: "notes", kind: "text", label: "Notes", maxLength: 2000, default: "" },
  {
    key: "tokenColor",
    kind: "color",
    label: "Token Color",
    maxLength: 7,
    default: "#e63946",
  },
];

// `statusEffects` is deliberately NOT in CHARACTER_FIELDS above: it's a list
// validated against the STATUS_EFFECTS vocabulary (see Character.fromInput),
// not a simple scalar text/int/color field, and CHARACTER_FIELDS' `default`
// values are shared object literals — an `[]` default there would alias the
// same array across every Character instance instead of each getting its
// own. Handled explicitly in the constructor/clone/fromInput instead, the
// same way `hp` and `abilityScores` already are.

/** Fields inside `character.hp`, each an int clamped to [min, max]. */
export const HP_FIELDS = [
  { key: "current", label: "HP (current)", min: -9999, max: 9999, default: 10 },
  { key: "max", label: "HP (max)", min: 0, max: 9999, default: 10 },
];

/** Fields inside `grid`. */
export const GRID_FIELDS = [
  { key: "cols", label: "Columns", min: 1, max: 100, default: 20 },
  { key: "rows", label: "Rows", min: 1, max: 100, default: 15 },
  { key: "cellSize", label: "Cell size (px)", min: 10, max: 200, default: 40 },
];

/** Fields inside `token`. */
export const TOKEN_FIELDS = [
  { key: "name", kind: "text", label: "Name", maxLength: 40, default: "Token" },
  {
    key: "color",
    kind: "color",
    label: "Color",
    maxLength: 7,
    default: "#e63946",
  },
  { key: "col", kind: "int", label: "Column", min: 0, max: 99, default: 0 },
  { key: "row", kind: "int", label: "Row", min: 0, max: 99, default: 0 },
  {
    key: "owner",
    kind: "text",
    label: "Owner username",
    maxLength: 40,
    default: null,
  },
  {
    // References the id of the Character (and, from Phase 2 on, a monster
    // instance) this token is a read-only projection of. HP and status
    // effects are never stored here — see `computeCondition`/`GameStateStore`
    // for how the board derives bloodied/status display from the source
    // record instead. null for a bare DM-controlled token with no linked
    // combatant record.
    key: "combatantId",
    kind: "text",
    label: "Linked combatant id",
    maxLength: 40,
    default: null,
  },
  {
    // Which store `combatantId` should be looked up in: 'character' (a
    // player's saved Character, via server/db.js) or 'monster' (a
    // MonsterInstance placed from the Phase 2 monster library, via
    // GameStateStore#monsterInstances). null alongside a null combatantId.
    key: "combatantType",
    kind: "text",
    label: "Linked combatant type",
    maxLength: 20,
    default: null,
  },
];

/**
 * Given an HP-like `{ current, max }`, the qualitative condition safe to
 * broadcast to players who don't own this combatant: no numbers, just
 * 'healthy' | 'bloodied' | 'critical'. Single choke point for this
 * computation — see the redacted-broadcast note in ARCHITECTURE.md.
 */
export function computeCondition(hp) {
  if (!hp || hp.max <= 0) return "healthy";
  if (hp.current <= 0) return "critical";
  if (hp.current / hp.max <= 0.5) return "bloodied";
  return "healthy";
}

/**
 * The fixed vocabulary of status-effect tags the DM can toggle on a token
 * (standard 5e condition names). Kept as a flat list rather than free text so
 * the DM panel can render it as checkboxes and the board can render short
 * badges without guessing at arbitrary strings.
 */
export const STATUS_EFFECTS = {
  blinded: {
    icon: "visibility_off",
    background: "#1c1c1c",
    color: "#f5f5f5",
  },

  charmed: {
    icon: "favorite",
    background: "#8e2a72",
    color: "#ffd6f3",
  },

  deafened: {
    icon: "hearing_disabled",
    background: "#4a3270",
    color: "#e6d8ff",
  },

  frightened: {
    icon: "sentiment_very_dissatisfied",
    background: "#6b4f1d",
    color: "#ffe082",
  },

  grappled: {
    icon: "front_hand",
    background: "#8a4b16",
    color: "#ffe0b2",
  },

  incapacitated: {
    icon: "block",
    background: "#424242",
    color: "#eeeeee",
  },

  invisible: {
    icon: "visibility",
    background: "#176b87",
    color: "#b8f0ff",
  },

  paralyzed: {
    icon: "accessibility_new",
    background: "#b8860b",
    color: "#fff8d6",
  },

  petrified: {
    icon: "landscape",
    background: "#696969",
    color: "#f1f1f1",
  },

  poisoned: {
    icon: "science",
    background: "#397a24",
    color: "#dfffcc",
  },

  prone: {
    icon: "airline_seat_flat",
    background: "#5a4632",
    color: "#ffe0b2",
  },

  restrained: {
    icon: "link",
    background: "#8b2f2f",
    color: "#ffd0d0",
  },

  stunned: {
    icon: "bolt",
    background: "#b05a00",
    color: "#fff0c2",
  },

  unconscious: {
    icon: "bed",
    background: "#263238",
    color: "#d1b3e8",
  },
};

/**
 * Area-of-effect overlay types. `effectTag` is the status-effect-like tag
 * automatically applied (as `token.overlayEffects`, kept separate from the
 * the DM's manually-set `character.statusEffects`) to any token whose cell falls
 * inside an overlay of this type — see server/gameState.js's
 * `recomputeOverlayEffects`. `generic` has no automatic effect, useful for
 * marking an area (e.g. difficult terrain) without implying a condition.
 */
export const OVERLAY_TYPES = {
  fire: { label: "Fire", color: "#e0703f", effectTag: "burning" },
  water: { label: "Water", color: "#3f7fe0", effectTag: "soaked" },
  electric: { label: "Electricity", color: "#e0d63f", effectTag: "shocked" },
  poison: { label: "Poison", color: "#5c7a4f", effectTag: "poisoned" },
  generic: { label: "Generic", color: "#9c9c9c", effectTag: null },
};

/** Shapes supported for an overlay, centered on `col`/`row`. */
export const OVERLAY_SHAPES = ["circle", "square"];

/** Fields inside `overlay`. */
export const OVERLAY_FIELDS = [
  { key: "col", kind: "int", label: "Column", min: 0, max: 99, default: 0 },
  { key: "row", kind: "int", label: "Row", min: 0, max: 99, default: 0 },
  { key: "radius", kind: "int", label: "Radius (cells)", min: 1, max: 30, default: 2 },
  { key: "label", kind: "text", label: "Label", maxLength: 40, default: "" },
];

/**
 * Clamp `val` to an integer in [min, max], falling back to `fallback` if not a
 * number. Grouped as a `static` method on a class purely so this module
 * reads consistently with the rest of shared/schema.js (all classes now) —
 * there's no instance state to justify here, this is a pure function.
 */
export class Validators {
  static clampInt(val, min, max, fallback) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
}

/** Hit points, as a small value object shared by both Character and Token. */
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

  /**
   * Validates a partial `{ current, max }` payload against `existing` (or
   * schema defaults), clamping each provided field per HP_FIELDS. Shared by
   * `Character.fromInput` and `Token.fromInput` so both domain objects' HP
   * behaves identically.
   */
  static fromInput(input, existing) {
    const hp = existing ? HitPoints.clone(existing) : HitPoints.default();
    for (const field of HP_FIELDS) {
      if (input[field.key] !== undefined) {
        hp[field.key] = Validators.clampInt(input[field.key], field.min, field.max, hp[field.key]);
      }
    }
    return hp;
  }

  /** True if at or below half max HP (the standard "bloodied" threshold). */
  isBloodied() {
    return this.max > 0 && this.current / this.max <= 0.5;
  }

  toJSON() {
    return { current: this.current, max: this.max };
  }
}

/** A player character: stats, HP, ability scores. */
export class Character {
  constructor() {
    this.id = null;
    this.hp = HitPoints.default();
    this.abilityScores = {};
    // Combat-time status tags, DM-edited (see the DM sidebar quick-edit
    // controls) — this, plus `hp`, is the single source of truth for a
    // combatant's state; tokens and the initiative tracker only ever read it.
    this.statusEffects = [];
    for (const key of ABILITY_KEYS) this.abilityScores[key] = 10;
    for (const field of CHARACTER_FIELDS) this[field.key] = field.default;
  }

  /** A brand-new Character with every field at its schema default. */
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

  /**
   * Merge + validate a partial Character payload (e.g. from a POST/PUT body)
   * against `existing` (or schema defaults, if this is a new character).
   * Every field is independently optional in `input`, so a partial-update PUT
   * only touches the fields it sends.
   */
  static fromInput(input, existing) {
    const c = existing ? Character.clone(existing) : new Character();

    for (const field of CHARACTER_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === "int") {
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

  /** True if at or below half max HP. */
  isBloodied() {
    return this.hp.isBloodied();
  }

  /** The qualitative, no-numbers condition safe to broadcast to non-owners. */
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

/**
 * A monster placed on the board from the Phase 2 `dnd-data` library — the
 * "Combatant" concept the design doc calls for, minimal enough to serve just
 * what combat needs. Deliberately NOT a rework of Character: it's a small,
 * separate class that happens to share the same `hp`/`statusEffects`/
 * `condition()` shape (and the same `computeCondition` function) so the DM
 * sidebar's quick-edit controls, the redacted broadcast, token rendering,
 * and initiative lookups can treat a MonsterInstance and a Character
 * identically wherever only combat state matters (see GameStateStore's
 * combatant lookup and public/js/views/combatantEditor.js).
 *
 * `templateId`/`name`/`ac`/`speed`/`cr`/`type`/`size`/`attacks`/`source` are
 * a read-only snapshot taken from the `dnd-data` entry at placement time
 * (see server/monsterLibrary.js) — this app has no homebrew monster editor,
 * so those fields are never re-validated from client input the way
 * Character's are. Only `hp` and `statusEffects` are ever edited after
 * placement.
 */
export class MonsterInstance {
  constructor() {
    this.id = null;
    this.templateId = null;
    this.name = "Monster";
    this.ac = null;
    this.hp = HitPoints.default();
    this.statusEffects = [];
    this.speed = "";
    this.cr = null;
    this.type = "";
    this.size = "";
    this.attacks = []; // [{ name, toHit, damage, damageType, desc }]
    this.source = "";
  }

  /**
   * Builds a brand-new instance from a monster template (see
   * server/monsterLibrary.js's `MonsterTemplate` shape) — every instance
   * starts at the template's full HP. `id` is assigned by the caller
   * (GameStateStore), same as Token/Overlay ids.
   */
  static fromTemplate(template) {
    const m = new MonsterInstance();
    m.templateId = template.id;
    m.name = template.name;
    m.ac = template.ac;
    m.hp = new HitPoints(template.hpMax ?? 10, template.hpMax ?? 10);
    m.speed = template.speed || "";
    m.cr = template.cr ?? null;
    m.type = template.type || "";
    m.size = template.size || "";
    m.attacks = template.attacks || [];
    m.source = template.source || "";
    return m;
  }

  static clone(existing) {
    const m = Object.assign(new MonsterInstance(), existing);
    m.hp = HitPoints.clone(existing.hp);
    m.statusEffects = [...(existing.statusEffects || [])];
    m.attacks = existing.attacks.map((a) => ({ ...a }));
    return m;
  }

  /**
   * Partial update — only `hp` and `statusEffects` are ever accepted here
   * (the DM sidebar quick-edit's only two controls for a monster instance);
   * everything else is the immutable template snapshot from placement time.
   */
  static fromInput(input, existing) {
    const m = MonsterInstance.clone(existing);
    if (input.hp) m.hp = HitPoints.fromInput(input.hp, m.hp);
    if (input.statusEffects !== undefined) {
      const list = Array.isArray(input.statusEffects) ? input.statusEffects : [];
      m.statusEffects = list.filter((tag) => STATUS_EFFECTS[tag]).slice(0, Object.keys(STATUS_EFFECTS).length);
    }
    return m;
  }

  /** The qualitative, no-numbers condition safe to broadcast to non-owners — identical to Character's. */
  condition() {
    return computeCondition(this.hp);
  }

  toJSON() {
    return {
      id: this.id,
      templateId: this.templateId,
      name: this.name,
      ac: this.ac,
      hp: this.hp.toJSON(),
      statusEffects: [...this.statusEffects],
      speed: this.speed,
      cr: this.cr,
      type: this.type,
      size: this.size,
      attacks: this.attacks.map((a) => ({ ...a })),
      source: this.source,
    };
  }
}

/**
 * A named, saved pre-session encounter: a full snapshot of the board —
 * background, grid, tokens (with position), overlays, turn order, and
 * monster instances — captured verbatim from `GameStateStore#toSnapshotJSON`
 * at save time. Loading an encounter restores that entire snapshot (see
 * `GameStateStore#restoreSnapshot`), replacing whatever's currently on the
 * board, rather than spawning tokens alongside the existing state.
 *
 * `snapshot` is opaque to this class — it's always server-constructed (from
 * live `GameStateStore` state), never typed by hand on the client, so it's
 * stored as-is rather than field-validated the way `Character`'s input is.
 * Only `name` is genuinely user input here.
 */
export class Encounter {
  constructor() {
    this.id = null;
    this.name = "New Encounter";
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

  /**
   * Merge + validate a partial Encounter payload. `name` is sanitized like
   * any other text field; `snapshot` (if provided) fully replaces the
   * existing one — there's no partial snapshot update.
   */
  static fromInput(input, existing) {
    const e = existing ? Encounter.clone(existing) : new Encounter();
    if (input.name !== undefined) {
      const str = String(input.name).trim().slice(0, 60);
      e.name = str || "Unnamed Encounter";
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

/** The board's grid configuration. */
export class Grid {
  constructor() {
    this.visible = true;
    for (const field of GRID_FIELDS) this[field.key] = field.default;
  }

  /** Board grid defaults. */
  static default() {
    return new Grid();
  }

  /** Validate a partial Grid payload against the existing grid. */
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

/**
 * A token on the board: a read-only projection of its position plus a
 * reference (`combatantId`) to the Character (or, from Phase 2, monster
 * instance) it displays. It never stores its own HP/status — those are
 * looked up from the source record (see `computeCondition` and
 * GameStateStore#getState's `combatantStatuses`). `overlayEffects` is the one
 * exception: it's environmental (AoE overlay membership), computed by
 * `recomputeOverlayEffects` (see GameStateStore) and never set from client
 * input.
 */
export class Token {
  constructor() {
    this.id = null;
    // overlayEffects is the only auto-computed, token-specific "effect" list
    // left on Token — it's environmental (which AoE overlay cells this token
    // currently sits in), not combat state. HP and status effects live only
    // on the linked Character (or, from Phase 2, monster instance) referenced
    // by `combatantId` — see computeCondition() and GameStateStore's
    // combatantStatuses. A token with no combatantId (a bare DM marker) has
    // no HP/status concept at all in v1.
    this.overlayEffects = [];
    for (const field of TOKEN_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Token();
  }

  static clone(existing) {
    const t = Object.assign(new Token(), existing);
    t.overlayEffects = [...existing.overlayEffects];
    return t;
  }

  /**
   * Validate a Token payload. `grid` is the current board grid, used to clamp
   * `col`/`row` into bounds. `existing` is the current token when this is a
   * partial update (e.g. the DM renaming/recoloring it) — every field is
   * independently optional in `input`, mirroring `Character.fromInput`. `id`
   * and `overlayEffects` are assigned/computed by the caller (GameStateStore),
   * never from `input`.
   */
  static fromInput(input, grid, existing) {
    const t = existing ? Token.clone(existing) : new Token();

    for (const field of TOKEN_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === "int") {
        t[field.key] = Validators.clampInt(input[field.key], field.min, field.max, t[field.key]);
      } else if (field.kind === "color") {
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

  /** True if this token's cell falls inside `overlay`'s area. */
  isInsideOverlay(overlay) {
    const dc = this.col - overlay.col;
    const dr = this.row - overlay.row;
    if (overlay.shape === "square") {
      return Math.abs(dc) <= overlay.radius && Math.abs(dr) <= overlay.radius;
    }
    return dc * dc + dr * dr <= overlay.radius * overlay.radius; // circle
  }

  /**
   * Recomputes `overlayEffects` (the automatic, overlay-derived status tags)
   * from the given list of overlays. Kept entirely separate from
   * `statusEffects` (the DM's manual edits) so the two never clobber each
   * other.
   */
  recomputeOverlayEffects(overlays) {
    const tags = new Set();
    for (const overlay of overlays) {
      if (this.isInsideOverlay(overlay)) {
        const effectTag = OVERLAY_TYPES[overlay.type]?.effectTag;
        if (effectTag) tags.add(effectTag);
      }
    }
    this.overlayEffects = Array.from(tags);
  }

  toJSON() {
    const out = {
      id: this.id,
      overlayEffects: [...this.overlayEffects],
    };
    for (const field of TOKEN_FIELDS) out[field.key] = this[field.key];
    return out;
  }
}

/** An area-of-effect overlay (fire, water, electricity, etc.) placed on the grid. */
export class Overlay {
  constructor() {
    this.id = null;
    this.type = "generic";
    this.shape = "circle";
    for (const field of OVERLAY_FIELDS) this[field.key] = field.default;
  }

  static default() {
    return new Overlay();
  }

  /**
   * Validate a new Overlay payload. `grid` clamps `col`/`row` into bounds,
   * same as `Token.fromInput`. Overlays are always created fresh (no
   * partial-update use case in this app), so there's no `existing` parameter.
   */
  static fromInput(input, grid) {
    const o = new Overlay();
    if (OVERLAY_TYPES[input.type]) o.type = input.type;
    if (OVERLAY_SHAPES.includes(input.shape)) o.shape = input.shape;

    for (const field of OVERLAY_FIELDS) {
      if (input[field.key] === undefined) continue;
      if (field.kind === "int") {
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

/** The initiative/turn-order tracker. */
export class TurnOrder {
  constructor() {
    this.combatants = [];
    this.currentIndex = -1;
    this.round = 0;
  }

  /** Turn-order defaults: nobody in the initiative order yet. */
  static default() {
    return new TurnOrder();
  }

  /**
   * Validate a full replacement of the initiative order. `entries` is
   * `[{ tokenId, initiative }, ...]`; only entries referencing a token that
   * still exists on `tokens` are kept, sorted by initiative descending (ties
   * keep their given order, i.e. a stable sort). Resets `currentIndex`/
   * `round` since the order itself just changed.
   */
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

  /** Advances to the next combatant, wrapping around and incrementing `round`. */
  advance() {
    if (this.combatants.length === 0) return;
    this.currentIndex += 1;
    if (this.currentIndex >= this.combatants.length) {
      this.currentIndex = 0;
      this.round += 1;
    }
  }

  /** Removes a combatant (e.g. after its token is deleted), fixing up `currentIndex`/`round`. */
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

  /** The tokenId whose turn it currently is, or null if there's no active encounter. */
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
