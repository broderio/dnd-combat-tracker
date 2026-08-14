import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Character, Encounter } from "../shared/schema.js";

// ESM has no built-in `__dirname` — this is the standard way to recover it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

/**
 * Owns all reads/writes of data/db.json: user accounts + characters, and the
 * persisted board snapshot (background/grid/tokens/overlays/turnOrder). Also
 * hands out fresh, unique character ids, since that's the one piece of
 * character creation that's genuinely server-only (the rest of the
 * validation lives in `shared/schema.js`'s `Character` class, the single
 * source of truth shared with the browser).
 *
 * There's exactly one instance of this class for the whole server process
 * (see the `db` singleton exported at the bottom) — every route/handler that
 * needs to read or write data/db.json goes through it instead of opening the
 * file itself.
 */
export class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.nextCharId = Date.now();
    this.nextEncounterId = Date.now();
  }

  loadDB() {
    if (!fs.existsSync(this.dbPath)) return { users: {}, encounters: [] };
    try {
      const raw = fs.readFileSync(this.dbPath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed.users) parsed.users = {};
      if (!parsed.encounters) parsed.encounters = []; // older db.json files predate Phase 3
      return parsed;
    } catch (err) {
      console.error("Failed to read db.json, starting fresh:", err.message);
      return { users: {}, encounters: [] };
    }
  }

  saveDB(db) {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
  }

  /**
   * The persisted board snapshot (background/grid/tokens/overlays/turnOrder +
   * id counters), or `null` if nothing has been saved yet (fresh install).
   * `server/gameState.js`'s `GameStateStore` is the only caller — it owns
   * the in-memory shape and just needs somewhere to load from / save to.
   */
  loadBoardState() {
    const db = this.loadDB();
    return db.board || null;
  }

  saveBoardState(boardSnapshot) {
    const db = this.loadDB();
    db.board = boardSnapshot;
    this.saveDB(db);
  }

  generateCharacterId() {
    return "char_" + this.nextCharId++;
  }

  /**
   * Looks up a single character by owner username + character id. Used by
   * GameStateStore to resolve a token's `combatantId` into its source
   * record when computing the redacted public combatant-status broadcast.
   * Returns null if the user or character doesn't exist.
   */
  findCharacter(username, characterId) {
    if (!username || !characterId) return null;
    const db = this.loadDB();
    const user = db.users[username.toLowerCase()];
    if (!user) return null;
    return user.characters.find((c) => c.id === characterId) || null;
  }

  /**
   * Field-level validation/defaults live in `shared/schema.js`'s `Character`
   * class (single source of truth, also used by the browser client). This
   * method only adds the one thing that's genuinely server-only: assigning a
   * fresh, unique id to brand-new characters.
   */
  sanitizeCharacter(input, existing) {
    const c = Character.fromInput(input, existing);
    if (!existing) c.id = this.generateCharacterId();
    return c;
  }

  // ---------------- Encounters (Phase 3) ----------------

  generateEncounterId() {
    return "enc_" + this.nextEncounterId++;
  }

  getEncounters() {
    return this.loadDB().encounters;
  }

  getEncounter(id) {
    return this.loadDB().encounters.find((e) => e.id === id) || null;
  }

  createEncounter(input) {
    const db = this.loadDB();
    const encounter = Encounter.fromInput(input, null);
    encounter.id = this.generateEncounterId();
    db.encounters.push(encounter.toJSON());
    this.saveDB(db);
    return encounter;
  }

  updateEncounter(id, input) {
    const db = this.loadDB();
    const idx = db.encounters.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated = Encounter.fromInput(input, db.encounters[idx]);
    db.encounters[idx] = updated.toJSON();
    this.saveDB(db);
    return updated;
  }

  deleteEncounter(id) {
    const db = this.loadDB();
    db.encounters = db.encounters.filter((e) => e.id !== id);
    this.saveDB(db);
  }
}

export const db = new Database(DB_PATH);

