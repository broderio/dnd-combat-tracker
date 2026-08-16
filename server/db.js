import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Character, Encounter } from '../shared/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

export class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.nextCharId = Date.now();
    this.nextEncounterId = Date.now();
  }

  loadDB() {
    if (!fs.existsSync(this.dbPath)) return { users: {}, encounters: [] };
    try {
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.users) parsed.users = {};
      if (!parsed.encounters) parsed.encounters = [];
      return parsed;
    } catch (err) {
      console.error('Failed to read db.json, starting fresh:', err.message);
      return { users: {}, encounters: [] };
    }
  }

  saveDB(db) {
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
  }

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
    return 'char_' + this.nextCharId++;
  }

  findCharacter(username, characterId) {
    if (!username || !characterId) return null;
    const db = this.loadDB();
    const user = db.users[username.toLowerCase()];
    if (!user) return null;
    return user.characters.find((c) => c.id === characterId) || null;
  }

  sanitizeCharacter(input, existing) {
    const c = Character.fromInput(input, existing);
    if (!existing) c.id = this.generateCharacterId();
    return c;
  }

  generateEncounterId() {
    return 'enc_' + this.nextEncounterId++;
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
