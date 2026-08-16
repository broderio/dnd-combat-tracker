import { EVENTS } from '/shared/protocol.js';

import { socketClient } from '../socketClient.js';

const STORAGE_KEY = 'dice-roller-placement';

const panel = document.getElementById('dice-roller');
const header = document.getElementById('dice-roller-header');
const toggleBtn = document.getElementById('dice-roller-toggle');
const countInput = document.getElementById('dice-count');
const sidesInput = document.getElementById('dice-sides');
const modifierInput = document.getElementById('dice-modifier');
const rollBtn = document.getElementById('dice-roll-btn');
const quickButtons = document.querySelectorAll('.dice-quick-btn');
const log = document.getElementById('dice-log');

function requestRoll(count, sides, modifier) {
  socketClient.emitEvent(EVENTS.ROLL_DICE, { count, sides, modifier });
}

rollBtn.addEventListener('click', () => {
  requestRoll(
    parseInt(countInput.value, 10) || 1,
    parseInt(sidesInput.value, 10) || 20,
    parseInt(modifierInput.value, 10) || 0
  );
});

quickButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const sides = parseInt(btn.dataset.sides, 10);
    sidesInput.value = sides;
    requestRoll(1, sides, 0);
  });
});

socketClient.onEvent(EVENTS.DICE_ROLLED, ({ username, count, sides, modifier, rolls, total }) => {
  const li = document.createElement('li');
  const modText = modifier ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : '';
  const rollsText = rolls.length > 1 ? ` [${rolls.join(', ')}]` : '';
  li.textContent = `${username}: ${count}d${sides}${modText}${rollsText} = ${total}`;
  log.prepend(li);
  while (log.children.length > 30) log.removeChild(log.lastChild);
});

function loadPlacement() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePlacement(placement) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(placement));
}

const placement = loadPlacement();

function setCollapsed(collapsed) {
  panel.classList.toggle('collapsed', collapsed);
  toggleBtn.querySelector('i').textContent = collapsed ? 'expand_less' : 'expand_more';
  savePlacement({ ...loadPlacement(), collapsed });
}

toggleBtn.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
setCollapsed(Boolean(placement.collapsed));

function applyPosition(left, top) {
  const maxLeft = window.innerWidth - panel.offsetWidth - 4;
  const maxTop = window.innerHeight - panel.offsetHeight - 4;
  const clampedLeft = Math.max(4, Math.min(maxLeft, left));
  const clampedTop = Math.max(4, Math.min(maxTop, top));
  panel.style.left = `${clampedLeft}px`;
  panel.style.top = `${clampedTop}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  return { left: clampedLeft, top: clampedTop };
}

if (typeof placement.left === 'number' && typeof placement.top === 'number') {
  applyPosition(placement.left, placement.top);
}

let dragOffsetX = 0;
let dragOffsetY = 0;
let dragging = false;

header.addEventListener('pointerdown', (event) => {
  if (event.target.closest('#dice-roller-toggle')) return;
  dragging = true;
  const rect = panel.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  header.setPointerCapture(event.pointerId);
});

header.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const { left, top } = applyPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
  savePlacement({ ...loadPlacement(), left, top });
});

header.addEventListener('pointerup', (event) => {
  dragging = false;
  header.releasePointerCapture(event.pointerId);
});

window.addEventListener('resize', () => {
  const rect = panel.getBoundingClientRect();
  const { left, top } = applyPosition(rect.left, rect.top);
  savePlacement({ ...loadPlacement(), left, top });
});
