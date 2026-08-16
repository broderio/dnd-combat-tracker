export const EVENTS = {
  // client -> server
  JOIN: 'join',
  SET_GRID: 'set-grid',
  ADD_TOKEN: 'add-token',
  REMOVE_TOKEN: 'remove-token',
  MOVE_TOKEN: 'move-token',
  ADD_MONSTER_TOKEN: 'add-monster-token',
  UPDATE_MONSTER_INSTANCE: 'update-monster-instance',
  ADD_OVERLAY: 'add-overlay',
  REMOVE_OVERLAY: 'remove-overlay',
  SET_TURN_ORDER: 'set-turn-order',
  NEXT_TURN: 'next-turn',
  ROLL_DICE: 'roll-dice',

  // server -> client
  JOINED: 'joined',
  STATE: 'state',
  PRESENCE: 'presence',
  YOUR_CHARACTER: 'your-character',
  ALL_CHARACTERS: 'all-characters',
  PLAYERS_ONLINE: 'players-online',
  TOKEN_MOVED: 'token-moved',
  ALL_MONSTER_INSTANCES: 'all-monster-instances',
  DICE_ROLLED: 'dice-rolled',
};
