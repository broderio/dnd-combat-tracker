// server/routes/characters.js
//
// REST CRUD for player characters, plus the DM's full-roster endpoint.
// Needs `io` to push live updates to the editing player's own socket and to
// every connected DM when a character is created/edited (see
// RosterStore#notifyCharacterUpdated).

import { Router } from "express";

export class CharactersController {
  constructor(io, database, roster) {
    this.io = io;
    this.db = database;
    this.roster = roster;

    this.router = Router();
    // TODO: If a player updates their character's color, we should update the
    // token color on the board in real-time.
    this.router.get("/characters/:username", (req, res) => this.getCharacters(req, res));
    this.router.post("/characters/:username", (req, res) => this.createCharacter(req, res));
    this.router.put("/characters/:username/:id", (req, res) => this.updateCharacter(req, res));
    this.router.delete("/characters/:username/:id", (req, res) => this.deleteCharacter(req, res));
    this.router.get("/all-characters", (req, res) => this.getAllCharacters(req, res));
  }

  getCharacters(req, res) {
    const db = this.db.loadDB();
    const user = db.users[req.params.username.toLowerCase()];
    if (!user) return res.status(404).json({ ok: false, error: "Unknown username." });
    res.json({ ok: true, characters: user.characters });
  }

  createCharacter(req, res) {
    const db = this.db.loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: "Unknown username." });

    const character = this.db.sanitizeCharacter(req.body, null);
    user.characters.push(character);
    this.db.saveDB(db);
    this.roster.notifyCharacterUpdated(this.io, user.username, character.id, character);
    res.json({ ok: true, characters: user.characters, character });
  }

  updateCharacter(req, res) {
    const db = this.db.loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: "Unknown username." });

    const idx = user.characters.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: "Character not found." });

    const updated = this.db.sanitizeCharacter(req.body, user.characters[idx]);
    user.characters[idx] = updated;
    this.db.saveDB(db);
    this.roster.notifyCharacterUpdated(this.io, user.username, updated.id, updated);
    res.json({ ok: true, characters: user.characters, character: updated });
  }

  deleteCharacter(req, res) {
    const db = this.db.loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: "Unknown username." });

    user.characters = user.characters.filter((c) => c.id !== req.params.id);
    this.db.saveDB(db);
    res.json({ ok: true, characters: user.characters });
  }

  // Full roster for the DM, including players who aren't currently online.
  getAllCharacters(req, res) {
    const db = this.db.loadDB();
    const roster = Object.values(db.users).map((u) => ({ username: u.username, characters: u.characters }));
    res.json({ ok: true, roster });
  }
}
