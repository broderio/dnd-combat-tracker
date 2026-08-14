// public/js/views/boardView.js
//
// Renders the shared board: background image, grid lines (SVG), AoE
// overlays, and tokens, plus token drag-and-drop, as a `BoardView` class
// (see the `boardView` singleton at the bottom) — `draggingId` (which token,
// if any, is currently being dragged) is the local UI state it owns.
// `render()` is called whenever a fresh `state` arrives from the server;
// `positionToken()` / `refreshTokenVisual()` are called for the
// lighter-weight `token-moved` event so a single token move doesn't require
// re-rendering everything.
//
// This class owns board *rendering* only — the "what does a board click
// mean right now" tools (AoE placement, the measuring ruler) attach their
// own listeners to the same board element from their own view modules
// (overlayPanelView.js, measureToolView.js), coordinating only through the
// shared `boardTool` flag on `clientState`. Keeps this file focused on
// state → DOM.

import { OVERLAY_TYPES } from "/shared/schema.js";
import { EVENTS } from "/shared/protocol.js";

import { socketClient } from "../socketClient.js";
import { clientState } from "../state.js";

import { renderTokenList } from "./dmPanelView.js";

export class BoardView {
  constructor() {
    this.boardEl = document.getElementById("board");
    this.gridLayer = document.getElementById("grid-layer");
    this.overlayLayer = document.getElementById("overlay-layer");
    this.tokenLayer = document.getElementById("token-layer");

    /** The id of the token currently being dragged, or null. */
    this.draggingId = null;
  }

  render() {
    const board = clientState.board;
    const w = board.grid.cols * board.grid.cellSize;
    const h = board.grid.rows * board.grid.cellSize;
    this.boardEl.style.width = w + "px";
    this.boardEl.style.height = h + "px";

    this.boardEl.style.backgroundImage = board.background ? `url(${board.background})` : "none";

    this.#renderGrid(w, h);
    this.#renderOverlays();
    this.#renderTokens();
    renderTokenList();
  }

  #renderGrid(w, h) {
    const board = clientState.board;
    this.gridLayer.setAttribute("viewBox", `0 0 ${w} ${h}`);
    this.gridLayer.innerHTML = "";

    const showLines = clientState.session.mode === "dm" || board.grid.visible;
    if (!showLines) return;

    for (let c = 0; c <= board.grid.cols; c++) {
      const x = c * board.grid.cellSize;
      this.gridLayer.appendChild(BoardView.#svgLine(x, 0, x, h));
    }
    for (let r = 0; r <= board.grid.rows; r++) {
      const y = r * board.grid.cellSize;
      this.gridLayer.appendChild(BoardView.#svgLine(0, y, w, y));
    }
  }

  static #svgLine(x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    return line;
  }

