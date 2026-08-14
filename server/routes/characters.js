// server/routes/characters.js
//
// REST CRUD for player characters, plus the DM's full-roster endpoint.
// Needs `io` to push live updates to the editing player's own socket and to
// every connected DM when a character is created/edited (see
// server/rosterStore.js's notifyCharacterUpdated).

import { Router } from 'express';
import { loadDB, saveDB, sanitizeCharacter } from '../db.js';
import { notifyCharacterUpdated } from '../rosterStore.js';

export default function createCharactersRouter(io) {
  const router = Router();

  // TODO: If a player updates their character's color, we should update the token color on the board in real-time.

  router.get('/characters/:username', (req, res) => {
    const db = loadDB();
    const user = db.users[req.params.username.toLowerCase()];
    if (!user) return res.status(404).json({ ok: false, error: 'Unknown username.' });
    res.json({ ok: true, characters: user.characters });
  });

  router.post('/characters/:username', (req, res) => {
    const db = loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: 'Unknown username.' });

    const character = sanitizeCharacter(req.body, null);
    user.characters.push(character);
    saveDB(db);
    notifyCharacterUpdated(io, user.username, character.id, character);
    res.json({ ok: true, characters: user.characters, character });
  });

  router.put('/characters/:username/:id', (req, res) => {
    const db = loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: 'Unknown username.' });

    const idx = user.characters.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Character not found.' });

    const updated = sanitizeCharacter(req.body, user.characters[idx]);
    user.characters[idx] = updated;
    saveDB(db);
    notifyCharacterUpdated(io, user.username, updated.id, updated);
    res.json({ ok: true, characters: user.characters, character: updated });
  });

  router.delete('/characters/:username/:id', (req, res) => {
    const db = loadDB();
    const key = req.params.username.toLowerCase();
    const user = db.users[key];
    if (!user) return res.status(404).json({ ok: false, error: 'Unknown username.' });

    user.characters = user.characters.filter((c) => c.id !== req.params.id);
    saveDB(db);
    res.json({ ok: true, characters: user.characters });
  });

  // Full roster for the DM, including players who aren't currently online.
  router.get('/all-characters', (req, res) => {
    const db = loadDB();
    const roster = Object.values(db.users).map((u) => ({
      username: u.username,
      characters: u.characters
    }));
    res.json({ ok: true, roster });
  });

  return router;
}
