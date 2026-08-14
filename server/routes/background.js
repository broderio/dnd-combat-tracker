// server/routes/background.js
//
// Handles the DM's map-image upload and broadcasts the new board state to
// everyone. Kept separate from characters.js/auth.js since it deals with
// file storage (multer) rather than the JSON db.

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { EVENTS } from '../../shared/protocol.js';
import { setBackground, getState } from '../gameState.js';

export default function createBackgroundRouter(io, uploadDir) {
  const router = Router();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'background-' + Date.now() + ext);
    }
  });
  const upload = multer({ storage });

  router.post('/upload-background', upload.single('background'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    setBackground('/uploads/' + req.file.filename);
    io.emit(EVENTS.STATE, getState()); // broadcast full state so everyone gets the new background
    res.json({ ok: true, background: getState().background });
  });

  return router;
}
