// public/js/views/boardView.js
//
// Renders the shared board: background image, grid lines (SVG), and tokens,
// plus token drag-and-drop. `render()` is called whenever a fresh `state`
// arrives from the server; `positionToken()` is called for the lighter-weight
// `token-moved` event so a single token move doesn't require re-rendering
// everything.

import { EVENTS } from "/shared/protocol.js";

import { emitEvent } from "../socketClient.js";
import { board, session } from "../state.js";

import { renderTokenList } from "./dmPanelView.js";

const boardEl = document.getElementById("board");
const gridLayer = document.getElementById("grid-layer");
const tokenLayer = document.getElementById("token-layer");

let draggingId = null;

export function render() {
  const w = board.grid.cols * board.grid.cellSize;
  const h = board.grid.rows * board.grid.cellSize;
  boardEl.style.width = w + "px";
  boardEl.style.height = h + "px";

  boardEl.style.backgroundImage = board.background ? `url(${board.background})` : "none";

  renderGrid(w, h);
  renderTokens();
  renderTokenList();
}

function renderGrid(w, h) {
  gridLayer.setAttribute("viewBox", `0 0 ${w} ${h}`);
  gridLayer.innerHTML = "";

  const showLines = session.mode === "dm" || board.grid.visible;
  if (!showLines) return;

  for (let c = 0; c <= board.grid.cols; c++) {
    const x = c * board.grid.cellSize;
    gridLayer.appendChild(svgLine(x, 0, x, h));
  }
  for (let r = 0; r <= board.grid.rows; r++) {
    const y = r * board.grid.cellSize;
    gridLayer.appendChild(svgLine(0, y, w, y));
  }
}

function svgLine(x1, y1, x2, y2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  return line;
}

function renderTokens() {
  tokenLayer.innerHTML = "";
  Object.values(board.tokens).forEach((token) => {
    const el = document.createElement("div");
    el.className = "token";
    el.dataset.id = token.id;
    const size = board.grid.cellSize - 6;
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.background = token.color;
    el.textContent = initials(token.name);
    el.title = token.owner ? `${token.name} (controlled by ${token.owner})` : `${token.name} (DM-controlled)`;

    const canDrag = session.mode === "dm" || (token.owner && token.owner.toLowerCase() === session.name.toLowerCase());
    el.classList.add(canDrag ? "draggable" : "locked");
    if (canDrag) attachDrag(el, token.id);

    tokenLayer.appendChild(el);
    positionToken(token.id);
  });
}

/**
 * Repositions a single token's DOM element without re-rendering everything
 * else — used for the `token-moved` event.
 */
export function positionToken(id) {
  const token = board.tokens[id];
  const el = tokenLayer.querySelector(`[data-id="${id}"]`);
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
export function updateTokenColor(tokenId, newColor) {
  const token = board.tokens[tokenId];
  if (!token) return;
  token.color = newColor;
  const el = tokenLayer.querySelector(`[data-id="${tokenId}"]`);
  if (el) el.style.background = newColor;
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function attachDrag(el, id) {
  el.addEventListener("pointerdown", (e) => {
    draggingId = id;
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (draggingId !== id) return;
    const rect = boardEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = board.grid.cellSize - 6;
    el.style.left = clamp(x - size / 2, 0, boardEl.clientWidth - size) + "px";
    el.style.top = clamp(y - size / 2, 0, boardEl.clientHeight - size) + "px";
  });

  el.addEventListener("pointerup", (e) => {
    if (draggingId !== id) return;
    draggingId = null;
    el.classList.remove("dragging");

    const rect = boardEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = clamp(Math.floor(x / board.grid.cellSize), 0, board.grid.cols - 1);
    const row = clamp(Math.floor(y / board.grid.cellSize), 0, board.grid.rows - 1);

    emitEvent(EVENTS.MOVE_TOKEN, { id, col, row });
    board.tokens[id].col = col;
    board.tokens[id].row = row;
    positionToken(id);
  });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
