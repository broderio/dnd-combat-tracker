import { Router } from 'express';

import { monsterLibrary } from '../monsterLibrary.js';

export class MonstersController {
  constructor() {
    this.router = Router();
    this.router.get('/monsters', (req, res) => this.search(req, res));
    this.router.get('/monsters/:id', (req, res) => this.getOne(req, res));
  }

  search(req, res) {
    const { name, crMin, crMax, type, limit } = req.query;
    const results = monsterLibrary.search({ name, crMin, crMax, type, limit });
    res.json({ ok: true, monsters: results });
  }

  getOne(req, res) {
    const template = monsterLibrary.getTemplate(req.params.id);
    if (!template) return res.status(404).json({ ok: false, error: 'Unknown monster id.' });
    res.json({ ok: true, monster: template });
  }
}
