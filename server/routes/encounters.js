import { Router } from 'express';

import { EVENTS } from '../../shared/protocol.js';

export class EncountersController {
  constructor(io, database, gameStateStore) {
    this.io = io;
    this.db = database;
    this.gameState = gameStateStore;

    this.router = Router();
    this.router.get('/encounters', (req, res) => this.list(req, res));
    this.router.post('/encounters', (req, res) => this.create(req, res));
    this.router.put('/encounters/:id', (req, res) => this.update(req, res));
    this.router.delete('/encounters/:id', (req, res) => this.remove(req, res));
    this.router.post('/encounters/:id/load', (req, res) => this.load(req, res));
  }

  list(req, res) {
    res.json({ ok: true, encounters: this.db.getEncounters() });
  }

  /** Captures the current live board state as a brand-new saved encounter. */
  create(req, res) {
    const encounter = this.db.createEncounter({ name: req.body.name, snapshot: this.gameState.toSnapshotJSON() });
    res.json({ ok: true, encounter: encounter.toJSON(), encounters: this.db.getEncounters() });
  }

  update(req, res) {
    const payload = { name: req.body.name };
    if (req.body.resnapshot) payload.snapshot = this.gameState.toSnapshotJSON();
    const updated = this.db.updateEncounter(req.params.id, payload);
    if (!updated) return res.status(404).json({ ok: false, error: 'Encounter not found.' });
    res.json({ ok: true, encounter: updated.toJSON(), encounters: this.db.getEncounters() });
  }

  remove(req, res) {
    this.db.deleteEncounter(req.params.id);
    res.json({ ok: true, encounters: this.db.getEncounters() });
  }

  load(req, res) {
    const encounter = this.db.getEncounter(req.params.id);
    if (!encounter) return res.status(404).json({ ok: false, error: 'Encounter not found.' });

    this.gameState.restoreSnapshot(encounter.snapshot);
    this.io.emit(EVENTS.STATE, this.gameState.getState());
    this.gameState.pushMonsterInstancesToDMs(this.io);
    res.json({ ok: true });
  }
}
