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

/** Fields inside `character.hp` / `token.hp`, each an int clamped to [min, max]. */
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
];

/**
 * The fixed vocabulary of status-effect tags the DM can toggle on a token
 * (standard 5e condition names). Kept as a flat list rather than free text so
 * the DM panel can render it as checkboxes and the board can render short
 * badges without guessing at arbitrary strings.
 */
export const STATUS_EFFECTS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
];

/**
 * Area-of-effect overlay types. `effectTag` is the status-effect-like tag
 * automatically applied (as `token.overlayEffects`, kept separate from the
 * DM's manually-set `token.statusEffects`) to any token whose cell falls
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
 * number.
 */
export function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** A brand-new Character with every field at its schema default. */
export function defaultCharacter() {
  const c = { id: null, hp: {}, abilityScores: {} };
  for (const field of CHARACTER_FIELDS) c[field.key] = field.default;
  for (const field of HP_FIELDS) c.hp[field.key] = field.default;
  for (const key of ABILITY_KEYS) c.abilityScores[key] = 10;
  return c;
}

/**
 * Merge + validate a partial Character payload (e.g. from a POST/PUT body)
 * against `existing` (or schema defaults, if this is a new character).
 * Every field is independently optional in `input`, so a partial-update PUT
 * only touches the fields it sends.
 */
export function sanitizeCharacter(input, existing) {
  const c = existing
    ? {
        ...existing,
        hp: { ...existing.hp },
        abilityScores: { ...existing.abilityScores },
      }
    : defaultCharacter();

  for (const field of CHARACTER_FIELDS) {
    if (input[field.key] === undefined) continue;
    if (field.kind === "int") {
      c[field.key] = clampInt(input[field.key], field.min, field.max, c[field.key]);
    } else {
      const str = String(input[field.key]).trim().slice(0, field.maxLength);
      c[field.key] = str || (field.emptyFallback !== undefined ? field.emptyFallback : str);
    }
  }

  if (input.hp) sanitizeHp(input.hp, c.hp);

  if (input.abilityScores) {
    for (const key of ABILITY_KEYS) {
      if (input.abilityScores[key] !== undefined) {
        c.abilityScores[key] = clampInt(input.abilityScores[key], 1, 30, c.abilityScores[key]);
      }
    }
  }

  return c;
}

/**
 * Validates a partial `{ current, max }` HP payload in place against
 * `target` (an existing `hp` object), clamping each provided field per
 * HP_FIELDS. Shared by `sanitizeCharacter` and `sanitizeToken` so both
 * domain objects' HP behaves identically.
 */
function sanitizeHp(input, target) {
  for (const field of HP_FIELDS) {
    if (input[field.key] !== undefined) {
      target[field.key] = clampInt(input[field.key], field.min, field.max, target[field.key]);
    }
  }
  return target;
}

/** A brand-new `{ current, max }` HP object at schema defaults. */
function defaultHp() {
  const hp = {};
  for (const field of HP_FIELDS) hp[field.key] = field.default;
  return hp;
}

/** Board grid defaults. */
export function defaultGrid() {
  const g = { visible: true };
  for (const field of GRID_FIELDS) g[field.key] = field.default;
  return g;
}

/** Validate a partial Grid payload against the existing grid. */
export function sanitizeGrid(input, existing) {
  const g = { ...existing };
  for (const field of GRID_FIELDS) {
    if (input[field.key] !== undefined) {
      g[field.key] = clampInt(input[field.key], field.min, field.max, g[field.key]);
    }
  }
  if (input.visible !== undefined) g.visible = !!input.visible;
  return g;
}

/**
 * A brand-new Token with schema defaults (before placement/ownership are
 * known). `hp`/`statusEffects` default to a healthy, unaffected token;
 * `overlayEffects` is server-computed (see gameState.recomputeOverlayEffects)
 * and never set directly from client input.
 */
export function defaultToken() {
  const t = { hp: defaultHp(), statusEffects: [], overlayEffects: [] };
  for (const field of TOKEN_FIELDS) t[field.key] = field.default;
  return t;
}

