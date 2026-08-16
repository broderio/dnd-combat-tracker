import { EVENTS } from '/shared/protocol.js';

export class SocketClient {
  constructor() {
    this.socket = io();

    this.lastJoinPayload = null;

    this.socket.on('connect', () => {
      if (this.lastJoinPayload) {
        this.socket.emit(EVENTS.JOIN, this.lastJoinPayload);
      }
    });
  }

  onEvent(eventName, handler) {
    this.socket.on(eventName, handler);
  }

  emitEvent(eventName, payload) {
    this.socket.emit(eventName, payload);
  }

  joinTable(payload) {
    this.lastJoinPayload = payload;
    this.emitEvent(EVENTS.JOIN, payload);
  }
}

export const socketClient = new SocketClient();
