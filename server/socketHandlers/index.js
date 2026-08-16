// server/socketHandlers/index.js
//
// Single place that wires up `io.on('connection', ...)`. Each connected
// socket gets its own `session` object (mode/name/characterId), shared by
// reference across the handler instances constructed below.

import { db } from '../db.js';
import { gameState } from '../gameState.js';
import { rosterStore } from '../rosterStore.js';

import { GridHandler } from './gridHandler.js';
import { JoinHandler } from './joinHandler.js';
import { OverlayHandlers } from './overlayHandlers.js';
import { TokenHandlers } from './tokenHandlers.js';
import { TurnHandlers } from './turnHandlers.js';
import { DiceHandlers } from './diceHandler.js';

/**
 * Wires up `io.on('connection', ...)`, instantiating one of each handler
 * class per connected socket (each instance encapsulates that socket's
 * `io`/`socket`/`session` plus the shared `gameState`/`rosterStore`
 * singletons it needs).
 */
export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    const session = { mode: null, name: null, characterId: null };

    new JoinHandler(io, socket, session, db, gameState, rosterStore).register();
    new GridHandler(io, socket, session, gameState).register();
    new TokenHandlers(io, socket, session, gameState).register();
    new OverlayHandlers(io, socket, session, gameState).register();
    new TurnHandlers(io, socket, session, gameState).register();
    new DiceHandlers(io, socket, session).register();
  });
}
