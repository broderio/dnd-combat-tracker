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
