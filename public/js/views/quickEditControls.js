// public/js/views/quickEditControls.js
//
// The one shared "HP editing and status-effect toggles" quick-edit widget
// used for both a Character (DM roster / player's own sheet, saved via REST)
// and a MonsterInstance (Monsters sidebar, saved via a socket event) — same
// UI, same STATUS_EFFECTS vocabulary, different save plumbing. Factored out
// so Phase 2 doesn't grow a second parallel implementation of this control.
//
// HP editing supports two speeds: typing an exact current/max value directly
// (for big changes — no more clicking -1 repeatedly), and a configurable
// step +/- (defaults to 1, but the DM can bump it to 5/10/etc.) for quick
// repeated damage/healing during combat.

import { STATUS_EFFECTS } from '/shared/schema.js';

/**
 * @param {{current: number, max: number}} hp
 * @param {string[]} statusEffects
 * @param {{key:string,label:string,color:string}[]} customStatusEffects
 * @param {{onAdjustHp: (delta: number) => void, onSetCurrentHp?: (current: number) => void, onSetMaxHp?: (max: number) => void, onToggleEffect: (effect: string, checked: boolean) => void, onAddCustomEffect?: (label: string, color: string) => void}} handlers
 */
export function buildQuickEditControls(
  hp,
  statusEffects,
  customStatusEffects,
  { onAdjustHp, onSetCurrentHp, onSetMaxHp, onToggleEffect, onAddCustomEffect }
) {
  const box = document.createElement('div');
  box.className = 'char-sheet-quick-edit';

  const hpRow = document.createElement('div');
  hpRow.className = 'quick-edit-hp';

  const currentInput = document.createElement('input');
  currentInput.type = 'number';
  currentInput.value = hp.current;
  currentInput.className = 'quick-edit-current-hp';
  if (onSetCurrentHp) {
    currentInput.addEventListener('change', () => {
      const next = Math.max(-9999, Math.min(9999, parseInt(currentInput.value, 10) || 0));
      onSetCurrentHp(next);
    });
  } else {
    currentInput.disabled = true;
  }

  const slash = document.createElement('span');
  slash.textContent = '/';

  let maxField;
  if (onSetMaxHp) {
    maxField = document.createElement('input');
    maxField.type = 'number';
    maxField.min = '1';
    maxField.max = '9999';
    maxField.value = hp.max;
    maxField.className = 'quick-edit-max-hp';
    maxField.addEventListener('change', () => {
      const next = Math.max(1, Math.min(9999, parseInt(maxField.value, 10) || hp.max));
      onSetMaxHp(next);
    });
  } else {
    maxField = document.createElement('span');
    maxField.textContent = String(hp.max);
  }

  hpRow.append('HP ', currentInput, slash, maxField);
  box.appendChild(hpRow);

  // Configurable-step damage/heal — defaults to 1 (a plain -1/+1), but the DM
  // can change the step once and keep clicking -/+ for repeated damage/heal
  // of the same amount instead of clicking -1 that many times.
  const stepRow = document.createElement('div');
  stepRow.className = 'quick-edit-step';
  const minusBtn = document.createElement('button');
  minusBtn.textContent = '−';
  minusBtn.type = 'button';
  const stepInput = document.createElement('input');
  stepInput.type = 'number';
  stepInput.min = '1';
  stepInput.max = '999';
  stepInput.value = '1';
  stepInput.className = 'quick-edit-step-amount';
  const plusBtn = document.createElement('button');
  plusBtn.textContent = '+';
  plusBtn.type = 'button';

  const stepAmount = () => Math.max(1, Math.min(999, parseInt(stepInput.value, 10) || 1));
  minusBtn.addEventListener('click', () => onAdjustHp(-stepAmount()));
  plusBtn.addEventListener('click', () => onAdjustHp(stepAmount()));
  stepRow.append(minusBtn, stepInput, plusBtn);
  box.appendChild(stepRow);

  const effectsGrid = document.createElement('div');
  effectsGrid.className = 'status-effect-grid';
  Object.keys(STATUS_EFFECTS).forEach((effect) => {
    const label = document.createElement('label');
    label.className = 'status-effect-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (statusEffects || []).includes(effect);
    cb.addEventListener('change', () => onToggleEffect(effect, cb.checked));
    label.append(cb, ' ' + effect);
    effectsGrid.appendChild(label);
  });
  (customStatusEffects || []).forEach((custom) => {
    const label = document.createElement('label');
    label.className = 'status-effect-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = (statusEffects || []).includes(custom.key);
    cb.addEventListener('change', () => onToggleEffect(custom.key, cb.checked));
    const swatch = document.createElement('span');
    swatch.className = 'status-effect-swatch';
    swatch.style.backgroundColor = custom.color;
    label.append(cb, swatch, ' ' + custom.label);
    effectsGrid.appendChild(label);
  });
  box.appendChild(effectsGrid);

  if (onAddCustomEffect) {
    const addRow = document.createElement('div');
    addRow.className = 'quick-edit-custom-effect';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Custom effect (e.g. Bless)';
    nameInput.maxLength = 30;
    nameInput.className = 'custom-effect-name';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#5c7a4f';
    colorInput.className = 'custom-effect-color';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
      const label = nameInput.value.trim();
      if (!label) return;
      onAddCustomEffect(label, colorInput.value);
      nameInput.value = '';
    });

    addRow.append(nameInput, colorInput, addBtn);
    box.appendChild(addRow);
  }

  return box;
}
