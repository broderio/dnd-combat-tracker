import { EVENTS } from '../../shared/protocol.js';
import { PermissionPolicy } from '../policy.js';

export class GridHandler {
  constructor(io, socket, session, gameStateStore) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.gameState = gameStateStore;
  }

  register() {
    this.socket.on(EVENTS.SET_GRID, (grid) => {
      if (!PermissionPolicy.canManageBoard(this.session)) return;
      this.gameState.setGrid(grid);
      this.io.emit(EVENTS.STATE, this.gameState.getState());
    });
  }
}
