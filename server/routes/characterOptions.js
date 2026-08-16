import { Router } from 'express';

import { characterOptionsLibrary } from '../characterOptions.js';

// Read-only lookups backing the character modal's searchable dropdowns —
// class/race name autocomplete plus weapon/spell reference search. See
// server/characterOptions.js for why these are name-only rather than fully
// structured like server/monsterLibrary.js.
export class CharacterOptionsController {
  constructor() {
    this.router = Router();
    this.router.get('/character-options/classes', (req, res) => this.classes(req, res));
    this.router.get('/character-options/races', (req, res) => this.races(req, res));
    this.router.get('/character-options/weapons', (req, res) => this.weapons(req, res));
    this.router.get('/character-options/spells', (req, res) => this.spells(req, res));
  }

  classes(req, res) {
    res.json({ ok: true, classes: characterOptionsLibrary.searchClasses(req.query) });
  }

  races(req, res) {
    res.json({ ok: true, races: characterOptionsLibrary.searchRaces(req.query) });
  }

  weapons(req, res) {
    res.json({ ok: true, weapons: characterOptionsLibrary.searchWeapons(req.query) });
  }

  spells(req, res) {
    res.json({ ok: true, spells: characterOptionsLibrary.searchSpells(req.query) });
  }
}
