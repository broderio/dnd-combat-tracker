import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE, ROUTES, UPLOAD_BACKGROUND_ROUTE, buildRoute, EVENTS } from '../shared/protocol.js';

test('buildRoute fills a single :param placeholder with a URL-encoded value', () => {
  assert.equal(buildRoute(ROUTES.encounter, { id: 'enc_1' }), '/encounters/enc_1');
});

test('buildRoute fills multiple :param placeholders in one pattern', () => {
  assert.equal(
    buildRoute(ROUTES.character, { username: 'Alice Smith', id: 'char_1' }),
    '/characters/Alice%20Smith/char_1'
  );
});

test('buildRoute leaves patterns with no placeholders unchanged', () => {
  assert.equal(buildRoute(ROUTES.encounters, {}), '/encounters');
});

test('API_BASE combined with ROUTES produces the expected wire paths', () => {
  assert.equal(`${API_BASE}${ROUTES.login}`, '/api/login');
  assert.equal(`${API_BASE}${buildRoute(ROUTES.characters, { username: 'bob' })}`, '/api/characters/bob');
});

test('UPLOAD_BACKGROUND_ROUTE is mounted at the app root, not under API_BASE', () => {
  assert.equal(UPLOAD_BACKGROUND_ROUTE, '/upload-background');
});

test('EVENTS exposes distinct string values for every event name (no accidental collisions)', () => {
  const values = Object.values(EVENTS);
  assert.equal(new Set(values).size, values.length);
});
