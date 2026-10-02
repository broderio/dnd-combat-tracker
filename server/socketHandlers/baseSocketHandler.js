import { PermissionPolicy } from '../policy.js';

/**
 * Shared base for socket handlers that gate board-management events behind
 * `PermissionPolicy.canManageBoard` and broadcast the full board state after
 * mutating it. See gridHandler.js, tokenHandlers.js, overlayHandlers.js,
 * turnHandlers.js.
 */
export class BaseSocketHandler {
  constructor(io, socket, session, gameStateStore) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.gameState = gameStateStore;
  }

  /** DM-only guard shared by all board-management socket handlers. */
  guard() {
    return PermissionPolicy.canManageBoard(this.session);
  }

  /** Broadcasts the current board state to every connected socket. */
  broadcastState() {
    this.gameState.broadcast(this.io);
  }
}
