# Architecture

This document describes how the codebase is organized and _why_. It's aimed at
someone with a strong backend/Python background but limited front-end experience,
so it spells out browser-specific idioms that a JS-focused doc would take for granted.

> Status: **PROPOSAL** — this describes the target structure before the refactor.
> Once the refactor is done, this section will be replaced with "as-built" notes.

## Guiding idea

There is exactly **one place** each "concept" is defined:

| Concept                                                          | Defined once in      |
| ---------------------------------------------------------------- | -------------------- |
| What fields a Character/Token/Grid has, and how to validate them | `shared/schema.js`   |
| What socket events exist and what payload shape each one carries | `shared/protocol.js` |
| Who is allowed to do what (move this token, edit that character) | `server/policy.js`   |
| How data is read/written to disk                                 | `server/db.js`       |

Both the server (via `require()`, since Node uses CommonJS) and the browser client
(via native ES modules, `<script type="module">` + `import`) load `shared/schema.js`
and `shared/protocol.js` **as literally the same file** — no code generation, no
build step. This works because both CommonJS and ES modules can coexist in the same
file if we write it carefully (see "Dual-format shared modules" below), or more
simply, because we make the shared files pure ES modules and let the server load
them with a tiny dynamic-`import()` shim. We're using the **plain ES module**
approach on both sides (see below) since Node 18+ supports `import`/`export`
natively — no transpiler needed.

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

## Target file structure

```
dnd-tracker/
├── server.js                  # thin: wires Express + Socket.io, delegates to server/*
├── db.js                      # (kept, unchanged path) re-exports server/db.js for compatibility — see note
├── package.json
├── ARCHITECTURE.md
├── data/
│   └── db.json
├── shared/                     # loaded by BOTH server (require) and browser (<script type=module>)
│   ├── schema.js               # Character/Token/Grid field defs, defaults, validation/clamping
│   └── protocol.js             # socket.io event name constants + JSDoc payload shapes
├── server/
│   ├── db.js                   # persistence: load/save data/db.json (moved from db.js)
│   ├── policy.js                # canEditCharacter, canMoveToken, isDM, isOwner, etc.
│   ├── gameState.js             # in-memory board state (background/grid/tokens) + mutators
│   ├── rosterStore.js           # activePlayers map + online-roster broadcast helpers
│   ├── routes/
│   │   ├── auth.js              # POST /api/login
│   │   └── characters.js        # GET/POST/PUT/DELETE /api/characters/*, GET /api/all-characters
│   └── socketHandlers/
│       ├── index.js             # registers all handlers on `io.on('connection', ...)`
│       ├── joinHandler.js       # 'join' event + reconnect bookkeeping
│       ├── gridHandler.js       # 'set-grid'
│       └── tokenHandlers.js     # 'add-token' / 'remove-token' / 'move-token'
└── public/
    ├── index.html               # unchanged content, just script tag becomes type="module"
    ├── style.css                # unchanged
    ├── uploads/
    └── js/
        ├── main.js               # entry point: imports everything else, wires DOM events
        ├── socketClient.js       # wraps `io()`, exposes typed emit/on helpers using shared/protocol.js
        ├── state.js              # small in-memory client "store" (session, board state, roster, etc.)
        ├── api.js                # fetch() wrappers for the REST endpoints
        └── views/
            ├── joinView.js       # login/DM-join screen logic
            ├── characterSelectView.js
            ├── characterModalView.js   # create/edit character form (uses shared/schema.js field list)
            ├── characterSheetView.js   # sidebar: own character + DM roster cards
            └── boardView.js            # background/grid/token rendering + drag-and-drop
```

### Note on `db.js` at the root

`db.js` currently sits at the repo root and is `require()`'d by `server.js`. The
refactor moves its logic into `server/db.js` (co-located with the other server
modules). I'll delete the root `db.js` and update the one `require('./db')` in
`server.js` to `require('./server/db')` — there's no compatibility shim needed
since nothing outside `server.js` imports it directly.

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
- **`server/policy.js`**: pure functions like `isDM(session)`, `isOwnerOfToken(session, token)`,
  `canMoveToken(session, token)`, `canEditCharacter(session, username)`. Handlers
  call these instead of re-deriving the same boolean logic.
- **`server/gameState.js`**: owns the `state` object (background/grid/tokens) and
  `nextTokenId` counter, with functions like `addToken()`, `removeToken()`,
  `moveToken()`, `setGrid()`, `setBackground()`. Keeps `server.js` from being the
  place mutable game state lives.
- **`server/rosterStore.js`**: owns the `activePlayers` Map and the two broadcast
  functions (`broadcastOnlinePlayers`, `pushAllCharactersToDMs`), since both the
  REST routes and the socket handlers need to trigger them.
- **`server/routes/*.js`**: Express routers, mounted in `server.js` via
  `app.use('/api', authRouter)` etc. Each route handler stays thin: parse input,
  call `server/db.js` + `shared/schema.js`, call roster broadcast if needed.
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
- **`public/js/api.js`**: `login()`, `fetchCharacters()`, `createCharacter()`,
  `updateCharacter()`, `deleteCharacter()`, `fetchAllCharacters()`,
  `uploadBackground()` — thin `fetch()` wrappers, one place that knows the REST
  URLs and methods.
- **`public/js/views/*.js`**: each view module owns one screen/panel's DOM
  references and render/event-wiring functions, importing from `state.js`,
  `api.js`, `socketClient.js`, and `shared/schema.js` as needed.
  `characterModalView.js` and `characterSheetView.js` both read
  `shared/schema.js`'s field list, so adding a stat there automatically updates
  the form AND the sheet rendering.
- **`public/js/main.js`**: the only file that runs top-level side effects at
  load time — imports every view module, does the initial DOM wiring (tab
  switching etc.), and starts the socket connection.

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

## Verification plan (after each stage)

Manual smoke test (same as README's "Trying it out" section), run after every stage:

1. `npm start`, open as DM in one tab, player in another.
2. DM: upload background, set grid, add a token.
3. Player: log in (new + existing username/PIN), create a character, join table.
4. Player drags own token (should move + snap); DM drags any token.
5. Player tries (via devtools console) to emit `move-token` for a token they don't
   own — server should silently ignore it (permission check).
6. DM sidebar shows all online characters; player sidebar shows only their own.
7. Kill/restart the player's WiFi (or just close+reopen dev tools' offline toggle)
   to confirm reconnect auto-rejoins.
8. Edit a character mid-game from the sidebar — DM roster should update live.

Where practical, I'll add a small Node-based automated test (no browser needed) for
the pure logic that's easiest to break silently: `shared/schema.js` validation/
clamping and `server/policy.js` permission checks. These don't need a browser or
sockets, so a plain `node --test` script is enough — no new test framework
dependency required (Node 18+ ships `node:test` built in).

## How to add common things (filled in fully after the refactor; sketch for now)

- **New character stat**: add one entry to `CHARACTER_FIELDS` in `shared/schema.js`.
  Form field, validation, and sheet rendering all pick it up automatically.
- **New token property**: same idea, in the `TOKEN_FIELDS` list.
- **New socket event**: add a constant + payload comment to `shared/protocol.js`,
  add a handler file (or function) under `server/socketHandlers/`, add the
  corresponding `socketClient.onEvent(...)`/`emitEvent(...)` call in the relevant
  client view module.
- **New status-effect type** (roadmap item): would live as a new field on the
  Token schema (e.g. `statusEffects: []`) plus a small render helper in
  `boardView.js` — the schema-first structure means the data model for this is a
  one-line schema change even though the actual UI work is still separate.
