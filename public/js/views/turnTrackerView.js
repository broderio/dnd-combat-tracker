// public/js/views/turnTrackerView.js
//
// Initiative/turn-order tracker: the DM sets each token's initiative and
// advances turns; everyone (DM and players) sees a "Round N — X's turn"
// banner. Like grid/tokens/overlays, the turn order lives on the server's
// broadcast `state` — this module only renders it and sends the two DM
// actions (SET_TURN_ORDER, NEXT_TURN).

import { EVENTS } from "/shared/protocol.js";

import { emitEvent } from "../socketClient.js";
import { board, session } from "../state.js";

const initiativeList = document.getElementById("initiative-list");
const setTurnOrderBtn = document.getElementById("set-turn-order-btn");
const nextTurnBtn = document.getElementById("next-turn-btn");
const turnBanner = document.getElementById("turn-banner");

/** DM-only: one row per token with an initiative number input, prefilled from the current order (if any). */
export function renderInitiativeList() {
  if (session.mode !== "dm") return;
  initiativeList.innerHTML = "";
  const existingByToken = new Map((board.turnOrder.combatants || []).map((c) => [c.tokenId, c.initiative]));

  Object.values(board.tokens).forEach((token) => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.className = "tok-meta";
    label.textContent = token.name;

    const input = document.createElement("input");
    input.type = "number";
    input.dataset.tokenId = token.id;
    input.value = existingByToken.has(token.id) ? existingByToken.get(token.id) : 0;

    li.append(label, input);
    initiativeList.appendChild(li);
  });
}

setTurnOrderBtn.addEventListener("click", () => {
  const combatants = Array.from(initiativeList.querySelectorAll("input[data-token-id]")).map((input) => ({
    tokenId: input.dataset.tokenId,
    initiative: input.value,
  }));
  emitEvent(EVENTS.SET_TURN_ORDER, combatants);
});

nextTurnBtn.addEventListener("click", () => emitEvent(EVENTS.NEXT_TURN));

/** The "whose turn is it" banner — rendered for everyone, DM and players alike. */
export function renderTurnBanner() {
  const order = board.turnOrder;
  if (!order || !order.combatants.length || order.currentIndex < 0) {
    turnBanner.textContent = "";
    turnBanner.classList.add("hidden");
    return;
  }
  const current = order.combatants[order.currentIndex];
  const token = board.tokens[current.tokenId];
  turnBanner.textContent = `Round ${order.round} — ${token ? token.name : "Unknown"}'s turn`;
  turnBanner.classList.remove("hidden");
}
