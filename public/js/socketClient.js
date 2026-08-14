// public/js/socketClient.js
//
// The single place that creates the `io()` connection and knows about
// reconnect-rejoin recovery. Every other module talks to the socket through
// the `socketClient` singleton's `onEvent`/`emitEvent`/`joinTable` methods
// instead of touching a socket instance directly, and uses `EVENTS.*`
// constants (from shared/protocol.js) instead of typing event-name strings.

import { EVENTS } from "/shared/protocol.js";

export class SocketClient {
  constructor() {
    // `io` is a global provided by the `/socket.io/socket.io.js` script tag
    // loaded in index.html before this module.
    this.socket = io();

    // Remembers the payload used for the last successful 'join' so we can
    // silently re-send it if the socket ever drops and Socket.IO
    // auto-reconnects (e.g. WiFi blip, laptop sleep). Without this, a
    // reconnect creates a fresh, un-joined socket on the server: the DM
    // loses that player from their roster, and the player's own moves stop
    // being accepted, because server-side permission checks depend on
    // session data set during 'join'.
    this.lastJoinPayload = null;

    this.socket.on("connect", () => {
      if (this.lastJoinPayload) {
        this.socket.emit(EVENTS.JOIN, this.lastJoinPayload);
      }
    });
  }

  /**
   * Registers a handler for a socket.io event (works for both our EVENTS.*
   * names and the built-in 'connect'/'disconnect').
   */
  onEvent(eventName, handler) {
    this.socket.on(eventName, handler);
  }

  /** Emits a socket.io event with a payload. */
  emitEvent(eventName, payload) {
    this.socket.emit(eventName, payload);
  }

  /**
   * Sends the initial 'join' for this tab, and remembers it for reconnect
   * recovery.
   */
  joinTable(payload) {
    this.lastJoinPayload = payload;
    this.emitEvent(EVENTS.JOIN, payload);
  }
}

export const socketClient = new SocketClient();

