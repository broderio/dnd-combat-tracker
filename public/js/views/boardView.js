// public/js/views/boardView.js
//

import { OVERLAY_TYPES, STATUS_EFFECTS } from "/shared/schema.js";
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
    /** True while a board tool (e.g. measuring) has temporarily suspended token dragging. */
    this.draggingDisabled = false;

    /** Logical-to-display pixel ratio — see the file header comment. Recomputed on every render(). */
    this.displayScale = 1;

    this.#attachResize();
  }

  // Re-fits the board whenever its container changes size (window resize,
  // the DM panel/sidebar showing or hiding, etc.) — not just on `window`
  // resize, since those other layout changes don't fire a resize event. Also
  // watches the board's siblings (toolbar, hint text) since toggling their
  // visibility changes how much room is actually left for the board without
  // changing the wrap's own size.
  #attachResize() {
    const wrap = this.boardEl.parentElement;
    const observer = new ResizeObserver(() => this.render());
    observer.observe(wrap);
    for (const child of wrap.children) {
      if (child !== this.boardEl) observer.observe(child);
    }
  }

  /** The grid's own size, in logical (unscaled) pixels — before any display fitting. */
  #getLogicalSize() {
    const board = clientState.board;
    return {
      width: board.grid.cols * board.grid.cellSize,
      height: board.grid.rows * board.grid.cellSize,
    };
  }

  /**
   * The available space (content box, padding excluded) inside the board's
   * container, minus whatever room its siblings (the toolbar above it, the
   * hint text below it) actually take up — the wrap is a flex column, so
   * that space isn't available to the board itself. Getting this wrong
   * makes the board bigger than its real budget, which then gets clipped
   * by the wrap's `overflow: hidden`, cutting off the bottom rows of the
   * grid (and making them unreachable by drag/measuring).
   */
  #getContainerSize() {
    const wrap = this.boardEl.parentElement;
    const style = getComputedStyle(wrap);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    let siblingHeight = 0;
    for (const child of wrap.children) {
      if (child === this.boardEl) continue;
      const childStyle = getComputedStyle(child);
      if (childStyle.display === "none") continue;
      siblingHeight +=
        child.offsetHeight + parseFloat(childStyle.marginTop) + parseFloat(childStyle.marginBottom);
    }

    return {
      width: Math.max(0, wrap.clientWidth - paddingX),
      height: Math.max(0, wrap.clientHeight - paddingY - siblingHeight),
    };
  }

  /**
   * The single scale factor that fits the whole logical grid inside the
   * container in both dimensions at once (a "contain" fit), so every cell is
   * always in view with no scrolling.
   */
  #calculateDisplayScale(logicalWidth, logicalHeight) {
    if (!logicalWidth || !logicalHeight) return 1;
    const container = this.#getContainerSize();
    if (!container.width || !container.height) return 1;
    return Math.min(container.width / logicalWidth, container.height / logicalHeight);
  }

  /** Converts a pointer/mouse event's client coordinates into logical (unscaled) board pixels. */
  #boardPointFromEvent(e) {
    const rect = this.boardEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.displayScale,
      y: (e.clientY - rect.top) / this.displayScale,
    };
  }

  render() {
    const board = clientState.board;
    const { width: logicalWidth, height: logicalHeight } = this.#getLogicalSize();
    this.displayScale = this.#calculateDisplayScale(logicalWidth, logicalHeight);

    this.boardEl.style.width = `${logicalWidth * this.displayScale}px`;
    this.boardEl.style.height = `${logicalHeight * this.displayScale}px`;
    this.boardEl.style.backgroundImage = board.background ? `url(${board.background})` : "none";

    this.#renderGrid(logicalWidth, logicalHeight);
    this.#renderOverlays();
    this.#renderTokens();
    renderTokenList();
  }

  #renderGrid(logicalWidth, logicalHeight) {
    const board = clientState.board;
    const scale = this.displayScale;

    // The SVG's pixel size matches the board's on-screen size; its viewBox
    // stays in logical units so the line coordinates below don't need to
    // know about `scale` at all — the browser does that scaling for us.
    this.gridLayer.setAttribute("width", logicalWidth * scale);
    this.gridLayer.setAttribute("height", logicalHeight * scale);
    this.gridLayer.setAttribute("viewBox", `0 0 ${logicalWidth} ${logicalHeight}`);
    this.gridLayer.innerHTML = "";

    const showLines = clientState.session.mode === "dm" || board.grid.visible;
    if (!showLines) return;

    for (let c = 0; c <= board.grid.cols; c++) {
      const x = c * board.grid.cellSize;
      this.gridLayer.appendChild(BoardView.#svgLine(x, 0, x, logicalHeight));
    }
    for (let r = 0; r <= board.grid.rows; r++) {
      const y = r * board.grid.cellSize;
      this.gridLayer.appendChild(BoardView.#svgLine(0, y, logicalWidth, y));
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
    const cs = board.grid.cellSize * this.displayScale;
    this.overlayLayer.innerHTML = "";

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
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${centerX - size / 2}px`;
      el.style.top = `${centerY - size / 2}px`;
      el.style.borderRadius = overlay.shape === "circle" ? "50%" : "4px";

      this.overlayLayer.appendChild(el);
    });
  }

  /**
   * The redacted public status for this token's linked combatant (if any),
   * as broadcast by the server in `combatantStatuses` — the only place this
   * client learns whether a token is bloodied/afflicted. Never derived from
   * a real HP number, since players other than the owner/DM never receive
   * one for combatants they don't own (see ARCHITECTURE.md).
   */
  static #combatantStatus(token) {
    if (!token.combatantId) return null;
    return clientState.board.combatantStatuses?.[token.combatantId] || null;
  }

  #activeTurnTokenId() {
    const order = clientState.board.turnOrder;
    if (!order || order.currentIndex < 0) return null;
    return order.combatants[order.currentIndex]?.tokenId || null;
  }

  #applyTokenVisualState(el, token) {
    const status = BoardView.#combatantStatus(token);
    const effects = [...(status?.statusEffects || []), ...(token.overlayEffects || [])];
    const bloodied = status ? status.condition === "bloodied" || status.condition === "critical" : false;
    el.classList.toggle("bloodied", bloodied);
    el.classList.toggle("active-turn", token.id === this.#activeTurnTokenId());
    this.#renderTokenEffects(el, effects);

    const effectNames = effects.map((effect) => (typeof effect === "string" ? effect : effect.name));
    const effectsText = effectNames.length ? ` [${effectNames.join(", ")}]` : "";
    el.title = token.owner ? `${token.name} (controlled by ${token.owner})` : `${token.name} (DM-controlled)`;
    el.title += effectsText;
  }

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

      const size = (board.grid.cellSize - 6) * this.displayScale;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
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

  #renderTokenEffects(el, effects) {
    const oldContainer = el.querySelector(".token-effects");
    if (oldContainer) oldContainer.remove();
    if (!effects.length) return;

    const container = document.createElement("div");
    container.className = "token-effects";

    effects.forEach((effect) => {
      const effectName = typeof effect === "string" ? effect : effect.name;
      if (!effectName) return;

      const visual = STATUS_EFFECTS[effectName.toLowerCase()];
      const icon = visual?.icon || "help";
      const badge = document.createElement("span");
      badge.className = "token-effect";
      badge.style.backgroundColor = visual?.background || "#555";
      badge.style.color = visual?.color || "#fff";

      const iconEl = document.createElement("span");
      iconEl.className = "token-effect-icon";
      iconEl.textContent = icon;

      badge.appendChild(iconEl);
      badge.title = effectName;
      container.appendChild(badge);
    });

    if (container.children.length) el.appendChild(container);
  }

  /** Repositions a single token's DOM element, in display pixels, from its logical col/row. */
  positionToken(id) {
    const board = clientState.board;
    const token = board.tokens[id];
    const el = this.tokenLayer.querySelector(`[data-id="${id}"]`);
    if (!token || !el) return;

    const scale = this.displayScale;
    const logicalSize = board.grid.cellSize - 6;
    const size = logicalSize * scale;
    const x = token.col * board.grid.cellSize * scale + (board.grid.cellSize * scale - size) / 2;
    const y = token.row * board.grid.cellSize * scale + (board.grid.cellSize * scale - size) / 2;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

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

  /** Suspends token dragging (used by measureToolView.js while a measuring tool is armed). */
  disableDragging() {
    this.draggingDisabled = true;
    this.boardEl.style.cursor = "crosshair";
    Object.values(clientState.board.tokens).forEach((token) => {
      const el = this.tokenLayer.querySelector(`[data-id="${token.id}"]`);
      if (el) el.classList.remove("draggable");
    });
  }

  enableDragging() {
    this.draggingDisabled = false;
    this.boardEl.style.cursor = "";
    const board = clientState.board;
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
      const { x, y } = this.#boardPointFromEvent(e);
      const size = board.grid.cellSize - 6;
      const logicalWidth = board.grid.cols * board.grid.cellSize;
      const logicalHeight = board.grid.rows * board.grid.cellSize;
      const logicalX = BoardView.#clamp(x, size / 2, logicalWidth - size / 2);
      const logicalY = BoardView.#clamp(y, size / 2, logicalHeight - size / 2);

      const scale = this.displayScale;
      el.style.left = `${logicalX * scale - (size * scale) / 2}px`;
      el.style.top = `${logicalY * scale - (size * scale) / 2}px`;
    });

    el.addEventListener("pointerup", (e) => {
      if (this.draggingId !== id) return;
      this.draggingId = null;
      el.classList.remove("dragging");

      const board = clientState.board;
      const { x, y } = this.#boardPointFromEvent(e);
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

  /**
   * Converts a pointer/mouse event's client coordinates into a board
   * {col, row}, clamped to grid bounds. The one shared entry point every
   * board tool (dragging, measuring) uses to go from screen pixels to grid
   * cells — see the file header comment.
   */
  cellFromEvent(e) {
    const board = clientState.board;
    const { x, y } = this.#boardPointFromEvent(e);
    return {
      col: BoardView.#clamp(Math.floor(x / board.grid.cellSize), 0, board.grid.cols - 1),
      row: BoardView.#clamp(Math.floor(y / board.grid.cellSize), 0, board.grid.rows - 1),
    };
  }
}

export const boardView = new BoardView();

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
