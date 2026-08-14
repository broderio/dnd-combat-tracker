// public/js/views/overlayPanelView.js
//
// DM-only: create and manage AoE overlays (fire, water, electricity, etc.).
// The DM picks a type/shape/radius/label, then "arms" placement and clicks a
// cell on the board to drop it there — coordinated with boardView.js purely
// through the shared `boardTool` flag in state.js (boardView just renders
// whatever's in `board.overlays`; this module decides when a board click
// means "place an overlay here").

import { OVERLAY_TYPES } from "/shared/schema.js";
import { EVENTS } from "/shared/protocol.js";

import { emitEvent } from "../socketClient.js";
import { board, boardTool, session, setBoardTool } from "../state.js";

import { cellFromEvent, getBoardElement } from "./boardView.js";

const overlayTypeSelect = document.getElementById("overlay-type");
const overlayShapeSelect = document.getElementById("overlay-shape");
const overlayRadiusInput = document.getElementById("overlay-radius");
const overlayLabelInput = document.getElementById("overlay-label");
const placeOverlayBtn = document.getElementById("place-overlay-btn");
const overlayList = document.getElementById("overlay-list");

// Populate the type <select> once, from the schema's OVERLAY_TYPES map —
// adding a new overlay type there is enough for it to show up here too.
Object.entries(OVERLAY_TYPES).forEach(([key, meta]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = meta.label;
  overlayTypeSelect.appendChild(opt);
});

placeOverlayBtn.addEventListener("click", () => {
  const alreadyArmed = boardTool.type === "place-overlay";
  if (alreadyArmed) {
    disarm();
    return;
  }
  setBoardTool({
    type: "place-overlay",
    draft: {
      type: overlayTypeSelect.value,
      shape: overlayShapeSelect.value,
      radius: overlayRadiusInput.value,
      label: overlayLabelInput.value.trim(),
    },
  });
  placeOverlayBtn.textContent = "Click the grid to place… (click again to cancel)";
  placeOverlayBtn.classList.add("active");
});

getBoardElement().addEventListener("click", (e) => {
  if (boardTool.type !== "place-overlay" || session.mode !== "dm") return;
  const { col, row } = cellFromEvent(e);
  emitEvent(EVENTS.ADD_OVERLAY, { ...boardTool.draft, col, row });
  disarm();
});

function disarm() {
  setBoardTool({ type: "none" });
  placeOverlayBtn.textContent = "Place on Grid";
  placeOverlayBtn.classList.remove("active");
}

/** The DM's overlay list (with Remove buttons) — a no-op for players. */
export function renderOverlayList() {
  if (session.mode !== "dm") return;
  overlayList.innerHTML = "";
  Object.values(board.overlays).forEach((overlay) => {
    const meta = OVERLAY_TYPES[overlay.type] || OVERLAY_TYPES.generic;
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = meta.color;

    const text = document.createElement("span");
    text.className = "tok-meta";
    text.textContent = `${meta.label}${overlay.label ? " — " + overlay.label : ""} (radius ${overlay.radius})`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => emitEvent(EVENTS.REMOVE_OVERLAY, overlay.id));

    li.append(swatch, text, removeBtn);
    overlayList.appendChild(li);
  });
}
