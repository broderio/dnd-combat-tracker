// server/routes/auth.js
//
// Deliberately lightweight (no hashing, no sessions/cookies) per the stated
// requirements: usernames must be unique, PIN is just a shared-secret
// convenience, not real security.

import { Router } from "express";

export class AuthController {
  constructor(database) {
    this.db = database;
    this.router = Router();
    this.router.post("/login", (req, res) => this.login(req, res));
  }

  login(req, res) {
    const username = String(req.body.username || "").trim();
    const pin = String(req.body.pin || "").trim();

    if (!username) return res.status(400).json({ ok: false, error: "Username is required." });
    if (!pin) return res.status(400).json({ ok: false, error: "PIN is required." });

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
      return res.status(401).json({ ok: false, error: "Incorrect PIN for that username." });
    }

    res.json({
      ok: true,
      isNewUser: false,
      username: user.username,
      characters: user.characters,
    });
  }
}
