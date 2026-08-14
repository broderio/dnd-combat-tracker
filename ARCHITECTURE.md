# Architecture

This document describes how the codebase is organized and _why_. It's aimed at
someone with a strong backend/Python background but limited front-end experience,
so it spells out browser-specific idioms that a JS-focused doc would take for granted.

> Status: **AS-BUILT** for everything through the three original refactor
> stages and all three phases of the pre-session encounter builder (see "Verification
> results" and "Pre-session encounter builder" below). Phases 2–3 of the
> encounter builder are **DESIGNED, NOT YET BUILT** — see that section for
> the plan.

## Guiding idea

There is exactly **one place** each "concept" is defined:

| Concept                                                          | Defined once in      |
| ---------------------------------------------------------------- | -------------------- |
| What fields a Character/Token/Grid has, and how to validate them | `shared/schema.js`   |
| What socket events exist and what payload shape each one carries | `shared/protocol.js` |
| Who is allowed to do what (move this token, edit that character) | `server/policy.js`   |
| How data is read/written to disk                                 | `server/db.js`       |

Both the server and the browser client load `shared/schema.js` and
`shared/protocol.js` **as literally the same file**, both via plain ES module
`import` — no code generation, no build step, no dual CommonJS/ESM format to keep
in sync. Concretely: `package.json` has `"type": "module"`, so every `.js` file
in the whole repo (server and client alike) uses `import`/`export` instead of
`require()`/`module.exports`. The browser side loads the same files by fetching
them from a `/shared/*.js` static route that `server.js` exposes (see below) and
importing them with an absolute path (`import { EVENTS } from '/shared/protocol.js'`).

### Why not a frontend framework or bundler?

Considered and rejected for this project:

- **React/Vue etc.**: would genuinely help with the "state → DOM" sync problem the
  client has, but it's a new mental model on top of an already-unfamiliar area
  (front-end), plus a build step. Not worth it for ~600 lines split across a
  handful of focused modules.
- **Webpack/Vite/esbuild**: their main value here would be `import` support in
  _older_ browsers and bundling for production performance. This app is loaded by
  a handful of people on a LAN/tunnel, not the public internet, so load
  performance is irrelevant, and all modern browsers (2021+) support native ES
  modules directly. So: no build step needed.

Net effect: browser native `<script type="module" src="...">` + `import`/`export`
gets us real file-per-responsibility separation with **zero new tooling** — you
still just run `npm start` and open the page.

## File structure (as built)

```
dnd-tracker/
├── server.js                  # thin: wires Express + Socket.io, delegates to server/*
├── package.json                # "type": "module" — the whole repo uses ES modules
├── ARCHITECTURE.md
├── data/
│   └── db.json
├── shared/                     # loaded by BOTH server (import) and browser (<script type=module>)
│   ├── schema.js               # Character/Token/Grid field defs, defaults, validation/clamping
│   └── protocol.js             # socket.io EVENTS constants + JSDoc payload shapes
├── server/
│   ├── db.js                   # persistence: load/save data/db.json + character id generation
│   ├── policy.js               # isDM, isOwnerOfToken, canMoveToken, canManageBoard
│   ├── gameState.js            # in-memory board state (background/grid/tokens) + mutators
│   ├── rosterStore.js          # activePlayers map + online-roster broadcast helpers
│   ├── routes/
│   │   ├── auth.js             # POST /api/login
│   │   ├── characters.js       # GET/POST/PUT/DELETE /api/characters/*, GET /api/all-characters
│   │   └── background.js       # POST /upload-background
│   └── socketHandlers/
│       ├── index.js            # registers all handlers on `io.on('connection', ...)`
│       ├── joinHandler.js      # 'join' event + disconnect + reconnect bookkeeping
│       ├── gridHandler.js      # 'set-grid'
│       └── tokenHandlers.js    # 'add-token' / 'remove-token' / 'move-token'
└── public/
    ├── index.html               # script tag: <script type="module" src="js/main.js">
    ├── style.css                # unchanged
    ├── uploads/
    └── js/
        ├── main.js               # entry point: imports every view module, wires the game-screen shell
        ├── socketClient.js       # wraps `io()`, exposes onEvent/emitEvent/joinTable using shared/protocol.js
        ├── state.js              # small in-memory client "store" (session, board, roster, etc.)
        ├── api.js                # fetch() wrappers for the REST endpoints
        └── views/
            ├── joinView.js               # mode tabs + player login + DM join
            ├── characterSelectView.js    # pick/create a character; owns joinAsPlayer()
            ├── characterModalView.js     # create/edit character form (reads shared/schema.js field list)
            ├── characterSheetView.js     # sidebar: own character card + DM roster cards
            ├── boardView.js              # background/grid/token rendering + drag-and-drop
            └── dmPanelView.js            # DM-only controls: upload, grid form, token add/remove/list
```

### Note on the old root `db.js` and `public/client.js`

Both were fully deleted, not kept as compatibility shims: `server.js` now imports
directly from `server/db.js`, and `index.html` loads `js/main.js` instead of
`client.js`. Nothing else in the repo referenced either file by its old path, so no
shim was needed.

## What lives where (server)

- **`shared/schema.js`**: exports `CHARACTER_FIELDS` (name, type, default, min/max)
  used to (a) generate/validate the sanitize function, (b) know what the character
  form needs, (c) know what to render on the sheet. Also exports `defaultCharacter()`,
  `sanitizeCharacter(input, existing)`, `defaultGrid()`, `sanitizeGrid()`,
  `defaultToken()`, `sanitizeToken()`.
- **`shared/protocol.js`**: exports a single `EVENTS` object, e.g.
  `EVENTS.JOIN = 'join'`, `EVENTS.MOVE_TOKEN = 'move-token'`, etc. Both server and
  client `import`/`require` this instead of typing string literals.
- **`server/db.js`**: unchanged logic, just moved — `loadDB()`/`saveDB()`.
- **`server/policy.js`**: pure functions — `isDM(session)`, `isOwnerOfToken(session, token)`,
  `canMoveToken(session, token)`, `canManageBoard(session)` (grid/token/background
  admin actions are DM-only). Handlers call these instead of re-deriving the same
  boolean logic.
- **`server/gameState.js`**: owns the `state` object (background/grid/tokens) and
  `nextTokenId` counter, with functions like `addToken()`, `removeToken()`,
  `moveToken()`, `setGrid()`, `setBackground()`. Keeps `server.js` from being the
  place mutable game state lives.
- **`server/rosterStore.js`**: owns the `activePlayers` Map and the two broadcast
  functions (`broadcastOnlinePlayers`, `pushAllCharactersToDMs`), since both the
  REST routes and the socket handlers need to trigger them.
- **`server/routes/*.js`**: Express routers, mounted in `server.js` via
  `app.use('/api', authRouter)` etc. (`background.js` is mounted at the root since
  its one route, `/upload-background`, was never under `/api`.) Each route handler
  stays thin: parse input, call `server/db.js` + `shared/schema.js`, trigger a
  roster broadcast via `server/rosterStore.js` if needed.
- **`server/socketHandlers/*.js`**: one file per related group of events, each
  exporting a `register(io, socket)` function. `socketHandlers/index.js` calls all
  of them from the single `io.on('connection', ...)`.

## What lives where (client)

- **`public/js/socketClient.js`**: creates the single `io()` instance and exposes
  a thin wrapper (`onEvent(EVENTS.STATE, cb)`, `emitEvent(EVENTS.MOVE_TOKEN, payload)`)
  so every other module imports events from `shared/protocol.js` instead of typing
  strings. Also owns the reconnect-rejoin logic (remembers `lastJoinPayload`).
- **`public/js/state.js`**: a plain object + a few setter functions holding
  `session`, `boardState`, `currentUsername`, `currentCharacters`, `activeCharacter`,
  `onlinePlayers`, `dmRoster`. Not a framework "store" — just one module that owns
  these variables so other modules don't each keep their own copies.
- **`public/js/api.js`**: `login()`, `createCharacter()`, `updateCharacter()`,
  `uploadBackground()` — thin `fetch()` wrappers, one place that knows the REST
  URLs and methods.
- **`public/js/views/*.js`**: each view module owns one screen/panel's DOM
  references and render/event-wiring functions, importing from `state.js`,
  `api.js`, `socketClient.js`, and `shared/schema.js` as needed.
  `characterModalView.js` and `characterSheetView.js` both read
  `shared/schema.js`'s field list (`ABILITY_KEYS`, `defaultCharacter()`), so
  adding a stat there automatically updates the form AND the sheet rendering.
  `characterSelectView.js` and `characterModalView.js` import from each other
  (a circular import), as do `characterSheetView.js` and `characterModalView.js`
  — this is safe in ES modules as long as the imported functions are only
  *called* inside event handlers (i.e. after both modules have finished loading),
  never at the top level of the file.
- **`public/js/main.js`**: the only file that runs top-level side effects
  beyond DOM wiring — importing each view module (which registers that view's
  event listeners as a side effect of being loaded) and owning the "game screen
  shell" logic that doesn't belong to any single panel (role badge, showing the
  DM panel vs. the player's board view, the presence log).

### Browser module note

`public/index.html`'s closing script tag changes from:

```html
<script src="client.js"></script>
```

to:

```html
<script type="module" src="js/main.js"></script>
```

`type="module"` is what tells the browser "this file (and anything it `import`s)
uses ES module syntax" — it also automatically defers execution until the DOM is
parsed and only ever executes a given module file once no matter how many times
it's imported, so we don't need the old IIFE (`(() => { ... })()`) trick to avoid
polluting the global scope; ES modules are private by default.

## Socket event → payload shapes (moved from tribal knowledge into `shared/protocol.js`)

| Event            | Direction                     | Payload                                         |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| `join`           | client→server                 | `{ mode: 'dm'\|'player', name, characterId? }`  |
| `joined`         | server→client                 | `{ mode, name }`                                |
| `state`          | server→client                 | full board state `{ background, grid, tokens }` |
| `presence`       | server→client                 | `{ message }`                                   |
| `your-character` | server→client (to one socket) | `Character`                                     |
| `all-characters` | server→client (to DM sockets) | `[{ username, character }]`                     |
| `players-online` | server→client (broadcast)     | `[{ username, characterName }]`                 |
| `set-grid`       | client(DM)→server             | `Grid`                                          |
| `add-token`      | client(DM)→server             | `{ name, color, owner, col, row }`              |
| `remove-token`   | client(DM)→server             | `tokenId`                                       |
| `move-token`     | client→server                 | `{ id, col, row }`                              |
| `token-moved`    | server→client (broadcast)     | `{ id, col, row }`                              |

This table becomes the source of truth in `shared/protocol.js` (as JSDoc comments
next to each constant), replacing the current situation where you'd have to grep
both `server.js` and `client.js` to reconstruct it.

## Verification performed

Same manual smoke test as originally planned, run after every stage (curl for
Stages 1–2's REST endpoints, then live two-tab browser testing — one DM tab, one
player tab — for Stage 3, since Stage 3 is where the actual event wiring moved):

1. `npm start` (and a fresh `PORT=... node server.js`), open as DM in one tab, player in another. ✅
2. DM: grid form auto-populates with defaults (20/15/40); add a DM-controlled token. ✅
3. Player: log in as a new username/PIN, create a character via the modal (fields
   pre-filled from `defaultCharacter()`), join the table. ✅
4. DM tab receives "player connected" presence message and a live roster card with
   full stats, without a page reload. ✅
5. "Generate Player Tokens" creates one token per connected player using their
   character's `tokenColor`/`owner`. ✅
6. Token permission enforcement verified from both sides: DM sees every token as
   draggable; a player sees only their own token as draggable and all others as
   locked (CSS class, backed by a server-side `move-token` permission check via
   `server/policy.js`). ✅
7. Drag-and-drop round trip: dragging a token updates its `left`/`top` locally and
   the same new position is broadcast to the other tab via `token-moved`. ✅
8. Re-ran the full flow after finding and removing two stray leftover files (root
   `db.js` and `public/client.js`, both superseded duplicates from earlier stages
   that hadn't actually been deleted) to confirm nothing depended on them. ✅

Not completed / left as a follow-up if desired: a deterministic reconnect-drop
test (simulating an actual socket disconnect rather than a blocked network
request) and the optional `node --test` unit tests for `shared/schema.js`
validation/clamping and `server/policy.js` permission checks — Socket.io's
default ~20s `pingTimeout` makes a quick offline-toggle test in a scripted
browser session inconclusive, and the unit tests are pure additions that don't
block anything above.

## Pre-session encounter builder

Feature added after the refactors above; scoped into three ordered phases.
**All three phases (1–3) are implemented and verified** — this section
documents the as-built shape of each, in build order, so future extensions
can find the right choke point instead of rediscovering it.

### Single source of truth (applies to all three phases)

The Character record (and, from Phase 2, a monster instance record) is the
only place HP and status effects are stored and edited. Tokens and the
initiative tracker never store their own copies — they display state read
from the source record.

- **`shared/schema.js`**: `Character` gained a `statusEffects` array (same
  vocabulary as `STATUS_EFFECTS`, previously only on `Token`) and a
  `condition()` method. `Token` lost `hp` and `statusEffects` entirely — it's
  now a pure position + display projection, plus a new `combatantId` field
  (one of `TOKEN_FIELDS`) referencing the Character it's linked to. A token
  with no `combatantId` is a bare DM marker with no HP/status concept.
  `overlayEffects` is unaffected (it's environmental — AoE membership — not
  combat state, so it stays on `Token`).
- **`computeCondition(hp)`** (`shared/schema.js`, exported standalone since
  both `Character` and, from Phase 2, monster instances need it): maps an HP
  pair to `'healthy' | 'bloodied' | 'critical'` with no numbers. This is the
  single choke point for what's safe to show a non-owner.
- **Redacted broadcast**: `GameStateStore#getState()` (`server/gameState.js`)
  now includes `combatantStatuses`, a map of `combatantId -> { combatantId,
  condition, statusEffects }` computed fresh on every call from
  `db.findCharacter(token.owner, token.combatantId)` for every token that has
  one. This goes out to **everyone** as part of the existing `state`
  broadcast. Full private stats still only go to the owner (`your-character`)
  and the DM (`all-characters`) — unchanged. Verified live: connecting as a
  second player and adding a character-linked token shows the token JSON has
  no `hp`/`statusEffects` fields, and `combatantStatuses` carries only
  `condition`/`statusEffects`, for both the DM's and a non-owning player's
  socket.
- **Editing**: moved to the DM's "All Characters" sidebar
  (`characterSheetView.js`'s `buildQuickEditControls`) — HP +/- and status
  checkboxes, saved via the existing `PUT /api/characters/:username/:id`
  (same partial-update path a player's own sheet edit already used).
  `server/routes/characters.js` now also re-emits `EVENTS.STATE` after every
  character create/update, so `combatantStatuses` — and therefore every
  linked token's bloodied glow — refreshes for all connected clients the
  moment the DM (or the player) changes HP/status. This is a deliberately
  lighter-weight surface than the full "Edit Character Sheet" modal
  (class/level/abilities/etc., unchanged, still `characterModalView.js`).
- **Removed, not preserved in parallel**: the per-token HP/status editor and
  the `.token-editor-character` linked-character summary
  (`tokenEditorView.js`), the `UPDATE_TOKEN` socket event and its handler
  (`tokenHandlers.js`), and `GameStateStore#updateToken`. `tokenEditorView.js`
  now only renders a token's name/owner/link-label and a Remove button.
- **Initiative** (`shared/schema.js`'s `TurnOrder`, unchanged in shape):
  entries are still `{ tokenId, initiative }` — a token IS the placement of a
  combatant, so this already satisfies "reference, don't copy": no HP/status
  ever lived there, and none needed removing. `turnTrackerView.js` looks up
  display info through the token the same as `boardView.js` does.

### Phase 1 (implemented) — Character-linked PC tokens

- `GET /api/all-characters` already existed (added in an earlier stage for
  the DM roster) and was reused as-is — this phase turned out to be almost
  entirely frontend, as expected.
- "Generate Player Tokens" is gone. In its place: a `<select multiple>`
  character-token picker in the DM panel (`dmPanelView.js`), populated from
  `ApiClient.getAllCharacters()` (new thin wrapper in `api.js`) with every
  saved character across every user, online or not. Selecting one or more and
  clicking "Add Selected as Tokens" emits `ADD_TOKEN` with `combatantId` set,
  once per selection.
- `Token.fromInput` picks up `combatantId` generically via `TOKEN_FIELDS`, the
  same declarative mechanism as every other token field — no special-casing
  needed in `GameStateStore#addToken`.

### Phase 2 (implemented) — Monster library from `dnd-data`

- `dnd-data` is an npm dependency, loaded once at server start via
  `import { monsters } from "dnd-data"` in `server/monsterLibrary.js` — no
  network calls, no live fetching. Real entries were inspected first
  (`node -e 'console.log(monsters[N])'`): `properties` is inconsistent across
  entries (older/simpler ones carry only `Category`/`Size`/`Type`/
  `Alignment`/`Challenge Rating`; richer 5e-SRD-derived ones also carry
  `AC`/`HP`/`Speed`/`data-AcNum`/`data-HpNum`/`data-CrNum`/`data-Actions` —
  the latter a JSON-encoded string of attack/trait objects). `MonsterLibrary`
  normalizes every entry into one flat `MonsterTemplate` shape
  (`toTemplate()`), tolerating missing fields (`ac`/`hpMax`/`cr` can be
  `null`) rather than guessing.
- `MonsterInstance` (new class in `shared/schema.js`) is the `Combatant`-
  shaped concept underneath `Character` the design called for — a small,
  separate class (`id`, `templateId`, `name`, `ac`, `hp`, `statusEffects`,
  `speed`, `cr`, `type`, `size`, `attacks`, `source`) sharing `hp`/
  `statusEffects`/`condition()` with `Character` but *not* a rework of it.
  Only `hp`/`statusEffects` are ever mutated after `fromTemplate()` creates
  an instance at full HP — everything else is an immutable snapshot. Reuses
  `computeCondition(hp)` unchanged.
- `GET /api/monsters?name=&crMin=&crMax=&limit=` (`server/routes/monsters.js`,
  backed by `MonsterLibrary#search`) filters the in-memory array server-side
  and returns a bounded, lightweight result set (default 50, max 200 —
  `id`/`name`/`size`/`type`/`cr`/`ac`/`hpMax` only, no `attacks`/`source`).
  The full 11k-entry array and its `attacks`/description text never reach the
  browser. `GET /api/monsters/:id` returns one full template for detail
  views.
- Placing a monster token is one socket round trip, `ADD_MONSTER_TOKEN`
  (`{ templateId, color, col, row }`): `GameStateStore#addMonsterInstance`
  creates a fresh `MonsterInstance` from the template (own id, own full HP,
  persisted in `GameStateStore.monsterInstances` — NOT in `data/db.json`'s
  character records, since instance HP is combat/session state, not a
  player's saved character), then a token is added with `combatantId`
  pointing at it and `combatantType: "monster"` (new `TOKEN_FIELDS` entry
  alongside `combatantId`, picked up generically the same way). Removing that
  token (`REMOVE_TOKEN`) also deletes its `MonsterInstance` — unlike a
  Character, an instance has no life independent of the one token it backs.
- `#computeCombatantStatuses()` in `GameStateStore` is the one redaction
  choke point for *both* combatant kinds: it branches on `token.combatantType`
  to look a `combatantId` up via `db.findCharacter` or
  `this.monsterInstances`, and returns the same redacted
  `{combatantId, condition, statusEffects}` shape either way — no second
  parallel status system.
- **Privacy boundary matches Character's, and required its own new
  server-only channel**: real `MonsterInstance.hp`/`statusEffects` are
  deliberately never included in the general `state` broadcast (unlike
  Characters, monster instances have no natural "owner" socket to receive
  them privately the way `your-character` works). Instead, a new DM-only
  event, `ALL_MONSTER_INSTANCES`, mirrors `ALL_CHARACTERS`: pushed to every
  connected DM socket on join and after every add/update/remove
  (`GameStateStore#pushMonsterInstancesToDMs`, iterating
  `io.sockets.sockets` for `session.mode === "dm"`, same pattern as
  `RosterStore#pushAllCharactersToDMs`). Live-verified via a two-socket
  (DM + player) test: player's `state.combatantStatuses` and `state.tokens`
  never contain a monster's `hp`; only the DM socket ever receives
  `all-monster-instances` with real numbers.
- DM sidebar (`dmPanelView.js`): a name/CR-range search form + results
  `<select multiple>` ("Monster Library" section, mirrors Phase 1's
  character-token picker), and a placed-instance list with the same
  HP +/- and status-effect quick-edit as characters. That control was
  factored out into `public/js/views/quickEditControls.js` (parameterized by
  `hp`/`statusEffects`/save-callbacks) and is now used by both
  `characterSheetView.js` (saves via `ApiClient.updateCharacter`, the REST
  path) and `dmPanelView.js`'s monster instance list (saves via
  `UPDATE_MONSTER_INSTANCE`, the socket path) — one shared widget, not two
  parallel implementations.
- Each placed monster instance is independent (its own current HP), even if
  several instances share the same `dnd-data` template — same as any other
  token.

### Phase 3 (implemented) — Named, saved encounters (full board snapshot)

- `Encounter` (new class in `shared/schema.js`): `{ id, name, snapshot }`,
  where `snapshot` is the *entire* board state — background, grid, tokens
  (with position), overlays, turn order, and monster instances — captured
  verbatim via `GameStateStore#toSnapshotJSON()`. `snapshot` is opaque to
  `Encounter` (always server-constructed from live state, never typed by
  hand), so only `name` is genuinely validated input; this replaced an
  earlier design that saved just a list of character/monster selections and
  explicitly did *not* touch grid/position/background — the DM wanted full
  save-state/load-state behavior instead, so that scope cut was reversed.
- `GameStateStore` gained `toSnapshotJSON()` (the exact shape persisted to
  `data/db.json`'s `board` key — background/grid/tokens/overlays/turnOrder/
  monsterInstances/id counters) and `restoreSnapshot(snapshot)` (replaces
  every piece of that state in one call and re-persists). Both the
  constructor's initial load from `data/db.json` and an encounter load now
  funnel through the same private `#loadFromSnapshot` — one place that knows
  how to turn a snapshot back into live state.
- Persistence: a new top-level `encounters` array in `data/db.json`
  (`server/db.js`'s `loadDB()` defaults it to `[]` for older db.json files),
  with `createEncounter`/`updateEncounter`/`deleteEncounter`/`getEncounter`/
  `getEncounters` helpers alongside the existing character ones — no new
  persistence mechanism.
- `server/routes/encounters.js` (`EncountersController`): `GET
  /api/encounters`, `POST /api/encounters` (captures
  `gameState.toSnapshotJSON()` as a brand-new save — the request body only
  needs `{ name }`), `PUT /api/encounters/:id` (renames, and if
  `resnapshot: true` also overwrites the saved snapshot with the current
  live state), `DELETE /api/encounters/:id`, and `POST
  /api/encounters/:id/load` (calls `gameState.restoreSnapshot(...)`,
  replacing the ENTIRE board, then broadcasts `state` and calls
  `pushMonsterInstancesToDMs`, same as any other board-mutating action).
- DM sidebar: the "Encounters" tab (see "Tabbed DM panel" below) is just a
  name field + "Save Current State" button plus the saved-encounter list
  (Load/Overwrite/Delete) — no entry-builder UI at all, since the snapshot
  is captured server-side from whatever's currently live.

### DM panel tabs (implemented)

- `#dm-panel` is split into 5 tabs — Map, Tokens, Encounters, Turns,
  Overlays — via `.dm-tab-btn`/`.dm-tab-panel` markup in `index.html` and a
  small `wireTabs()` function in `dmPanelView.js` that toggles `.active` on
  click. All existing element ids (`#token-list`, `#encounter-list`,
  `#initiative-list`, `#overlay-list`, etc.) are unchanged — only their
  containing markup moved into tab panels — so no other view module needed
  to change to accommodate the restructuring.
- The old "Add Character Token(s)" and "Monster Library" sections both live
  under the Tokens tab now (both are fundamentally "create/select a token"),
  matching the requested "token select/create" category grouping.

### Monsters sidebar (implemented)

- A new `#monsters-sidebar` aside sits next to `#character-sidebar`,
  DM-only (shown/hidden alongside `#dm-panel` in `main.js`), rendered by a
  new `public/js/views/monsterSheetView.js` (`renderMonsterSidebar()`) that
  mirrors `characterSheetView.js`'s card pattern: name, size/type, CR, AC,
  speed, an HP bar, quick-edit controls (current HP +/-, and now an
  **editable max HP** input — see `quickEditControls.js`'s new `onSetMaxHp`
  handler), status effect toggles, and a read-only attacks list (name/to-hit/
  damage/damage type from `dnd-data`, already present on `MonsterInstance`).
- This replaces the old monster-instance list that used to live inside
  `#dm-panel` (`renderMonsterInstanceList` in `dmPanelView.js` — removed);
  `main.js`'s `EVENTS.ALL_MONSTER_INSTANCES` handler now calls
  `renderMonsterSidebar()` instead.
- Max HP editing needed no server changes: `HitPoints.fromInput` already
  handled both `current` and `max` (see `HP_FIELDS`), so
  `UPDATE_MONSTER_INSTANCE`'s existing `{ hp: { max } }` support just needed
  a client-side control to reach it.

### Verbose text removal (implemented)

- All `<p class="hint">` explanatory paragraphs inside `#dm-panel` and the
  in-game board (`#board-hint`, the "drag your token" instructions) were
  removed — the tabbed layout plus concise labels made them redundant. The
  per-token "affected by area overlays" hint paragraph was condensed into a
  short inline tag (`.token-overlay-tag`) instead of a full sentence. The
  join-screen's pre-game hint text was left as-is (unrelated to the DM
  panel's crowding).

## How to add common things

- **New character stat**: add one entry to `CHARACTER_FIELDS` (or `HP_FIELDS` for
  an HP-like field) in `shared/schema.js` — include `key`, `kind`, `label`,
  and `default` (plus `min`/`max` for numeric fields). `sanitizeCharacter()`
  already loops over these lists generically, and `characterModalView.js` /
  `characterSheetView.js` both read the same lists to build the form and the
  sheet, so no other file needs to change for a simple typed field.
- **New token property**: same idea, in `TOKEN_FIELDS`. `sanitizeToken()` in
  `shared/schema.js` picks it up automatically; if it needs custom rendering on
  the board (not just data), add that to `boardView.js`'s token-render function.
- **New socket event**: add a constant (and a JSDoc payload comment) to
  `shared/protocol.js`'s `EVENTS` object. On the server, add a handler function
  in the most relevant file under `server/socketHandlers/` (or a new file,
  registered from `socketHandlers/index.js`) that checks `server/policy.js` for
  permission before mutating `server/gameState.js`. On the client, add a
  `socketClient.onEvent(EVENTS.YOUR_NEW_EVENT, handler)` call in the view module
  that owns that UI, and `emitEvent(EVENTS.YOUR_NEW_EVENT, payload)` wherever the
  user action originates.
- **New status-effect type**: add one key to `STATUS_EFFECTS` in
  `shared/schema.js` (icon/background/color) — `Character.fromInput`'s and
  `MonsterInstance.fromInput`'s `statusEffects` handling, `boardView.js`'s
  badge rendering, and the shared quick-edit widget
  (`public/js/views/quickEditControls.js`, used by both
  `characterSheetView.js` and `monsterSheetView.js`'s Monsters sidebar) all
  read `Object.keys(STATUS_EFFECTS)` generically, so no other file needs to
  change. Status effects live on the combatant record (`Character` or
  `MonsterInstance`) now, not on `Token` — see "Pre-session encounter
  builder" above.
- **New REST endpoint**: add a route in the relevant `server/routes/*.js` file (or
  a new router file, mounted in `server.js`), and a matching wrapper function in
  `public/js/api.js` for the client to call.
- **New monster data source** (extension point): keep `dnd-data` wired up
  directly rather than adding a generic "data source" abstraction until a
  second source actually shows up. To add one: write a new adapter module
  (alongside `server/monsterLibrary.js`) that maps its entries into the same
  `MonsterTemplate` shape (`{id, name, size, type, cr, ac, hpMax, speed,
  attacks, source}`), and either merge its results into `MonsterLibrary`'s
  existing `search()`/`getTemplate()` or add a `source` query param to `GET
  /api/monsters` \u2014 don't fork the endpoint or the DM sidebar's monster
  picker UI.
- **New encounter field** (extension point): add it to `Encounter` in
  `shared/schema.js` (`fromInput`/`toJSON`) — `server/db.js`'s
  `createEncounter`/`updateEncounter` and `server/routes/encounters.js`
  already delegate validation there, so no other server file needs to
  change. Avoid adding board/position snapshotting back in without
  re-reading Phase 3's scope note above; that was a deliberate cut, not an
  oversight.
