// server/socketHandlers/tokenHandlers.js
import { EVENTS } from "../../shared/protocol.js";
import { PermissionPolicy } from "../policy.js";

export class TokenHandlers {
  constructor(io, socket, session, gameStateStore) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.gameState = gameStateStore;
  }

  register() {
    this.socket.on(EVENTS.ADD_TOKEN, (token) => this.#handleAddToken(token));
    this.socket.on(EVENTS.REMOVE_TOKEN, (id) => this.#handleRemoveToken(id));
    this.socket.on(EVENTS.MOVE_TOKEN, (payload) => this.#handleMoveToken(payload));
    this.socket.on(EVENTS.UPDATE_TOKEN, (payload) => this.#handleUpdateToken(payload));
  }

  #handleAddToken(token) {
    if (!PermissionPolicy.canManageBoard(this.session)) return;
    this.gameState.addToken(token);
    this.io.emit(EVENTS.STATE, this.gameState.getState());
  }

  #handleRemoveToken(id) {
    if (!PermissionPolicy.canManageBoard(this.session)) return;
    this.gameState.removeToken(id);
    this.io.emit(EVENTS.STATE, this.gameState.getState());
  }

  #handleMoveToken({ id, col, row }) {
    const token = this.gameState.getToken(id);
    if (!token) return;
    if (!PermissionPolicy.canMoveToken(this.session, token)) return; // players may only move their own token

    const moved = this.gameState.moveToken(id, col, row);
    this.io.emit(EVENTS.TOKEN_MOVED, { id, col: moved.col, row: moved.row, overlayEffects: moved.overlayEffects });
  }

  // DM-only: edit a token's HP and/or status effects from the DM panel.
  #handleUpdateToken({ id, hp, statusEffects }) {
    if (!PermissionPolicy.canManageBoard(this.session)) return;
    const updated = this.gameState.updateToken(id, { hp, statusEffects });
    if (!updated) return;
    this.io.emit(EVENTS.STATE, this.gameState.getState());
  }
}

