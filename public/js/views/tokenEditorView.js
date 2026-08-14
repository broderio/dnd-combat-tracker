// public/js/views/tokenEditorView.js
//
// Builds each row of the DM's token list (dmPanelView.js's #token-list),
// including an expandable "Edit" section for a token's HP and status
// effects. When the token is linked to a player (i.e. has an `owner`), the
// editor also shows that player's character (via the DM roster) and a
// shortcut into the same character-edit modal players use — this is how the
// DM sees/edits a token's associated character stats (see
// characterModalView.js's 'edit-as-dm' context, which points the save at the
// *character's* owner, not the DM's own username).
//
// Kept in its own file so dmPanelView.js stays focused on the
// background/grid/token-creation controls rather than growing to also own
// per-token editing.

import { STATUS_EFFECTS } from "/shared/schema.js";
import { EVENTS } from "/shared/protocol.js";

import { socketClient } from "../socketClient.js";
import { clientState } from "../state.js";

import { openCharacterModal } from "./characterModalView.js";
import { renderTokenList } from "./dmPanelView.js";

class TokenEditorView {
  constructor() {
    // Which token's editor is currently expanded (only one at a time, and
    // only meaningful for the DM, who's the only one that ever renders this
    // list).
    this.expandedTokenId = null;
  }

  /** Builds one `<li>` for the DM's token list, including the expandable editor. */
  buildTokenListItem(token) {
    const li = document.createElement("li");
    li.className = "token-list-item";

    const row = document.createElement("div");
    row.className = "token-list-row";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = token.color;

    const meta = document.createElement("span");
    meta.className = "tok-meta";
    const hpText = token.hp ? ` — HP ${token.hp.current}/${token.hp.max}` : "";
    meta.textContent = `${token.name} — ${token.owner || "DM-controlled"}${hpText}`;

    const isExpanded = this.expandedTokenId === token.id;

    const editBtn = document.createElement("button");
    editBtn.textContent = isExpanded ? "Close" : "Edit";
    editBtn.addEventListener("click", () => {
      this.expandedTokenId = isExpanded ? null : token.id;
      renderTokenList();
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => socketClient.emitEvent(EVENTS.REMOVE_TOKEN, token.id));

    row.append(swatch, meta, editBtn, removeBtn);
    li.appendChild(row);

    if (isExpanded) li.appendChild(this.#buildEditor(token));

    return li;
  }

  #buildEditor(token) {
    const editor = document.createElement("div");
    editor.className = "token-editor";

    const hpRow = document.createElement("div");
    hpRow.className = "token-editor-hp";
    const hpLabel = document.createElement("span");
    hpLabel.textContent = "HP ";
    const hpCurrent = document.createElement("input");
    hpCurrent.type = "number";
    hpCurrent.value = token.hp.current;
    hpCurrent.title = "Current HP";
    const hpSlash = document.createElement("span");
    hpSlash.textContent = " / ";
    const hpMax = document.createElement("input");
    hpMax.type = "number";
    hpMax.value = token.hp.max;
    hpMax.title = "Max HP";
    hpRow.append(hpLabel, hpCurrent, hpSlash, hpMax);
    editor.appendChild(hpRow);

    const effectsGrid = document.createElement("div");
    effectsGrid.className = "status-effect-grid";
    const checkboxes = STATUS_EFFECTS.map((effect) => {
      const label = document.createElement("label");
      label.className = "status-effect-option";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = effect;
      cb.checked = token.statusEffects.includes(effect);
      label.append(cb, " " + effect);
      effectsGrid.appendChild(label);
      return cb;
    });
    editor.appendChild(effectsGrid);

    if (token.overlayEffects && token.overlayEffects.length) {
      const auto = document.createElement("p");
      auto.className = "hint";
      auto.textContent = `Also affected by area overlays: ${token.overlayEffects.join(", ")} (automatic — move the token out of the area to clear).`;
      editor.appendChild(auto);
    }

    const saveBtn = document.createElement("button");
    saveBtn.className = "secondary-btn";
    saveBtn.textContent = "Save Token State";
    saveBtn.addEventListener("click", () => {
      socketClient.emitEvent(EVENTS.UPDATE_TOKEN, {
        id: token.id,
        hp: { current: hpCurrent.value, max: hpMax.value },
        statusEffects: checkboxes.filter((cb) => cb.checked).map((cb) => cb.value),
      });
    });
    editor.appendChild(saveBtn);

    if (token.owner) {
      const rosterEntry = clientState.dmRoster.find((r) => r.username === token.owner);
      if (rosterEntry) {
        editor.appendChild(TokenEditorView.#buildLinkedCharacterSummary(rosterEntry.username, rosterEntry.character));
      } else {
        const offline = document.createElement("p");
        offline.className = "hint";
        offline.textContent = `${token.owner} isn't online — their character sheet isn't available right now.`;
        editor.appendChild(offline);
      }
    }

    return editor;
  }

  static #buildLinkedCharacterSummary(username, character) {
    const box = document.createElement("div");
    box.className = "token-editor-character";

    const title = document.createElement("div");
    title.className = "char-sheet-meta";
    title.textContent = `Linked character (${username})`;
    box.appendChild(title);

    const line = document.createElement("div");
    line.innerHTML = `<strong>${character.name}</strong> — AC ${character.ac} · HP ${character.hp.current}/${character.hp.max}`;
    box.appendChild(line);

    const editCharBtn = document.createElement("button");
    editCharBtn.className = "secondary-btn";
    editCharBtn.textContent = "Edit Character Sheet";
    editCharBtn.addEventListener("click", () => openCharacterModal(character, "edit-as-dm", username));
    box.appendChild(editCharBtn);

    return box;
  }
}

const tokenEditorView = new TokenEditorView();

// Thin facade preserving the module's prior function-based API, so
// dmPanelView.js (which imports this by name) doesn't need to switch to
// calling a method on the `tokenEditorView` instance directly.
export function buildTokenListItem(token) {
  return tokenEditorView.buildTokenListItem(token);
}
