// server/policy.js
//
// Single source of truth for "is this actor allowed to do X" checks. Socket
// handlers and routes call these instead of re-deriving the same boolean
// logic inline — adding a new privileged action means adding one function
// here, not copy-pasting an `if (session.mode !== 'dm') return;` check.
//
// `session` is the per-socket object socketHandlers/*.js maintains, shaped
// like `{ mode: 'dm'|'player', name, characterId }`.

export function isDM(session) {
  return session.mode === 'dm';
}

export function isOwnerOfToken(session, token) {
  return session.mode === 'player' && !!token.owner &&
    token.owner.toLowerCase() === session.name.toLowerCase();
}

/** DM can move any token; a player can only move a token they own. */
export function canMoveToken(session, token) {
  return isDM(session) || isOwnerOfToken(session, token);
}

/** Board-management actions (grid config, add/remove token, background upload) are DM-only. */
export function canManageBoard(session) {
  return isDM(session);
}
