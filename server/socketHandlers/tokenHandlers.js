// server/socketHandlers/tokenHandlers.js
import { EVENTS } from '../../shared/protocol.js';
import { PermissionPolicy } from '../policy.js';

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
    this.socket.on(EVENTS.ADD_MONSTER_TOKEN, (payload) => this.#handleAddMonsterToken(payload));
    this.socket.on(EVENTS.UPDATE_MONSTER_INSTANCE, (payload) => this.#handleUpdateMonsterInstance(payload));
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
    this.gameState.pushMonsterInstancesToDMs(this.io); // in case removing the token deleted a monster instance
  }

  #handleMoveToken({ id, col, row }) {
    const token = this.gameState.getToken(id);
    if (!token) return;
    if (!PermissionPolicy.canMoveToken(this.session, token)) return; // players may only move their own token

    const moved = this.gameState.moveToken(id, col, row);
    this.io.emit(EVENTS.TOKEN_MOVED, { id, col: moved.col, row: moved.row });
  }

  // DM-only: creates a fresh MonsterInstance from the dnd-data library and a
  // token linked to it, in one request (see GameStateStore#addMonsterInstance).
  #handleAddMonsterToken({ templateId, color, col, row }) {
    if (!PermissionPolicy.canManageBoard(this.session)) return;
    const instance = this.gameState.addMonsterInstance(templateId);
    if (!instance) return; // unknown templateId
    this.gameState.addToken({
      name: instance.name,
      color,
      owner: null,
      col,
      row,
      combatantId: instance.id,
      combatantType: 'monster',
    });
    this.io.emit(EVENTS.STATE, this.gameState.getState());
    this.gameState.pushMonsterInstancesToDMs(this.io);
  }

  // DM-only quick-edit of a placed monster instance's hp/statusEffects.
  #handleUpdateMonsterInstance({ id, hp, statusEffects }) {
    if (!PermissionPolicy.canManageBoard(this.session)) return;
    const updated = this.gameState.updateMonsterInstance(id, { hp, statusEffects });
    if (!updated) return;
    this.io.emit(EVENTS.STATE, this.gameState.getState());
    this.gameState.pushMonsterInstancesToDMs(this.io);
  }
}
