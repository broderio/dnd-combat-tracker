import { EVENTS } from '../../shared/protocol.js';

export class JoinHandler {
  constructor(io, socket, session, database, gameStateStore, roster) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.db = database;
    this.gameState = gameStateStore;
    this.roster = roster;
  }

  register() {
    this.socket.on(EVENTS.JOIN, (payload) => this.#handleJoin(payload));
    this.socket.on('disconnect', () => this.#handleDisconnect());
  }

  #handleJoin({ mode, name, characterId }) {
    this.session.mode = mode === 'dm' ? 'dm' : 'player';
    this.session.name = (name || '').trim() || 'Player';
    this.session.characterId = characterId || null;
    this.socket.data.session = this.session;

    if (this.session.mode === 'player') {
      const db = this.db.loadDB();
      const user = db.users[this.session.name.toLowerCase()];
      const character = user ? user.characters.find((c) => c.id === this.session.characterId) : null;

      this.roster.addActivePlayer(this.socket.id, this.session.name, character);
      if (character) this.socket.emit(EVENTS.YOUR_CHARACTER, character);
    }

    this.socket.emit(EVENTS.JOINED, { mode: this.session.mode, name: this.session.name });
    this.socket.emit(EVENTS.STATE, this.gameState.getState());
    if (this.session.mode === 'dm') {
      this.socket.emit(EVENTS.ALL_MONSTER_INSTANCES, this.gameState.getMonsterInstancesJSON());
    }

    this.roster.broadcastOnlinePlayers(this.io);
    this.roster.pushAllCharactersToDMs(this.io); // refresh every connected DM's
    // roster — covers first joins AND reconnects
    this.roster.broadcastPublicCharacters(this.io);

    this.socket.broadcast.emit(EVENTS.PRESENCE, {
      message: `${this.session.name} connected as ${this.session.mode.toUpperCase()}`,
    });
  }

  #handleDisconnect() {
    this.roster.removeActivePlayer(this.socket.id);
    this.roster.broadcastOnlinePlayers(this.io);
    this.roster.pushAllCharactersToDMs(this.io);
    this.roster.broadcastPublicCharacters(this.io);
    if (this.session.name) {
      this.socket.broadcast.emit(EVENTS.PRESENCE, { message: `${this.session.name} disconnected` });
    }
  }
}
