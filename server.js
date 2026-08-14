import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import authRouter from "./server/routes/auth.js";
import createCharactersRouter from "./server/routes/characters.js";
import createBackgroundRouter from "./server/routes/background.js";
import { registerSocketHandlers } from "./server/socketHandlers/index.js";

// ESM has no built-in `__dirname` — this is the standard way to recover it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---- Static files & JSON body parsing ----
app.use(express.static(path.join(__dirname, "public")));
// Exposes shared/schema.js and shared/protocol.js at /shared/*.js so the
// browser client can `import` the exact same files the server uses — see
// the comment at the top of shared/schema.js for why this is safe/desired.
app.use("/shared", express.static(path.join(__dirname, "shared")));
app.use(express.json());

// ================= REST API =================
// Each router is a thin Express Router; the actual logic (persistence,
// validation, roster broadcasts) lives in server/db.js, shared/schema.js,
// and server/rosterStore.js. Character and background routes need `io` to
// push live updates, so they're created via a factory function.
app.use("/api", authRouter);
app.use("/api", createCharactersRouter(io));
app.use(createBackgroundRouter(io, UPLOAD_DIR));

// ================= Socket.io realtime layer =================
registerSocketHandlers(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DnD Combat Tracker running:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://<your-lan-ip>:${PORT}  (for players on your LAN)`);
  console.log(`  For players outside your network, see README.md for tunneling instructions.`);
});
