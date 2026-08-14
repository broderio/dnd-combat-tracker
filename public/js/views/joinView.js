// public/js/views/joinView.js
//
// Step 1: mode tabs (Player / DM) and the login / DM-name form. No local
// state of its own beyond the DOM (everything it needs lives in
// `clientState`), so this stays a plain set of DOM-wiring functions rather
// than a class.

import { ApiClient } from "../api.js";
import { socketClient } from "../socketClient.js";
import { clientState } from "../state.js";

import { showCharacterSelectScreen } from "./characterSelectView.js";

const tabPlayer = document.getElementById("tab-player");
const tabDM = document.getElementById("tab-dm");
const playerForm = document.getElementById("player-form");
const dmForm = document.getElementById("dm-form");
const playerLoginError = document.getElementById("player-login-error");

tabPlayer.addEventListener("click", () => {
  tabPlayer.classList.add("active");
  tabDM.classList.remove("active");
  playerForm.classList.remove("hidden");
  dmForm.classList.add("hidden");
});
tabDM.addEventListener("click", () => {
  tabDM.classList.add("active");
  tabPlayer.classList.remove("active");
  dmForm.classList.remove("hidden");
  playerForm.classList.add("hidden");
});

document.getElementById("join-player-btn").addEventListener("click", async () => {
  const username = document.getElementById("player-username").value.trim();
  const pin = document.getElementById("player-pin").value.trim();
  playerLoginError.classList.add("hidden");

  if (!username || !pin) {
    playerLoginError.textContent = "Enter a username and PIN.";
    playerLoginError.classList.remove("hidden");
    return;
  }

  try {
    const data = await ApiClient.login(username, pin);
    if (!data.ok) {
      playerLoginError.textContent = data.error || "Login failed.";
      playerLoginError.classList.remove("hidden");
      return;
    }

    clientState.setCurrentUsername(data.username);
    clientState.setCurrentCharacters(data.characters);
    showCharacterSelectScreen();
  } catch (err) {
    playerLoginError.textContent = "Could not reach the server. Is it running?";
    playerLoginError.classList.remove("hidden");
  }
});

document.getElementById("join-dm-btn").addEventListener("click", () => {
  const name = document.getElementById("dm-name").value.trim() || "DM";
  clientState.setSession("dm", name);
  socketClient.joinTable({ mode: "dm", name });
});

