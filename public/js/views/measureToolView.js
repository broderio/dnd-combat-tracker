// public/js/views/measureToolView.js
//
// A simple ruler: toggle it on, drag across the board, and see the distance
// (in cells and feet) between the start and current point — for eyeballing
// spell ranges and movement. Available to both the DM and players (anyone
// might want to check a spell's range or how far they can move), unlike the
// DM-only board tools (overlay placement). Implemented as a
// `MeasureToolView` class since it owns `measuring`/`startCell` local state
// across its event handlers.
//
// Like overlayPanelView.js, this attaches its own listeners to the board
// element and only acts while armed (`clientState.boardTool.type ===
// 'measure'`) rather than boardView.js knowing anything about measuring.

import { clientState } from "../state.js";

import { cellFromEvent, getBoardElement } from "./boardView.js";

const boardEl = getBoardElement();
const measureLayer = document.getElementById("measure-layer");
const measureToggleBtn = document.getElementById("measure-tool-btn");

const FEET_PER_CELL = 5; // standard 5e assumption; matches the grid's "5-foot square" convention

class MeasureToolView {
  constructor() {
    this.measuring = false;
    this.startCell = null;

    measureToggleBtn.addEventListener("click", () => {
      const active = clientState.boardTool.type === "measure";
      if (active) {
        this.disarm();
      } else {
        clientState.setBoardTool({ type: "measure" });
        measureToggleBtn.classList.add("active");
        measureToggleBtn.textContent = "📏 Measuring… (click to stop)";
      }
    });

    boardEl.addEventListener("pointerdown", (e) => {
      if (clientState.boardTool.type !== "measure") return;
      this.measuring = true;
      this.startCell = cellFromEvent(e);
    });

    boardEl.addEventListener("pointermove", (e) => {
      if (!this.measuring) return;
      this.#drawLine(this.startCell, cellFromEvent(e));
    });

    boardEl.addEventListener("pointerup", () => {
      this.measuring = false;
    });
  }

  disarm() {
    clientState.setBoardTool({ type: "none" });
    measureToggleBtn.classList.remove("active");
    measureToggleBtn.textContent = "📏 Measure";
    this.measuring = false;
    MeasureToolView.#clearLine();
  }

  #drawLine(start, current) {
    const cs = clientState.board.grid.cellSize;
    const x1 = (start.col + 0.5) * cs;
    const y1 = (start.row + 0.5) * cs;
    const x2 = (current.col + 0.5) * cs;
    const y2 = (current.row + 0.5) * cs;

    // 5-10-5 distance for diagonal movement.
    const dx = Math.abs(current.col - start.col);
    const dy = Math.abs(current.row - start.row);
    const cells = dx + dy - Math.floor(Math.min(dx, dy) / 2);
    const feet = cells * FEET_PER_CELL;

    measureLayer.setAttribute("viewBox", `0 0 ${clientState.board.grid.cols * cs} ${clientState.board.grid.rows * cs}`);
    measureLayer.innerHTML = "";

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", "measure-line");
    measureLayer.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (x1 + x2) / 2);
    label.setAttribute("y", (y1 + y2) / 2 - 8);
    label.setAttribute("class", "measure-label");
    label.textContent = `${cells} cell${cells === 1 ? "" : "s"} · ${feet} ft`;
    measureLayer.appendChild(label);
  }

  static #clearLine() {
    measureLayer.innerHTML = "";
  }
}

new MeasureToolView();

