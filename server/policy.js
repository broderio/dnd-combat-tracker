// server/policy.js
//
// Single source of truth for "is this actor allowed to do X" checks. Socket
// handlers and routes call these instead of re-deriving the same boolean
// logic inline — adding a new privileged action means adding one method
// here, not copy-pasting an `if (session.mode !== 'dm') return;` check.
//
// `session` is the per-socket object socketHandlers/*.js maintains, shaped
// like `{ mode: 'dm'|'player', name, characterId }`.
//
// All methods here are pure functions of their arguments with no state of
// their own, so they're `static` — grouping them as static methods on a
// named class (rather than free exported functions) is purely for
// consistency with the rest of the now-class-based server modules.

export class PermissionPolicy {
  static isDM(session) {
    return session.mode === 'dm';
  }

  static isOwnerOfToken(session, token) {
    return session.mode === 'player' && !!token.owner && token.owner.toLowerCase() === session.name.toLowerCase();
  }

  /** DM can move any token; a player can only move a token they own. */
  static canMoveToken(session, token) {
    return PermissionPolicy.isDM(session) || PermissionPolicy.isOwnerOfToken(session, token);
  }

  /**
   * Board-management actions (grid config, add/remove token, background
   * upload) are DM-only.
   */
  static canManageBoard(session) {
    return PermissionPolicy.isDM(session);
  }
}
