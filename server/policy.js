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

  /**
   * Checks a submitted username/pin pair against the single DM record
   * (`db.dm`) stored in data/db.json — used by both the REST /api/dm-login
   * route and the socket JOIN handler (which re-checks since a client could
   * forge the join message). Username match is case-insensitive; pin match
   * is exact.
   */
  static verifyDmCredentials(dm, name, pin) {
    if (!dm) return false;
    const normalizedName = String(name || '').trim().toLowerCase();
    const normalizedPin = String(pin || '').trim();
    return dm.username.toLowerCase() === normalizedName && dm.pin === normalizedPin;
  }

  /**
   * Invokes `fn(socket)` for every currently-connected socket whose session
   * is in DM mode — used to push DM-only data (full character/monster
   * stats) without broadcasting it to players.
   */
  static forEachDmSocket(io, fn) {
    for (const [, socket] of io.sockets.sockets) {
      if (socket.data.session && socket.data.session.mode === 'dm') {
        fn(socket);
      }
    }
  }
}
