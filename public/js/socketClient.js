// public/js/socketClient.js
//
// The single place that creates the `io()` connection and knows about
// reconnect-rejoin recovery. Every other module talks to the socket through
// `onEvent`/`emitEvent`/`joinTable` instead of touching a socket instance
// directly, and uses `EVENTS.*` constants (from shared/protocol.js) instead
// of typing event-name strings.

import { EVENTS } from "/shared/protocol.js";

// `io` is a global provided by the `/socket.io/socket.io.js` script tag
// loaded in index.html before this module.
const socket = io();

// Remembers the payload used for the last successful 'join' so we can silently
// re-send it if the socket ever drops and Socket.IO auto-reconnects (e.g. WiFi
// blip, laptop sleep). Without this, a reconnect creates a fresh, un-joined
// socket on the server: the DM loses that player from their roster, and the
// player's own moves stop being accepted, because server-side permission checks
// depend on session data set during 'join'.
let lastJoinPayload = null;

socket.on("connect", () => {
  if (lastJoinPayload) {
    socket.emit(EVENTS.JOIN, lastJoinPayload);
  }
});

/**
 * Registers a handler for a socket.io event (works for both our EVENTS.* names
 * and the built-in 'connect'/'disconnect').
 */
export function onEvent(eventName, handler) {
  socket.on(eventName, handler);
}

/** Emits a socket.io event with a payload. */
export function emitEvent(eventName, payload) {
  socket.emit(eventName, payload);
}

/**
 * Sends the initial 'join' for this tab, and remembers it for reconnect
 * recovery.
 */
export function joinTable(payload) {
  lastJoinPayload = payload;
  emitEvent(EVENTS.JOIN, payload);
}
