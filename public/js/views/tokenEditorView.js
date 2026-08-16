// public/js/views/tokenEditorView.js
//
// Builds each row of the DM's token list (dmPanelView.js's #token-list).
// Tokens are a read-only projection now (see ARCHITECTURE.md's "Single
// source of truth" section) — there is no more per-token HP/status editor
// here. If a token is linked to a character (`combatantId`), that's shown as
// a label only; editing HP/status happens in the "All Characters" sidebar
// (see characterSheetView.js's quick-edit controls) or, for monsters, the
// "Monsters" sidebar (see monsterSheetView.js) — not here.

import { EVENTS } from '/shared/protocol.js';

import { socketClient } from '../socketClient.js';

import { monsterBadgeLabel } from './monsterSheetView.js';

class TokenEditorView {
  /** Builds one `<li>` for the DM's token list. */
  buildTokenListItem(token) {
    const li = document.createElement('li');
    li.className = 'token-list-item';

    const row = document.createElement('div');
    row.className = 'token-list-row';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = token.color;

    const meta = document.createElement('span');
    meta.className = 'tok-meta';
    let linkText = '';
    if (token.combatantId) {
      linkText =
        token.combatantType === 'monster' ? ` (Monsters ${monsterBadgeLabel(token.combatantId)})` : ' (All Characters)';
    }
    meta.textContent = `${token.name} — ${token.owner || 'DM-controlled'}${linkText}`;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => socketClient.emitEvent(EVENTS.REMOVE_TOKEN, token.id));

    row.append(swatch, meta, removeBtn);
    li.appendChild(row);

    return li;
  }
}

const tokenEditorView = new TokenEditorView();

// Thin facade preserving the module's prior function-based API, so
// dmPanelView.js (which imports this by name) doesn't need to switch to
// calling a method on the `tokenEditorView` instance directly.
export function buildTokenListItem(token) {
  return tokenEditorView.buildTokenListItem(token);
}
