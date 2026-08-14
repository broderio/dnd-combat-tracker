// Loaded as a native ES module (see index.html's `type="module"` script tag),
// so `import`/`export` work directly in the browser with no build step. ES
// modules also give each file its own private scope automatically, so we no
// longer need the old `(() => { ... })()` IIFE trick to avoid leaking
// variables onto `window`.
import { EVENTS } from '/shared/protocol.js';
import { defaultGrid } from '/shared/schema.js';

const socket = io();

let session = { mode: null, name: null };
let state = { background: null, grid: defaultGrid(), tokens: {} };
let draggingId = null;

  let currentUsername = null;      // set after successful login
  let currentCharacters = [];      // this user's saved characters (from login / CRUD responses)
  let activeCharacter = null;      // the character this player picked for this session
  let onlinePlayers = [];          // [{username, characterName}] — public, no stats
  let dmRoster = [];                // [{username, character}] — full stats, DM only

  let editingContext = null;       // 'create-and-play' | 'edit-in-list' | 'edit-in-game'
  let editingCharacterId = null;

  // Remembers the payload used for the last successful 'join' so we can silently re-send it
  // if the socket ever drops and Socket.IO auto-reconnects (e.g. WiFi blip, laptop sleep).
  // Without this, a reconnect creates a fresh, un-joined socket on the server: the DM loses
  // that player from their roster, and the player's own moves stop being accepted, because
  // server-side permission checks depend on session data set during 'join'.
  let lastJoinPayload = null;

  socket.on('connect', () => {
    if (lastJoinPayload) {
      socket.emit(EVENTS.JOIN, lastJoinPayload);
    }
  });

  socket.on('disconnect', () => {
    presenceLog.textContent = 'Connection lost — attempting to reconnect…';
  });

  // ---------- Elements ----------
  const joinScreen = document.getElementById('join-screen');
  const characterSelectScreen = document.getElementById('character-select-screen');
  const gameScreen = document.getElementById('game-screen');

  const tabPlayer = document.getElementById('tab-player');
  const tabDM = document.getElementById('tab-dm');
  const playerForm = document.getElementById('player-form');
  const dmForm = document.getElementById('dm-form');
  const playerLoginError = document.getElementById('player-login-error');

  const csUsername = document.getElementById('cs-username');
  const characterSelectList = document.getElementById('character-select-list');
  const noCharactersMsg = document.getElementById('no-characters-msg');
  const createCharacterBtn = document.getElementById('create-character-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const characterModal = document.getElementById('character-modal');
  const characterModalTitle = document.getElementById('character-modal-title');
  const cfCancelBtn = document.getElementById('cf-cancel-btn');
  const cfSaveBtn = document.getElementById('cf-save-btn');

  const roleBadge = document.getElementById('role-badge');
  const presenceLog = document.getElementById('presence-log');
  const dmPanel = document.getElementById('dm-panel');
  const boardHint = document.getElementById('board-hint');

  const board = document.getElementById('board');
  const backgroundLayer = document.getElementById('background-layer');
  const gridLayer = document.getElementById('grid-layer');
  const tokenLayer = document.getElementById('token-layer');

  const uploadForm = document.getElementById('upload-form');
  const backgroundInput = document.getElementById('background-input');
  const gridCols = document.getElementById('grid-cols');
  const gridRows = document.getElementById('grid-rows');
  const gridCellSize = document.getElementById('grid-cellsize');
  const gridVisible = document.getElementById('grid-visible');
  const applyGridBtn = document.getElementById('apply-grid-btn');

  const tokenName = document.getElementById('token-name');
  const tokenColor = document.getElementById('token-color');
  const tokenOwner = document.getElementById('token-owner');
  const addTokenBtn = document.getElementById('add-token-btn');
  const generatePlayerTokensBtn = document.getElementById('generate-player-tokens-btn');
  const tokenList = document.getElementById('token-list');

  const charSidebarTitle = document.getElementById('char-sidebar-title');
  const ownCharacterView = document.getElementById('own-character-view');
  const allCharactersView = document.getElementById('all-characters-view');

  // ================= Join screen: mode tabs =================
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

  // ================= Player login =================
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
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await res.json();
      if (!data.ok) {
        playerLoginError.textContent = data.error || 'Login failed.';
        playerLoginError.classList.remove('hidden');
        return;
      }

      currentUsername = data.username;
      currentCharacters = data.characters;
      showCharacterSelectScreen();
    } catch (err) {
      playerLoginError.textContent = 'Could not reach the server. Is it running?';
      playerLoginError.classList.remove('hidden');
    }
  });

  document.getElementById('join-dm-btn').addEventListener('click', () => {
    const name = document.getElementById('dm-name').value.trim() || 'DM';
    session = { mode: 'dm', name };
    lastJoinPayload = { mode: 'dm', name };
    socket.emit(EVENTS.JOIN, lastJoinPayload);
  });

  logoutBtn.addEventListener('click', () => {
    currentUsername = null;
    currentCharacters = [];
    characterSelectScreen.classList.add('hidden');
    joinScreen.classList.remove('hidden');
    document.getElementById('player-pin').value = '';
  });

  // ================= Character select screen =================
  function showCharacterSelectScreen() {
    joinScreen.classList.add('hidden');
    characterSelectScreen.classList.remove('hidden');
    csUsername.textContent = currentUsername;
    renderCharacterSelectList();
  }

  function renderCharacterSelectList() {
    characterSelectList.innerHTML = '';
    noCharactersMsg.classList.toggle('hidden', currentCharacters.length > 0);

    currentCharacters.forEach((c) => {
      const li = document.createElement('li');

      const info = document.createElement('div');
      info.className = 'char-card-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'char-card-name';
      nameEl.textContent = c.name;
      const metaEl = document.createElement('div');
      metaEl.className = 'char-card-meta';
      metaEl.textContent = `Level ${c.level} ${c.race ? c.race + ' ' : ''}${c.class || ''} · HP ${c.hp.current}/${c.hp.max} · AC ${c.ac}`;
      info.append(nameEl, metaEl);

      const actions = document.createElement('div');
      actions.className = 'char-card-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'play-btn';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => joinAsPlayer(c));

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openCharacterModal(c, 'edit-in-list'));

      actions.append(playBtn, editBtn);
      li.append(info, actions);
      characterSelectList.appendChild(li);
    });
  }

  createCharacterBtn.addEventListener('click', () => openCharacterModal(null, 'create-and-play'));

  function joinAsPlayer(character) {
    activeCharacter = character;
    session = { mode: 'player', name: currentUsername };
    lastJoinPayload = { mode: 'player', name: currentUsername, characterId: character.id };
    socket.emit(EVENTS.JOIN, lastJoinPayload);
  }

  // ================= Character modal (create/edit) =================
  function openCharacterModal(character, context) {
    editingContext = context;
    editingCharacterId = character ? character.id : null;
    characterModalTitle.textContent = character ? `Edit ${character.name}` : 'New Character';

    const c = character || {
      name: '', class: '', race: '', level: 1, ac: 10,
      hp: { current: 10, max: 10 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      notes: '',
      tokenColor: '#e63946'
    };

    document.getElementById('cf-name').value = c.name;
    document.getElementById('cf-class').value = c.class;
    document.getElementById('cf-race').value = c.race;
    document.getElementById('cf-level').value = c.level;
    document.getElementById('cf-ac').value = c.ac;
    document.getElementById('cf-hp-current').value = c.hp.current;
    document.getElementById('cf-hp-max').value = c.hp.max;
    document.getElementById('cf-str').value = c.abilityScores.str;
    document.getElementById('cf-dex').value = c.abilityScores.dex;
    document.getElementById('cf-con').value = c.abilityScores.con;
    document.getElementById('cf-int').value = c.abilityScores.int;
    document.getElementById('cf-wis').value = c.abilityScores.wis;
    document.getElementById('cf-cha').value = c.abilityScores.cha;
    document.getElementById('cf-notes').value = c.notes || '';
    document.getElementById('cf-token-color').value = c.tokenColor || '#e63946';

    characterModal.classList.remove('hidden');
  }

  cfCancelBtn.addEventListener('click', () => characterModal.classList.add('hidden'));

  cfSaveBtn.addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('cf-name').value.trim() || 'Unnamed',
      class: document.getElementById('cf-class').value.trim(),
      race: document.getElementById('cf-race').value.trim(),
      level: document.getElementById('cf-level').value,
      ac: document.getElementById('cf-ac').value,
      hp: {
        current: document.getElementById('cf-hp-current').value,
        max: document.getElementById('cf-hp-max').value
      },
      abilityScores: {
        str: document.getElementById('cf-str').value,
        dex: document.getElementById('cf-dex').value,
        con: document.getElementById('cf-con').value,
        int: document.getElementById('cf-int').value,
        wis: document.getElementById('cf-wis').value,
        cha: document.getElementById('cf-cha').value
      },
      notes: document.getElementById('cf-notes').value,
      tokenColor: document.getElementById('cf-token-color').value
    };

    try {
      let data;
      if (editingCharacterId) {
        const res = await fetch(`/api/characters/${encodeURIComponent(currentUsername)}/${editingCharacterId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      } else {
        const res = await fetch(`/api/characters/${encodeURIComponent(currentUsername)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      }

      if (!data.ok) { alert(data.error || 'Could not save character.'); return; }

      currentCharacters = data.characters;
      characterModal.classList.add('hidden');

      if (editingContext === 'create-and-play') {
        joinAsPlayer(data.character);
      } else if (editingContext === 'edit-in-list') {
        renderCharacterSelectList();
      } else if (editingContext === 'edit-in-game') {
        activeCharacter = data.character;
        renderOwnCharacterView();
      }
    } catch (err) {
      alert('Could not reach the server.');
    }
  });

  // ================= Socket: joined / presence / state =================
  socket.on(EVENTS.JOINED, ({ mode, name }) => {
    if (lastJoinPayload) presenceLog.textContent = 'Connected.';
    joinScreen.classList.add('hidden');
    characterSelectScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    roleBadge.textContent = mode === 'dm' ? `DM · ${name}` : `Player · ${name}`;

    if (mode === 'dm') {
      dmPanel.classList.remove('hidden');
      boardHint.classList.add('hidden');
      charSidebarTitle.textContent = 'All Characters';
      ownCharacterView.classList.add('hidden');
      allCharactersView.classList.remove('hidden');
    } else {
      dmPanel.classList.add('hidden');
      boardHint.classList.remove('hidden');
      charSidebarTitle.textContent = 'Character Sheet';
      ownCharacterView.classList.remove('hidden');
      allCharactersView.classList.add('hidden');
      renderOwnCharacterView();
    }
  });

  socket.on(EVENTS.PRESENCE, ({ message }) => {
    presenceLog.textContent = message;
  });

  socket.on(EVENTS.YOUR_CHARACTER, (character) => {
    activeCharacter = character;
    renderOwnCharacterView();
  });

  socket.on(EVENTS.ALL_CHARACTERS, (roster) => {
    dmRoster = roster;
    renderDMRoster();
  });

  socket.on(EVENTS.PLAYERS_ONLINE, (list) => {
    onlinePlayers = list;
    renderOwnerDropdown();
  });

  // ---------- State sync (board/grid/tokens) ----------
  socket.on(EVENTS.STATE, (newState) => {
    state = newState;
    render();
    syncGridFormFromState();
  });

  socket.on(EVENTS.TOKEN_MOVED, ({ id, col, row }) => {
    if (!state.tokens[id]) return;
    state.tokens[id].col = col;
    state.tokens[id].row = row;
    positionToken(id);
  });

  function syncGridFormFromState() {
    if (document.activeElement && ['grid-cols','grid-rows','grid-cellsize'].includes(document.activeElement.id)) return;
    gridCols.value = state.grid.cols;
    gridRows.value = state.grid.rows;
    gridCellSize.value = state.grid.cellSize;
    gridVisible.checked = state.grid.visible;
  }

  // ================= Character sidebar rendering =================
  function abilityMod(score) {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function hpBarClass(current, max) {
    if (max <= 0) return '';
    const pct = current / max;
    if (pct <= 0.25) return 'critical';
    if (pct <= 0.5) return 'hurt';
    return '';
  }

  function buildCharacterCard(character, { showEditButton }) {
    const card = document.createElement('div');
    card.className = 'char-sheet-card';

    const name = document.createElement('div');
    name.className = 'char-sheet-name';
    name.textContent = character.name;

    const meta = document.createElement('div');
    meta.className = 'char-sheet-meta';
    meta.textContent = `Level ${character.level} ${character.race ? character.race + ' ' : ''}${character.class || ''}`;

    const stats = document.createElement('div');
    stats.className = 'char-sheet-stats';
    stats.innerHTML = `<div>AC <strong>${character.ac}</strong></div><div>HP <strong>${character.hp.current}/${character.hp.max}</strong></div>`;

    const hpTrack = document.createElement('div');
    hpTrack.className = 'hp-bar-track';
    const hpFill = document.createElement('div');
    const pct = character.hp.max > 0 ? Math.max(0, Math.min(100, (character.hp.current / character.hp.max) * 100)) : 0;
    hpFill.className = 'hp-bar-fill ' + hpBarClass(character.hp.current, character.hp.max);
    hpFill.style.width = pct + '%';
    hpTrack.appendChild(hpFill);

    const abilities = document.createElement('div');
    abilities.className = 'char-sheet-abilities';
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((key) => {
      const score = character.abilityScores[key];
      const pill = document.createElement('div');
      pill.className = 'ability-pill';
      pill.innerHTML = `${key.toUpperCase()}<span class="val">${score}</span>${abilityMod(score)}`;
      abilities.appendChild(pill);
    });

    card.append(name, meta, stats, hpTrack, abilities);

    if (character.notes) {
      const notes = document.createElement('div');
      notes.className = 'char-sheet-notes';
      notes.textContent = character.notes;
      card.appendChild(notes);
    }

    if (showEditButton) {
      const editBtn = document.createElement('button');
      editBtn.className = 'char-sheet-edit-btn';
      editBtn.textContent = 'Edit Character Sheet';
      editBtn.addEventListener('click', () => openCharacterModal(character, 'edit-in-game'));
      card.appendChild(editBtn);
    }

    return card;
  }

  function renderOwnCharacterView() {
    ownCharacterView.innerHTML = '';
    if (!activeCharacter) return;
    ownCharacterView.appendChild(buildCharacterCard(activeCharacter, { showEditButton: true }));
  }

  function renderDMRoster() {
    allCharactersView.innerHTML = '';
    if (dmRoster.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dm-roster-empty';
      empty.textContent = 'No players online yet.';
      allCharactersView.appendChild(empty);
      return;
    }
    dmRoster.forEach(({ username, character }) => {
      const label = document.createElement('div');
      label.className = 'char-sheet-meta';
      label.style.marginBottom = '4px';
      label.textContent = `Played by ${username}`;
      allCharactersView.appendChild(label);
      allCharactersView.appendChild(buildCharacterCard(character, { showEditButton: false }));
    });
  }

  // ================= Owner dropdown (DM's Add Token form) =================
  function renderOwnerDropdown() {
    const currentValue = tokenOwner.value;
    tokenOwner.innerHTML = '<option value="">None (DM-controlled)</option>';
    onlinePlayers.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.username;
      opt.textContent = p.characterName ? `${p.username} — ${p.characterName}` : p.username;
      tokenOwner.appendChild(opt);
    });
    // Preserve the DM's current selection if that player is still online.
    if (Array.from(tokenOwner.options).some((o) => o.value === currentValue)) {
      tokenOwner.value = currentValue;
    }
  }

  // ================= Board rendering ================= (unchanged from POC)
  function render() {
    const w = state.grid.cols * state.grid.cellSize;
    const h = state.grid.rows * state.grid.cellSize;
    board.style.width = w + 'px';
    board.style.height = h + 'px';

    board.style.backgroundImage = state.background ? `url(${state.background})` : 'none';

    renderGrid(w, h);
    renderTokens();
    renderTokenList();
  }

  function renderGrid(w, h) {
    gridLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
    gridLayer.innerHTML = '';

    const showLines = session.mode === 'dm' || state.grid.visible;
    if (!showLines) return;

    for (let c = 0; c <= state.grid.cols; c++) {
      const x = c * state.grid.cellSize;
      gridLayer.appendChild(svgLine(x, 0, x, h));
    }
    for (let r = 0; r <= state.grid.rows; r++) {
      const y = r * state.grid.cellSize;
      gridLayer.appendChild(svgLine(0, y, w, y));
    }
  }

  function svgLine(x1, y1, x2, y2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    return line;
  }

  function renderTokens() {
    tokenLayer.innerHTML = '';
    Object.values(state.tokens).forEach((token) => {
      const el = document.createElement('div');
      el.className = 'token';
      el.dataset.id = token.id;
      const size = state.grid.cellSize - 6;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.background = token.color;
      el.textContent = initials(token.name);
      el.title = token.owner ? `${token.name} (controlled by ${token.owner})` : `${token.name} (DM-controlled)`;

      const canDrag = session.mode === 'dm' ||
        (token.owner && token.owner.toLowerCase() === session.name.toLowerCase());
      el.classList.add(canDrag ? 'draggable' : 'locked');
      if (canDrag) attachDrag(el, token.id);

      tokenLayer.appendChild(el);
      positionToken(token.id);
    });
  }

  function positionToken(id) {
    const token = state.tokens[id];
    const el = tokenLayer.querySelector(`[data-id="${id}"]`);
    if (!token || !el) return;
    const size = state.grid.cellSize - 6;
    const x = token.col * state.grid.cellSize + (state.grid.cellSize - size) / 2;
    const y = token.row * state.grid.cellSize + (state.grid.cellSize - size) / 2;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function updateTokenColor(tokenId, newColor) {
    const token = state.tokens[tokenId];
    if (!token) return;
    token.color = newColor;
    const el = tokenLayer.querySelector(`[data-id="${tokenId}"]`);
    if (el) el.style.background = newColor;
  }

  function initials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  }

  function renderTokenList() {
    if (session.mode !== 'dm') return;
    tokenList.innerHTML = '';
    Object.values(state.tokens).forEach((token) => {
      const li = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = token.color;

      const meta = document.createElement('span');
      meta.className = 'tok-meta';
      meta.textContent = `${token.name} — ${token.owner || 'DM-controlled'}`;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => socket.emit(EVENTS.REMOVE_TOKEN, token.id));

      li.append(swatch, meta, removeBtn);
      tokenList.appendChild(li);
    });
  }

  // ---------- Dragging ----------
  function attachDrag(el, id) {
    el.addEventListener('pointerdown', (e) => {
      draggingId = id;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (draggingId !== id) return;
      const rect = board.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = state.grid.cellSize - 6;
      el.style.left = clamp(x - size / 2, 0, board.clientWidth - size) + 'px';
      el.style.top = clamp(y - size / 2, 0, board.clientHeight - size) + 'px';
    });

    el.addEventListener('pointerup', (e) => {
      if (draggingId !== id) return;
      draggingId = null;
      el.classList.remove('dragging');

      const rect = board.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = clamp(Math.floor(x / state.grid.cellSize), 0, state.grid.cols - 1);
      const row = clamp(Math.floor(y / state.grid.cellSize), 0, state.grid.rows - 1);

      socket.emit(EVENTS.MOVE_TOKEN, { id, col, row });
      state.tokens[id].col = col;
      state.tokens[id].row = row;
      positionToken(id);
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ================= DM panel actions =================
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!backgroundInput.files[0]) return;
    const fd = new FormData();
    fd.append('background', backgroundInput.files[0]);
    await fetch('/upload-background', { method: 'POST', body: fd });
  });

  applyGridBtn.addEventListener('click', () => {
    socket.emit(EVENTS.SET_GRID, {
      cols: gridCols.value,
      rows: gridRows.value,
      cellSize: gridCellSize.value,
      visible: gridVisible.checked
    });
  });

  addTokenBtn.addEventListener('click', () => {
    const name = tokenName.value.trim();
    if (!name) { alert('Give the token a name.'); return; }
    socket.emit(EVENTS.ADD_TOKEN, {
      name,
      color: tokenColor.value,
      owner: tokenOwner.value || null,
      col: Math.floor(state.grid.cols / 2),
      row: Math.floor(state.grid.rows / 2)
    });
    tokenName.value = '';
    tokenOwner.value = '';
  });

  generatePlayerTokensBtn.addEventListener('click', () => {
    // Generate a token for each online player who doesn't already have one. Use the tokenColor from their character in the roster.
    onlinePlayers.forEach((p) => {
      if (!p.characterName) return; // skip players without a character
      const alreadyHasToken = Object.values(state.tokens).some((t) => t.owner === p.username);
      if (alreadyHasToken) return;

      const rosterEntry = dmRoster.find((r) => r.username === p.username);
      const color = rosterEntry ? rosterEntry.character.tokenColor : '#e63946';

      socket.emit(EVENTS.ADD_TOKEN, {
        name: p.characterName,
        color,
        owner: p.username,
        col: Math.floor(state.grid.cols / 2),
        row: Math.floor(state.grid.rows / 2)
      });
    });
  });
