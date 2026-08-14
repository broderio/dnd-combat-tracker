// public/js/views/joinView.js
//
// Step 1: mode tabs (Player / DM) and the login / DM-name form.

import { login } from '../api.js';
import { joinTable } from '../socketClient.js';
import { setSession, setCurrentUsername, setCurrentCharacters } from '../state.js';
import { showCharacterSelectScreen } from './characterSelectView.js';

const tabPlayer = document.getElementById('tab-player');
const tabDM = document.getElementById('tab-dm');
const playerForm = document.getElementById('player-form');
const dmForm = document.getElementById('dm-form');
const playerLoginError = document.getElementById('player-login-error');

tabPlayer.addEventListener('click', () => {
  tabPlayer.classList.add('active');
  tabDM.classList.remove('active');
  playerForm.classList.remove('hidden');
  dmForm.classList.add('hidden');
});
tabDM.addEventListener('click', () => {
  tabDM.classList.add('active');
  tabPlayer.classList.remove('active');
  dmForm.classList.remove('hidden');
  playerForm.classList.add('hidden');
});

document.getElementById('join-player-btn').addEventListener('click', async () => {
  const username = document.getElementById('player-username').value.trim();
  const pin = document.getElementById('player-pin').value.trim();
  playerLoginError.classList.add('hidden');

  if (!username || !pin) {
    playerLoginError.textContent = 'Enter a username and PIN.';
    playerLoginError.classList.remove('hidden');
    return;
  }

  try {
    const data = await login(username, pin);
    if (!data.ok) {
      playerLoginError.textContent = data.error || 'Login failed.';
      playerLoginError.classList.remove('hidden');
      return;
    }

    setCurrentUsername(data.username);
    setCurrentCharacters(data.characters);
    showCharacterSelectScreen();
  } catch (err) {
    playerLoginError.textContent = 'Could not reach the server. Is it running?';
    playerLoginError.classList.remove('hidden');
  }
});

document.getElementById('join-dm-btn').addEventListener('click', () => {
  const name = document.getElementById('dm-name').value.trim() || 'DM';
  setSession('dm', name);
  joinTable({ mode: 'dm', name });
});
