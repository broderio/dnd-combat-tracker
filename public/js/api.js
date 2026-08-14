// public/js/api.js
//
// Thin `fetch()` wrappers for the REST endpoints — the one place that knows
// the URLs/methods, so other modules don't build request objects by hand.

async function sendJson(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function login(username, pin) {
  return sendJson("/api/login", "POST", { username, pin });
}

export function createCharacter(username, payload) {
  return sendJson(`/api/characters/${encodeURIComponent(username)}`, "POST", payload);
}

export function updateCharacter(username, characterId, payload) {
  return sendJson(`/api/characters/${encodeURIComponent(username)}/${characterId}`, "PUT", payload);
}

export async function uploadBackground(file) {
  const formData = new FormData();
  formData.append("background", file);
  const res = await fetch("/upload-background", { method: "POST", body: formData });
  return res.json();
}
