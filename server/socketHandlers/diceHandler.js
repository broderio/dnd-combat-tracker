import { EVENTS } from '../../shared/protocol.js';

function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

export class DiceHandlers {
  constructor(io, socket, session) {
    this.io = io;
    this.socket = socket;
    this.session = session;
  }

  register() {
    this.socket.on(EVENTS.ROLL_DICE, (payload) => this.#handleRoll(payload));
  }

  #handleRoll({ count, sides, modifier } = {}) {
    if (!this.session.mode) return; // must have joined first

    const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    const safeSides = Math.max(2, Math.min(100, parseInt(sides, 10) || 20));
    const safeModifier = Math.max(-100, Math.min(100, parseInt(modifier, 10) || 0));

    const rolls = Array.from({ length: safeCount }, () => rollDie(safeSides));
    const total = rolls.reduce((sum, r) => sum + r, 0) + safeModifier;

    this.io.emit(EVENTS.DICE_ROLLED, {
      username: this.session.name,
      mode: this.session.mode,
      count: safeCount,
      sides: safeSides,
      modifier: safeModifier,
      rolls,
      total,
    });
  }
}
