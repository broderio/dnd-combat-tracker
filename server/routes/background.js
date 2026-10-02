import { Router } from 'express';
import multer from 'multer';
import path from 'path';

import { UPLOAD_BACKGROUND_ROUTE } from '../../shared/protocol.js';

export class BackgroundController {
  constructor(io, gameStateStore, uploadDir) {
    this.io = io;
    this.gameState = gameStateStore;

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, 'background-' + Date.now() + ext);
      },
    });
    const upload = multer({ storage });

    this.router = Router();
    this.router.post(UPLOAD_BACKGROUND_ROUTE, upload.single('background'), (req, res) => this.uploadBackground(req, res));
  }

  uploadBackground(req, res) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    this.gameState.setBackground('/uploads/' + req.file.filename);
    this.gameState.broadcast(this.io); // broadcast full
    // state so everyone gets the new background
    res.json({ ok: true, background: this.gameState.getState().background });
  }
}
