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
    label: "Color",
    maxLength: 7,
    default: "#e63946",
  },
];

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

  if (input.hp) {
    for (const field of HP_FIELDS) {
      if (input.hp[field.key] !== undefined) {
        c.hp[field.key] = clampInt(input.hp[field.key], field.min, field.max, c.hp[field.key]);
      }
    }
  }

  if (input.abilityScores) {
    for (const key of ABILITY_KEYS) {
      if (input.abilityScores[key] !== undefined) {
        c.abilityScores[key] = clampInt(input.abilityScores[key], 1, 30, c.abilityScores[key]);
      }
    }
  }

  return c;
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
 * known).
 */
export function defaultToken() {
  return { name: "Token", color: "#e63946", col: 0, row: 0, owner: null };
}

/**
 * Validate a new Token payload. `grid` is the current board grid, used to
 * clamp `col`/`row` into bounds. `id` is assigned by the caller (server owns
 * token id generation since it must be unique across the whole board).
 */
export function sanitizeToken(input, grid) {
  const t = defaultToken();
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
  return t;
}
