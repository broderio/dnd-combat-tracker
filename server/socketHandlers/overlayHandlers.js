// server/socketHandlers/overlayHandlers.js
//
// DM-only: place/remove AoE overlays (fire, water, electricity, etc.) on the
// grid. Overlays are part of the broadcast `state` (like grid/tokens), so no
// dedicated "overlay-added" event is needed — adding/removing one just
// triggers a normal full-state re-broadcast, same pattern as gridHandler.js.

import { EVENTS } from "../../shared/protocol.js";
import { addOverlay, getState, removeOverlay } from "../gameState.js";
import { canManageBoard } from "../policy.js";

export function registerOverlayHandlers(io, socket, session) {
  socket.on(EVENTS.ADD_OVERLAY, (overlay) => {
    if (!canManageBoard(session)) return;
    addOverlay(overlay);
    io.emit(EVENTS.STATE, getState());
  });

  socket.on(EVENTS.REMOVE_OVERLAY, (id) => {
    if (!canManageBoard(session)) return;
    removeOverlay(id);
    io.emit(EVENTS.STATE, getState());
  });
}
