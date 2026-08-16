import { OVERLAY_TYPES } from '/shared/schema.js';
import { EVENTS } from '/shared/protocol.js';

import { socketClient } from '../socketClient.js';
import { clientState } from '../state.js';

import { cellFromEvent, getBoardElement, disableDragging, enableDragging } from './boardView.js';

const overlayTypeSelect = document.getElementById('overlay-type');
const overlayShapeSelect = document.getElementById('overlay-shape');
const overlayRadiusInput = document.getElementById('overlay-radius');
const overlayLabelInput = document.getElementById('overlay-label');
const placeOverlayBtn = document.getElementById('place-overlay-btn');
const overlayList = document.getElementById('overlay-list');

Object.entries(OVERLAY_TYPES).forEach(([key, meta]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = meta.label;
  overlayTypeSelect.appendChild(opt);
});

placeOverlayBtn.addEventListener('click', () => {
  const alreadyArmed = clientState.boardTool.type === 'place-overlay';
  if (alreadyArmed) {
    disarm();
    return;
  }
  clientState.setBoardTool({
    type: 'place-overlay',
    draft: {
      type: overlayTypeSelect.value,
      shape: overlayShapeSelect.value,
      radius: overlayRadiusInput.value,
      label: overlayLabelInput.value.trim(),
    },
  });
  placeOverlayBtn.textContent = 'Click the grid to place… (click again to cancel)';
  placeOverlayBtn.classList.add('active');
  disableDragging();
});

getBoardElement().addEventListener('click', (e) => {
  if (clientState.boardTool.type !== 'place-overlay' || clientState.session.mode !== 'dm') return;
  const { col, row } = cellFromEvent(e);
  socketClient.emitEvent(EVENTS.ADD_OVERLAY, { ...clientState.boardTool.draft, col, row });
  disarm();
});

function disarm() {
  clientState.setBoardTool({ type: 'none' });
  placeOverlayBtn.textContent = 'Place on Grid';
  placeOverlayBtn.classList.remove('active');
  enableDragging();
}

/** The DM's overlay list (with Remove buttons) — a no-op for players. */
export function renderOverlayList() {
  if (clientState.session.mode !== 'dm') return;
  overlayList.innerHTML = '';
  Object.values(clientState.board.overlays).forEach((overlay) => {
    const meta = OVERLAY_TYPES[overlay.type] || OVERLAY_TYPES.generic;
    const li = document.createElement('li');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = meta.color;

    const text = document.createElement('span');
    text.className = 'tok-meta';
    text.textContent = `${meta.label}${overlay.label ? ' — ' + overlay.label : ''} (radius ${overlay.radius})`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => socketClient.emitEvent(EVENTS.REMOVE_OVERLAY, overlay.id));

    li.append(swatch, text, removeBtn);
    overlayList.appendChild(li);
  });
}
