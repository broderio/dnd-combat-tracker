export class ApiClient {
  static async #sendJson(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  static login(username, pin) {
    return ApiClient.#sendJson('/api/login', 'POST', { username, pin });
  }

  static createCharacter(username, payload) {
    return ApiClient.#sendJson(`/api/characters/${encodeURIComponent(username)}`, 'POST', payload);
  }

  static updateCharacter(username, characterId, payload) {
    return ApiClient.#sendJson(`/api/characters/${encodeURIComponent(username)}/${characterId}`, 'PUT', payload);
  }

  static deleteCharacter(username, characterId) {
    return ApiClient.#sendJson(`/api/characters/${encodeURIComponent(username)}/${characterId}`, 'DELETE', {});
  }

  /** Full roster across all users (DM-only feature) */
  static async getAllCharacters() {
    const res = await fetch('/api/all-characters');
    return res.json();
  }

  /** Bounded, filtered search over the local dnd-data monster library (DM-only feature). */
  static async searchMonsters({ name, crMin, crMax, type } = {}) {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (crMin !== undefined && crMin !== '') params.set('crMin', crMin);
    if (crMax !== undefined && crMax !== '') params.set('crMax', crMax);
    if (type) params.set('type', type);
    const res = await fetch(`/api/monsters?${params.toString()}`);
    return res.json();
  }

  static async getEncounters() {
    const res = await fetch('/api/encounters');
    return res.json();
  }

  static createEncounter(payload) {
    return ApiClient.#sendJson('/api/encounters', 'POST', payload);
  }

  static updateEncounter(id, payload) {
    return ApiClient.#sendJson(`/api/encounters/${id}`, 'PUT', payload);
  }

  static deleteEncounter(id) {
    return ApiClient.#sendJson(`/api/encounters/${id}`, 'DELETE', {});
  }

  static loadEncounter(id) {
    return ApiClient.#sendJson(`/api/encounters/${id}/load`, 'POST', {});
  }

  static async uploadBackground(file) {
    const formData = new FormData();
    formData.append('background', file);
    const res = await fetch('/upload-background', { method: 'POST', body: formData });
    return res.json();
  }
}
