import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeCharacter as sanitizeCharacterAgainstSchema } from './shared/schema.js';

// ESM has no built-in `__dirname` — this is the standard way to recover it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'db.json');

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) return { users: {} };
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    return parsed;
  } catch (err) {
    console.error('Failed to read db.json, starting fresh:', err.message);
    return { users: {} };
  }
}

export function saveDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let nextCharId = Date.now();
function generateCharId() {
  return 'char_' + (nextCharId++);
}

// Field-level validation/defaults now live in shared/schema.js (single source
// of truth, also used by the browser client). This wrapper only adds the one
// thing that's genuinely server-only: assigning a fresh, unique id to
// brand-new characters.
export function sanitizeCharacter(input, existing) {
  const c = sanitizeCharacterAgainstSchema(input, existing);
  if (!existing) c.id = generateCharId();
  return c;
}