  /** Renders every AoE overlay as a translucent, color-coded, click-through shape. */
  #renderOverlays() {
    const board = clientState.board;
    this.overlayLayer.innerHTML = "";
    const cs = board.grid.cellSize;
    Object.values(board.overlays).forEach((overlay) => {
      const meta = OVERLAY_TYPES[overlay.type] || OVERLAY_TYPES.generic;
      const el = document.createElement("div");
      el.className = "overlay-shape";
      el.title = overlay.label ? `${meta.label}: ${overlay.label}` : meta.label;
      el.style.background = meta.color;
      el.style.borderColor = meta.color;

      const size = overlay.radius * 2 * cs;
      const centerX = (overlay.col + 0.5) * cs;
      const centerY = (overlay.row + 0.5) * cs;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = centerX - size / 2 + "px";
      el.style.top = centerY - size / 2 + "px";
      el.style.borderRadius = overlay.shape === "circle" ? "50%" : "4px";

      this.overlayLayer.appendChild(el);
    });
  }

  /** True if `token` is at or below half its max HP (the standard "bloodied" threshold). */
  static #isBloodied(token) {
    return !!token.hp && token.hp.max > 0 && token.hp.current / token.hp.max <= 0.5;
  }

  #activeTurnTokenId() {
    const order = clientState.board.turnOrder;
    if (!order || order.currentIndex < 0) return null;
    return order.combatants[order.currentIndex]?.tokenId || null;
  }

  /** Applies bloodied/effect/current-turn CSS classes + tooltip to a token's DOM element. */
  #applyTokenVisualState(el, token) {
    const effects = [...(token.statusEffects || []), ...(token.overlayEffects || [])];
    el.classList.toggle("bloodied", BoardView.#isBloodied(token));
    el.classList.toggle("has-effect", effects.length > 0);
    el.classList.toggle("active-turn", token.id === this.#activeTurnTokenId());

    const hpText = token.hp ? ` — HP ${token.hp.current}/${token.hp.max}` : "";
    const effectsText = effects.length ? ` [${effects.join(", ")}]` : "";
    el.title =
      (token.owner ? `${token.name} (controlled by ${token.owner})` : `${token.name} (DM-controlled)`) +
      hpText +
      effectsText;
  }

  /**
   * Re-applies the visual-state classes (bloodied/effects/current-turn) for a
   * single token without re-rendering the whole board — used after a
   * lightweight `token-moved` event, since moving can change overlay
   * membership.
   */
  refreshTokenVisual(id) {
    const token = clientState.board.tokens[id];
    const el = this.tokenLayer.querySelector(`[data-id="${id}"]`);
    if (!token || !el) return;
    this.#applyTokenVisualState(el, token);
  }

  #renderTokens() {
    const board = clientState.board;
    this.tokenLayer.innerHTML = "";
    Object.values(board.tokens).forEach((token) => {
      const el = document.createElement("div");
      el.className = "token";
      el.dataset.id = token.id;
      const size = board.grid.cellSize - 6;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.background = token.color;
      el.textContent = BoardView.#initials(token.name);
      this.#applyTokenVisualState(el, token);

      const canDrag =
        clientState.session.mode === "dm" ||
        (token.owner && token.owner.toLowerCase() === clientState.session.name.toLowerCase());
      el.classList.add(canDrag ? "draggable" : "locked");
      if (canDrag) this.#attachDrag(el, token.id);

      this.tokenLayer.appendChild(el);
      this.positionToken(token.id);
    });
  }

  /**
   * Repositions a single token's DOM element without re-rendering everything
   * else — used for the `token-moved` event.
   */
  positionToken(id) {
    const board = clientState.board;
    const token = board.tokens[id];
    const el = this.tokenLayer.querySelector(`[data-id="${id}"]`);
    if (!token || !el) return;
    const size = board.grid.cellSize - 6;
    const x = token.col * board.grid.cellSize + (board.grid.cellSize - size) / 2;
    const y = token.row * board.grid.cellSize + (board.grid.cellSize - size) / 2;
    el.style.left = x + "px";
    el.style.top = y + "px";
  }

  // Not yet wired up anywhere — reserved for the planned "live token color
  // update when a player edits their character" feature (see the TODO in
  // server/routes/characters.js).
  updateTokenColor(tokenId, newColor) {
    const token = clientState.board.tokens[tokenId];
    if (!token) return;
    token.color = newColor;
    const el = this.tokenLayer.querySelector(`[data-id="${tokenId}"]`);
    if (el) el.style.background = newColor;
  }

  static #initials(name) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  disableDragging() {
    this.draggingDisabled = true;
    this.boardEl.style.cursor = "crosshair";

    board = clientState.board;
    Object.values(board.tokens).forEach((token) => {
      const el = this.tokenLayer.querySelector(`[data-id="${token.id}"]`);
      if (el) el.classList.remove("draggable");
    });
  }

  enableDragging() {
    this.draggingDisabled = false;
    this.boardEl.style.cursor = "";

    board = clientState.board;
    Object.values(board.tokens).forEach((token) => {
      const el = this.tokenLayer.querySelector(`[data-id="${token.id}"]`);
      if (!el) return;
      const canDrag =
        clientState.session.mode === "dm" ||
        (token.owner && token.owner.toLowerCase() === clientState.session.name.toLowerCase());
      el.classList.toggle("draggable", canDrag);
      el.classList.toggle("locked", !canDrag);
    });
  }

  #attachDrag(el, id) {
    el.addEventListener("pointerdown", (e) => {
      if (this.draggingDisabled) return;
      this.draggingId = id;
      el.classList.add("dragging");
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", (e) => {
      if (this.draggingId !== id) return;
      const board = clientState.board;
      const rect = this.boardEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = board.grid.cellSize - 6;
      el.style.left = BoardView.#clamp(x - size / 2, 0, this.boardEl.clientWidth - size) + "px";
      el.style.top = BoardView.#clamp(y - size / 2, 0, this.boardEl.clientHeight - size) + "px";
    });

    el.addEventListener("pointerup", (e) => {
      if (this.draggingId !== id) return;
      this.draggingId = null;
      el.classList.remove("dragging");

      const board = clientState.board;
      const rect = this.boardEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = BoardView.#clamp(Math.floor(x / board.grid.cellSize), 0, board.grid.cols - 1);
      const row = BoardView.#clamp(Math.floor(y / board.grid.cellSize), 0, board.grid.rows - 1);

      socketClient.emitEvent(EVENTS.MOVE_TOKEN, { id, col, row });
      // Optimistic local move (server may snap to a nearby free cell instead —
      // the `token-moved` broadcast that follows will correct this if so).
      board.tokens[id].col = col;
      board.tokens[id].row = row;
      this.positionToken(id);
    });
  }

  static #clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /** The board's bounding element — read-only access for other board-interaction classes. */
  getBoardElement() {
    return this.boardEl;
  }

  /** Converts a pointer/mouse event's client coordinates into a board {col, row}, clamped to grid bounds. */
  cellFromEvent(e) {
    const board = clientState.board;
    const rect = this.boardEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      col: BoardView.#clamp(Math.floor(x / board.grid.cellSize), 0, board.grid.cols - 1),
      row: BoardView.#clamp(Math.floor(y / board.grid.cellSize), 0, board.grid.rows - 1),
    };
  }
}

export const boardView = new BoardView();

// Thin facades preserving the module's prior function-based API, so the
// other view modules that import these by name (overlayPanelView.js,
// measureToolView.js, main.js, dmPanelView.js) don't all need to switch to
// calling methods on the `boardView` instance directly.
export function render() {
  boardView.render();
}
export function refreshTokenVisual(id) {
  boardView.refreshTokenVisual(id);
}
export function positionToken(id) {
  boardView.positionToken(id);
}
export function updateTokenColor(tokenId, newColor) {
  boardView.updateTokenColor(tokenId, newColor);
}
export function getBoardElement() {
  return boardView.getBoardElement();
}
export function cellFromEvent(e) {
  return boardView.cellFromEvent(e);
}
export function disableDragging() {
  boardView.disableDragging();
}
export function enableDragging() {
  boardView.enableDragging();
}
