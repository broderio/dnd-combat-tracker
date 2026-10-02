import { Router } from 'express';

import { ROUTES } from '../../shared/protocol.js';
import { PermissionPolicy } from '../policy.js';

export class AuthController {
  constructor(database) {
    this.db = database;
    this.router = Router();
    this.router.post(ROUTES.login, (req, res) => this.login(req, res));
    this.router.post(ROUTES.dmLogin, (req, res) => this.dmLogin(req, res));
  }

  login(req, res) {
    const username = String(req.body.username || '').trim();
    const pin = String(req.body.pin || '').trim();

    if (!username) return res.status(400).json({ ok: false, error: 'Username is required.' });
    if (!pin) return res.status(400).json({ ok: false, error: 'PIN is required.' });

    const db = this.db.loadDB();
    const key = username.toLowerCase();
    let user = db.users[key];

    if (!user) {
      user = { username, pin, characters: [] };
      db.users[key] = user;
      this.db.saveDB(db);
      return res.json({ ok: true, isNewUser: true, username, characters: [] });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ ok: false, error: 'Incorrect PIN for that username.' });
    }

    res.json({
      ok: true,
      isNewUser: false,
      username: user.username,
      characters: user.characters,
    });
  }

  // Hardcoded DM credentials, manually maintained in the `dm` section of
  // data/db.json — unlike player accounts, there's no auto-registration:
  // the username/pin must match exactly what's on file.
  dmLogin(req, res) {
    const username = String(req.body.username || '').trim();
    const pin = String(req.body.pin || '').trim();

    if (!username) return res.status(400).json({ ok: false, error: 'Username is required.' });
    if (!pin) return res.status(400).json({ ok: false, error: 'PIN is required.' });

    const db = this.db.loadDB();
    const dm = db.dm;

    if (!PermissionPolicy.verifyDmCredentials(dm, username, pin)) {
      return res.status(401).json({ ok: false, error: 'Incorrect DM username or PIN.' });
    }

    res.json({ ok: true, username: dm.username });
  }
}
