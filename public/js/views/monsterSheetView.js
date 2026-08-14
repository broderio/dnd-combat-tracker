// public/js/views/monsterSheetView.js
//
// DM-only "Monsters" sidebar (next to "All Characters"): one card per placed
// MonsterInstance with the combat-relevant stats a DM actually needs mid-
// fight — AC, speed, HP (current + editable max) with quick-edit, status
// effects, and its attacks list — mirroring characterSheetView.js's card
// pattern but for monsters instead of PCs.

import { EVENTS } from "/shared/protocol.js";

import { socketClient } from "../socketClient.js";
import { clientState } from "../state.js";

import { buildQuickEditControls } from "./quickEditControls.js";

const monstersView = document.getElementById("monsters-view");

function hpBarClass(current, max) {
  if (max <= 0) return "";
  const pct = current / max;
  if (pct <= 0.25) return "critical";
  if (pct <= 0.5) return "hurt";
  return "";
}

function buildAttacksList(attacks) {
  const list = document.createElement("ul");
  list.className = "monster-attacks-list";
  (attacks || []).forEach((attack) => {
    const li = document.createElement("li");
    const parts = [attack.name];
    if (attack.toHit) parts.push(`${attack.toHit} to hit`);
    if (attack.damage) parts.push(attack.damage + (attack.damageType ? ` ${attack.damageType}` : ""));
    li.textContent = parts.join(" · ");
    list.appendChild(li);
  });
  return list;
}

function buildMonsterCard(instance) {
  const card = document.createElement("div");
  card.className = "char-sheet-card";

  const name = document.createElement("div");
  name.className = "char-sheet-name";
  name.textContent = instance.name;

  const meta = document.createElement("div");
  meta.className = "char-sheet-meta";
  const crText = instance.cr === null || instance.cr === undefined ? "?" : instance.cr;
  meta.textContent = `${instance.size || ""} ${instance.type || ""} · CR ${crText}`.trim();

  const stats = document.createElement("div");
  stats.className = "char-sheet-stats";
  stats.innerHTML = `<div>AC <strong>${instance.ac}</strong></div><div>Speed <strong>${
    instance.speed || "—"
  }</strong></div>`;

  const hpTrack = document.createElement("div");
  hpTrack.className = "hp-bar-track";
  const hpFill = document.createElement("div");
  const pct = instance.hp.max > 0 ? Math.max(0, Math.min(100, (instance.hp.current / instance.hp.max) * 100)) : 0;
  hpFill.className = "hp-bar-fill " + hpBarClass(instance.hp.current, instance.hp.max);
  hpFill.style.width = pct + "%";
  hpTrack.appendChild(hpFill);

  card.append(name, meta, stats, hpTrack);

  card.appendChild(
    buildQuickEditControls(instance.hp, instance.statusEffects, {
      onAdjustHp: (delta) => {
        const next = Math.max(-9999, Math.min(9999, instance.hp.current + delta));
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { current: next } });
      },
      onSetMaxHp: (max) => {
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { max } });
      },
      onToggleEffect: (effect, checked) => {
        const current = new Set(instance.statusEffects || []);
        if (checked) current.add(effect);
        else current.delete(effect);
        socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, {
          id: instance.id,
          statusEffects: Array.from(current),
        });
      },
    })
  );

  if (instance.attacks && instance.attacks.length) {
    card.appendChild(buildAttacksList(instance.attacks));
  }

  return card;
}

/** Renders every placed monster instance into the Monsters sidebar — DM-only, a no-op for players. */
export function renderMonsterSidebar() {
  if (clientState.session.mode !== "dm") return;
  monstersView.innerHTML = "";
  const instances = Object.values(clientState.dmMonsterInstances);
  if (instances.length === 0) return;
  instances.forEach((instance) => monstersView.appendChild(buildMonsterCard(instance)));
}
