import test from 'node:test';
import assert from 'node:assert/strict';

import { PermissionPolicy } from '../server/policy.js';

test('isDM is true only for dm-mode sessions', () => {
  assert.equal(PermissionPolicy.isDM({ mode: 'dm' }), true);
  assert.equal(PermissionPolicy.isDM({ mode: 'player' }), false);
});

test('isOwnerOfToken matches a player session against a token they own, case-insensitively', () => {
  const session = { mode: 'player', name: 'Alice' };
  assert.equal(PermissionPolicy.isOwnerOfToken(session, { owner: 'alice' }), true);
  assert.equal(PermissionPolicy.isOwnerOfToken(session, { owner: 'Bob' }), false);
});

test('isOwnerOfToken is false for a dm session or an unowned token', () => {
  assert.equal(PermissionPolicy.isOwnerOfToken({ mode: 'dm', name: 'Alice' }, { owner: 'alice' }), false);
  assert.equal(PermissionPolicy.isOwnerOfToken({ mode: 'player', name: 'Alice' }, { owner: null }), false);
});

test('canMoveToken allows the DM to move any token', () => {
  const dmSession = { mode: 'dm', name: 'DM' };
  assert.equal(PermissionPolicy.canMoveToken(dmSession, { owner: 'someone-else' }), true);
});

test('canMoveToken allows a player to move only their own token', () => {
  const session = { mode: 'player', name: 'Alice' };
  assert.equal(PermissionPolicy.canMoveToken(session, { owner: 'alice' }), true);
  assert.equal(PermissionPolicy.canMoveToken(session, { owner: 'bob' }), false);
});

test('canManageBoard is DM-only', () => {
  assert.equal(PermissionPolicy.canManageBoard({ mode: 'dm' }), true);
  assert.equal(PermissionPolicy.canManageBoard({ mode: 'player' }), false);
});

test('verifyDmCredentials matches username case-insensitively and pin exactly', () => {
  const dm = { username: 'DM', pin: '0000' };
  assert.equal(PermissionPolicy.verifyDmCredentials(dm, 'dm', '0000'), true);
  assert.equal(PermissionPolicy.verifyDmCredentials(dm, 'DM', '0000'), true);
  assert.equal(PermissionPolicy.verifyDmCredentials(dm, 'dm', '0001'), false);
  assert.equal(PermissionPolicy.verifyDmCredentials(dm, 'notdm', '0000'), false);
});

test('verifyDmCredentials trims whitespace from the submitted name/pin', () => {
  const dm = { username: 'dm', pin: '1234' };
  assert.equal(PermissionPolicy.verifyDmCredentials(dm, '  dm  ', '  1234  '), true);
});

test('verifyDmCredentials returns false when no dm record exists', () => {
  assert.equal(PermissionPolicy.verifyDmCredentials(null, 'dm', '0000'), false);
});

function makeFakeIo(sockets) {
  return { sockets: { sockets: new Map(sockets.map((s, i) => [String(i), s])) } };
}

test('forEachDmSocket invokes the callback only for sockets with a dm-mode session', () => {
  const dmSocket = { data: { session: { mode: 'dm' } } };
  const playerSocket = { data: { session: { mode: 'player' } } };
  const noSessionSocket = { data: {} };
  const io = makeFakeIo([dmSocket, playerSocket, noSessionSocket]);

  const visited = [];
  PermissionPolicy.forEachDmSocket(io, (socket) => visited.push(socket));

  assert.deepEqual(visited, [dmSocket]);
});

test('forEachDmSocket is a no-op when there are no dm sockets', () => {
  const io = makeFakeIo([{ data: { session: { mode: 'player' } } }]);
  let called = false;
  PermissionPolicy.forEachDmSocket(io, () => {
    called = true;
  });
  assert.equal(called, false);
});
