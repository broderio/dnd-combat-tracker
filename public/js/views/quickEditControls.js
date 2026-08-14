// public/js/views/quickEditControls.js
//
// The one shared "HP +/- and status-effect toggles" quick-edit widget used
// for both a Character (DM roster / player's own sheet, saved via REST) and
// a MonsterInstance (DM monster panel, saved via a socket event) — same UI,
// same STATUS_EFFECTS vocabulary, different save plumbing. Factored out so
// Phase 2 doesn't grow a second parallel implementation of this control.

import { STATUS_EFFECTS } from "/shared/schema.js";

/**
 * @param {{current: number, max: number}} hp
 * @param {string[]} statusEffects
 * @param {{onAdjustHp: (delta: number) => void, onToggleEffect: (effect: string, checked: boolean) => void, onSetMaxHp?: (max: number) => void}} handlers
 */
export function buildQuickEditControls(hp, statusEffects, { onAdjustHp, onToggleEffect, onSetMaxHp }) {
  const box = document.createElement("div");
  box.className = "char-sheet-quick-edit";

  const hpRow = document.createElement("div");
  hpRow.className = "quick-edit-hp";
  const minusBtn = document.createElement("button");
  minusBtn.textContent = "-1";
  const plusBtn = document.createElement("button");
  plusBtn.textContent = "+1";
  const hpLabel = document.createElement("span");
  hpLabel.textContent = `HP ${hp.current}/`;

  minusBtn.addEventListener("click", () => onAdjustHp(-1));
  plusBtn.addEventListener("click", () => onAdjustHp(1));
  hpRow.append(minusBtn, hpLabel, plusBtn);

  if (onSetMaxHp) {
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.min = "1";
    maxInput.max = "9999";
    maxInput.value = hp.max;
    maxInput.className = "quick-edit-max-hp";
    maxInput.addEventListener("change", () => {
      const next = Math.max(1, Math.min(9999, parseInt(maxInput.value, 10) || hp.max));
      onSetMaxHp(next);
    });
    hpRow.insertBefore(maxInput, plusBtn);
  } else {
    const maxLabel = document.createElement("span");
    maxLabel.textContent = String(hp.max);
    hpRow.insertBefore(maxLabel, plusBtn);
  }

  box.appendChild(hpRow);


  const effectsGrid = document.createElement("div");
  effectsGrid.className = "status-effect-grid";
  Object.keys(STATUS_EFFECTS).forEach((effect) => {
    const label = document.createElement("label");
    label.className = "status-effect-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = (statusEffects || []).includes(effect);
    cb.addEventListener("change", () => onToggleEffect(effect, cb.checked));
    label.append(cb, " " + effect);
    effectsGrid.appendChild(label);
  });
  box.appendChild(effectsGrid);

  return box;
}
