# Combat Tracker — Proof of Concept

A real-time DnD combat tracker you run from your own laptop. This POC proves out the
core plumbing: DM vs. player roles, live token movement synced across everyone's
screen, background upload, and a configurable grid — including players connecting
from outside your home network.

## What's in this POC (and what isn't yet)

**Working now:**
- DM and Player join screens with different permissions
- **Player accounts**: username + PIN. First login with a username registers it with that PIN; later logins must match. Usernames are unique (case-insensitive) and persist across server restarts in `data/db.json`.
- **Character sheets**: players can save one or more characters (class, race, level, AC, current/max HP, all six ability scores, freeform notes). Rejoining under the same username lets you pick which character to play, or create a new one.
- Mid-game character editing from the sidebar (e.g. updating HP as combat happens) — saves immediately and pushes to the DM's view live.
- DM uploads a background map image
- DM configures grid columns/rows/cell size, and can hide the grid lines from players while snapping still works
- DM adds tokens and assigns ownership via a **dropdown of currently online players** (or leaves it unowned for monsters/NPCs)
- Players can drag **only their own** token; it snaps to the nearest grid cell
- DM can drag **any** token
- **Character sidebar**: players see only their own character's stats; the DM sees every online player's full sheet. This is enforced server-side — a player's stats are never sent over the network to anyone but that player and the DM, not just hidden in the UI.
- Everything syncs live over WebSockets — open it on two laptops and move a token on one, watch it move on the other

**Not built yet (from your full requirements list)** — these are the natural next layers once the connection model is proven out:
- Status effect icons on tokens
- Qualitative HP display *for enemy/monster tokens* — the character sidebar now shows real HP to the owning player and the DM, which is correct for PCs, but enemy tokens don't yet have a player-facing "bloodied / near death" style indicator
- Area-of-effect overlays (fire, water, electricity, etc.)
- Persistent save/load of *board* state (background, grid, tokens) — accounts and characters now persist, but the map/token layout still resets when the server restarts

## 1. Install

You need [Node.js](https://nodejs.org) (v18+) installed on the laptop that will host the game.

```bash
cd dnd-tracker
npm install
```

## 2. Run it

```bash
npm start
```

You'll see:

```
DnD Combat Tracker running:
  Local:   http://localhost:3000
  Network: http://<your-lan-ip>:3000
```

Open `http://localhost:3000` yourself to confirm it works before inviting anyone.

## 3. Getting players on other networks connected

Your laptop isn't normally reachable from the internet, so you have two options.
For a POC / one-off session, **option A is simplest**.

### Option A — Quick tunnel (recommended for testing)

Use a tunneling tool so you don't have to touch your router. [ngrok](https://ngrok.com) is the most common:

```bash
# one-time setup
brew install ngrok        # or download from ngrok.com
ngrok config add-authtoken <your-token>   # free account

# each session, in a second terminal while the server is running
ngrok http 3000
```

ngrok prints a public URL like `https://abcd1234.ngrok-free.app` — send that to your
players instead of a localhost/LAN address. Traffic is tunneled to your laptop, so
this works regardless of what network anyone is on. The free tier gives you a new
random URL each time you restart ngrok, which is fine for a POC.

Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) is a free
alternative if you'd rather not create an ngrok account.

### Option B — Port forwarding on your router

More permanent, but requires router access:
1. Find your laptop's LAN IP (the "Network:" address the server printed).
2. In your router's admin page, forward external port 3000 to that IP on port 3000.
3. Find your public IP (search "what's my ip") and share `http://<public-ip>:3000` with players.
4. Consider a dynamic DNS service (e.g. DuckDNS) if your public IP changes, and be aware this exposes a port directly to the internet — fine for a short campaign session, but don't leave it open long-term.

## 4. Trying it out

1. Start the server and open it yourself in one browser tab, choose **Dungeon Master**, and enter.
2. Upload a background image and set your grid size.
3. In another tab/browser/device, choose **Player**, enter a username (e.g. `alice`) and any PIN, and continue. Since it's a new username, it registers automatically.
4. On the character-select screen, click **+ Create New Character** and fill in a quick stat block, then save — this both saves the character and joins the table as that character.
5. Back in the DM tab, open the **Owner** dropdown when adding a token — `alice` should now appear there (with her character name). Assign a token to her.
6. As Alice, you should see the board without the DM panel, be able to drag only your own token, and see your own character sheet in the right sidebar.
7. As the DM, the right sidebar should show Alice's full character sheet. Log out of Alice's tab and back in with the same username/PIN — her character should still be there to pick again.
8. Try it with a friend on a different network using the tunnel URL from Option A to confirm the real cross-network case works before your next session.

## Notes on this POC's design

- Board state (background, grid, tokens) lives in server memory — it's shared by
  everyone connected, which is what proves the multiplayer sync works. It resets
  if you restart the server; persistence (save/load a session) is a natural next step.
- Accounts and characters, by contrast, are saved to `data/db.json` on disk and
  survive restarts — that file is your whole player roster, so back it up if you
  care about it between sessions.
- Permissions are enforced server-side (a player's client can't move someone else's
  token, or see another player's character sheet, even if they tried to fake it),
  not just hidden in the UI.
- The PIN system is intentionally simple — plaintext PIN stored per username, no
  hashing, no sessions/cookies. That matches what you asked for (uniqueness, not
  security) and is fine for a private game with friends. Worth revisiting with real
  hashed passwords if this ever ran somewhere less trusted.
- Any REST call that touches `/api/characters/:username` currently just trusts the
  username in the URL — there's no token proving the caller *is* that user beyond
  having logged in client-side. Low-stakes for a friends game, but worth knowing.
- If someone's connection drops mid-session (WiFi blip, laptop sleep) with their tab
  still open, the client now automatically re-sends its join info the moment
  Socket.IO reconnects — that's what restores them on the DM's roster and re-enables
  their token moves without needing a manual page refresh.
