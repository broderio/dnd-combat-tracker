# Architecture

This document describes how the codebase is organized and _why_. It's aimed at
someone with a strong backend/Python background but limited front-end experience,
so it spells out browser-specific idioms that a JS-focused doc would take for granted.

> Status: **AS-BUILT**. This describes the structure that actually exists in the
> repo today, after all three refactor stages landed and were verified (see
> "Verification results" near the bottom).

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
  DM panel vs. the player board-hint, the presence log).

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
- **New status-effect type** (roadmap item): would live as a new field on the
  Token schema in `shared/schema.js` (e.g. `statusEffects: []` in `TOKEN_FIELDS`
  or a dedicated `sanitizeToken()` branch, since effects are a list rather than a
  scalar), a small render helper in `boardView.js` for the on-token badge/icon,
  and — if effects need DM controls — a UI addition in `dmPanelView.js`. No
  changes needed to `server/policy.js` or the socket wiring unless effects need
  their own add/remove event instead of piggybacking on `add-token`/`move-token`.
- **New REST endpoint**: add a route in the relevant `server/routes/*.js` file (or
  a new router file, mounted in `server.js`), and a matching wrapper function in
  `public/js/api.js` for the client to call.
