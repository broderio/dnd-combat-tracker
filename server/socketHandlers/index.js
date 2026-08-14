// server/socketHandlers/index.js
//
// Single place that wires up `io.on('connection', ...)`. Each connected
// socket gets its own `session` object (mode/name/characterId), shared by
// reference across the handler modules registered below.

import { registerGridHandler } from "./gridHandler.js";
import { registerJoinHandler } from "./joinHandler.js";
import { registerTokenHandlers } from "./tokenHandlers.js";

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    const session = { mode: null, name: null, characterId: null };

    registerJoinHandler(io, socket, session);
    registerGridHandler(io, socket, session);
    registerTokenHandlers(io, socket, session);
  });
}
