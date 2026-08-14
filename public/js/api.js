// public/js/api.js
//
// Thin `fetch()` wrappers for the REST endpoints — the one place that knows
// the URLs/methods, so other modules don't build request objects by hand.
// Grouped as `static` methods on a class (rather than free exported
// functions) for consistency with the rest of the app's now-class-based
// modules; there's no per-call instance state to justify a constructor here.

export class ApiClient {
  static async #sendJson(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  static login(username, pin) {
    return ApiClient.#sendJson("/api/login", "POST", { username, pin });
  }

  static createCharacter(username, payload) {
    return ApiClient.#sendJson(`/api/characters/${encodeURIComponent(username)}`, "POST", payload);
  }

  static updateCharacter(username, characterId, payload) {
    return ApiClient.#sendJson(`/api/characters/${encodeURIComponent(username)}/${characterId}`, "PUT", payload);
  }

  static async uploadBackground(file) {
    const formData = new FormData();
    formData.append("background", file);
    const res = await fetch("/upload-background", { method: "POST", body: formData });
    return res.json();
  }
}

