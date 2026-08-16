import { clientState } from '../state.js';

import { cellFromEvent, getBoardElement, disableDragging, enableDragging, getDisplayScale } from './boardView.js';

const boardEl = getBoardElement();
const measureLayer = document.getElementById('measure-layer');
const measureLineBtn = document.getElementById('measure-line-btn');
const measureRadiusBtn = document.getElementById('measure-radius-btn');
const measureSquareBtn = document.getElementById('measure-square-btn');

const FEET_PER_CELL = 5;

class MeasureToolView {
  constructor() {
    this.measuring = false;
    this.startCell = null;

    measureLineBtn.addEventListener('click', () => {
      const line_active = clientState.boardTool.type === 'measure-line';
      if (line_active) {
        this.disarm_line();
        enableDragging();
        return;
      }

      const square_active = clientState.boardTool.type === 'measure-square';
      if (square_active) {
        this.disarm_square();
      }

      const radius_active = clientState.boardTool.type === 'measure-radius';
      if (radius_active) {
        this.disarm_radius();
      }

      clientState.setBoardTool({ type: 'measure-line' });
      measureLineBtn.classList.add('active');
      disableDragging();
    });

    measureRadiusBtn.addEventListener('click', () => {
      const radius_active = clientState.boardTool.type === 'measure-radius';
      if (radius_active) {
        this.disarm_radius();
        enableDragging();
        return;
      }

      const square_active = clientState.boardTool.type === 'measure-square';
      if (square_active) {
        this.disarm_square();
      }

      const line_active = clientState.boardTool.type === 'measure-line';
      if (line_active) {
        this.disarm_line();
      }

      clientState.setBoardTool({ type: 'measure-radius' });
      measureRadiusBtn.classList.add('active');
      disableDragging();
    });

    measureSquareBtn.addEventListener('click', () => {
      const square_active = clientState.boardTool.type === 'measure-square';
      if (square_active) {
        this.disarm_square();
        enableDragging();
        return;
      }

      const line_active = clientState.boardTool.type === 'measure-line';
      if (line_active) {
        this.disarm_line();
      }

      const radius_active = clientState.boardTool.type === 'measure-radius';
      if (radius_active) {
        this.disarm_radius();
      }

      clientState.setBoardTool({ type: 'measure-square' });
      measureSquareBtn.classList.add('active');
      disableDragging();
    });

    boardEl.addEventListener('pointerdown', (e) => {
      if (
        clientState.boardTool.type === 'measure-line' ||
        clientState.boardTool.type === 'measure-radius' ||
        clientState.boardTool.type === 'measure-square'
      ) {
        this.measuring = true;
        this.startCell = cellFromEvent(e);
      }
    });

    boardEl.addEventListener('pointermove', (e) => {
      if (!this.measuring) return;

      if (clientState.boardTool.type === 'measure-line') {
        this.#drawLine(this.startCell, cellFromEvent(e));
      } else if (clientState.boardTool.type === 'measure-radius') {
        this.#drawRadius(this.startCell, cellFromEvent(e));
      } else if (clientState.boardTool.type === 'measure-square') {
        this.#drawSquare(this.startCell, cellFromEvent(e));
      }
    });

    boardEl.addEventListener('pointerup', () => {
      this.measuring = false;
    });

    boardEl.addEventListener('dblclick', () => {
      if (
        clientState.boardTool.type === 'measure-line' ||
        clientState.boardTool.type === 'measure-radius' ||
        clientState.boardTool.type === 'measure-square'
      ) {
        MeasureToolView.#clear();
      }
    });
  }

  static #clear() {
    measureLayer.innerHTML = '';
  }

  disarm_line() {
    clientState.setBoardTool({ type: 'none' });
    measureLineBtn.classList.remove('active');
    this.measuring = false;
    MeasureToolView.#clear();
  }

  disarm_radius() {
    clientState.setBoardTool({ type: 'none' });
    measureRadiusBtn.classList.remove('active');
    this.measuring = false;
    MeasureToolView.#clear();
  }

  disarm_square() {
    clientState.setBoardTool({ type: 'none' });
    measureSquareBtn.classList.remove('active');
    this.measuring = false;
    MeasureToolView.#clear();
  }

  #setLabelFontSize(label) {
    const scale = getDisplayScale();
    label.style.fontSize = `${13 / scale}px`;
    label.style.strokeWidth = `${4 / scale}px`;
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

    measureLayer.setAttribute('viewBox', `0 0 ${clientState.board.grid.cols * cs} ${clientState.board.grid.rows * cs}`);
    MeasureToolView.#clear();

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', 'measure-line');
    measureLayer.appendChild(line);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', (x1 + x2) / 2);
    label.setAttribute('y', (y1 + y2) / 2 - 8);
    label.setAttribute('class', 'measure-label');
    label.textContent = `${cells} cell${cells === 1 ? '' : 's'} · ${feet} ft`;
    this.#setLabelFontSize(label);
    measureLayer.appendChild(label);
  }

  #drawRadius(center, edge) {
    const cs = clientState.board.grid.cellSize;
    const x = (center.col + 0.5) * cs;
    const y = (center.row + 0.5) * cs;

    const dx = Math.abs(edge.col - center.col);
    const dy = Math.abs(edge.row - center.row);
    const cells = Math.max(dx, dy); // Chebyshev distance for radius
    const feet = cells * FEET_PER_CELL;

    measureLayer.setAttribute('viewBox', `0 0 ${clientState.board.grid.cols * cs} ${clientState.board.grid.rows * cs}`);
    MeasureToolView.#clear();

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', cells * cs);
    circle.setAttribute('class', 'measure-radius');
    measureLayer.appendChild(circle);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('class', 'measure-label');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = `${cells} cell${cells === 1 ? '' : 's'} · ${feet} ft`;
    this.#setLabelFontSize(label);
    measureLayer.appendChild(label);
  }

  #drawSquare(start, current) {
    const cs = clientState.board.grid.cellSize;
    const x1 = Math.min(start.col, current.col) * cs;
    const y1 = Math.min(start.row, current.row) * cs;
    const x2 = (Math.max(start.col, current.col) + 1) * cs;
    const y2 = (Math.max(start.row, current.row) + 1) * cs;

    const width = x2 - x1;
    const height = y2 - y1;

    const cellsX = Math.abs(current.col - start.col) + 1;
    const cellsY = Math.abs(current.row - start.row) + 1;
    const feetX = cellsX * FEET_PER_CELL;
    const feetY = cellsY * FEET_PER_CELL;

    measureLayer.setAttribute('viewBox', `0 0 ${clientState.board.grid.cols * cs} ${clientState.board.grid.rows * cs}`);
    MeasureToolView.#clear();

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x1);
    rect.setAttribute('y', y1);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('class', 'measure-square');
    measureLayer.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x1 + width / 2);
    label.setAttribute('y', y1 + height / 2 - 8);
    label.setAttribute('class', 'measure-label');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = `${cellsX}×${cellsY} cells · ${feetX}×${feetY} ft`;
    this.#setLabelFontSize(label);
    measureLayer.appendChild(label);
  }
}

new MeasureToolView();