/**
 * Validate a Token payload. `grid` is the current board grid, used to clamp
 * `col`/`row` into bounds. `existing` is the current token when this is a
 * partial update (e.g. the DM editing just HP/status effects) — every field
 * is independently optional in `input`, mirroring `sanitizeCharacter`. `id`
 * and `overlayEffects` are assigned/computed by the caller, never from
 * `input`.
 */
export function sanitizeToken(input, grid, existing) {
  const t = existing ? { ...existing, hp: { ...existing.hp } } : defaultToken();

  for (const field of TOKEN_FIELDS) {
    if (input[field.key] === undefined) continue;
    if (field.kind === "int") {
      t[field.key] = clampInt(input[field.key], field.min, field.max, t[field.key]);
    } else if (field.kind === "color") {
      t[field.key] = input[field.key] || field.default;
    } else {
      t[field.key] = String(input[field.key]).trim().slice(0, field.maxLength) || field.default;
    }
  }

  if (grid) {
    t.col = clampInt(t.col, 0, Math.max(0, grid.cols - 1), t.col);
    t.row = clampInt(t.row, 0, Math.max(0, grid.rows - 1), t.row);
  }

  if (input.hp) sanitizeHp(input.hp, t.hp);

  if (input.statusEffects !== undefined) {
    const list = Array.isArray(input.statusEffects) ? input.statusEffects : [];
    t.statusEffects = list.filter((tag) => STATUS_EFFECTS.includes(tag)).slice(0, STATUS_EFFECTS.length);
  }

  return t;
}

/** A brand-new AoE overlay at schema defaults. */
export function defaultOverlay() {
  const o = { type: "generic", shape: "circle" };
  for (const field of OVERLAY_FIELDS) o[field.key] = field.default;
  return o;
}

/**
 * Validate a new Overlay payload. `grid` clamps `col`/`row` into bounds, same
 * as `sanitizeToken`. Overlays are always created fresh (no partial-update
 * use case in this app), so there's no `existing` parameter.
 */
export function sanitizeOverlay(input, grid) {
  const o = defaultOverlay();
  if (OVERLAY_TYPES[input.type]) o.type = input.type;
  if (OVERLAY_SHAPES.includes(input.shape)) o.shape = input.shape;

  for (const field of OVERLAY_FIELDS) {
    if (input[field.key] === undefined) continue;
    if (field.kind === "int") {
      o[field.key] = clampInt(input[field.key], field.min, field.max, o[field.key]);
    } else {
      o[field.key] = String(input[field.key]).trim().slice(0, field.maxLength);
    }
  }

  if (grid) {
    o.col = clampInt(o.col, 0, Math.max(0, grid.cols - 1), o.col);
    o.row = clampInt(o.row, 0, Math.max(0, grid.rows - 1), o.row);
  }

  return o;
}

/** Turn-order tracker defaults: nobody in the initiative order yet. */
export function defaultTurnOrder() {
  return { combatants: [], currentIndex: -1, round: 0 };
}

/**
 * Validate a full replacement of the initiative order. `entries` is
 * `[{ tokenId, initiative }, ...]`; only entries referencing a token that
 * still exists on `tokens` are kept, sorted by initiative descending (ties
 * keep their given order, i.e. a stable sort). Resets `currentIndex`/`round`
 * since the order itself just changed.
 */
export function sanitizeTurnOrder(entries, tokens) {
  const list = Array.isArray(entries) ? entries : [];
  const combatants = list
    .filter((e) => e && tokens[e.tokenId])
    .map((e) => ({ tokenId: e.tokenId, initiative: clampInt(e.initiative, -99, 99, 0) }))
    .map((e, i) => ({ ...e, _i: i }))
    .sort((a, b) => b.initiative - a.initiative || a._i - b._i)
    .map(({ tokenId, initiative }) => ({ tokenId, initiative }));

  return { combatants, currentIndex: combatants.length ? 0 : -1, round: combatants.length ? 1 : 0 };
}
