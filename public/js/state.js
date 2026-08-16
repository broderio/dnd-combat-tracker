import { Grid, TurnOrder } from '/shared/schema.js';

export class ClientState {
  constructor() {
    this.session = { mode: null, name: null }; // {mode: 'dm'|'player', name: string}

    this.board = {
      background: null,
      grid: Grid.default(),
      tokens: {},
      overlays: {},
      turnOrder: TurnOrder.default(),
      combatantStatuses: {},
    };

    this.boardTool = { type: 'none' }; // used to specify the current DM action
    this.currentUsername = null; // set after successful login
    this.currentCharacters = []; // this user's saved characters (from login / CRUD responses)
    this.activeCharacter = null; // the character this player picked for this session
    this.onlinePlayers = []; // [{username: str, characterName: str}] - name only (no stats), players and DMs
    this.dmRoster = []; // [{username: str, character: Character}] - full stats, DM only
    this.publicRoster = []; // [{username: str, character: {name,hp,abilityScores,spellSlots}}] - read-only, all clients
    this.dmMonsterInstances = {}; // {id: MonsterInstance.toJSON()} - full stats, DM only
  }

  setBoardTool(tool) {
    this.boardTool = tool;
  }

  setCurrentUsername(username) {
    this.currentUsername = username;
  }

  setCurrentCharacters(characters) {
    this.currentCharacters = characters;
  }

  setActiveCharacter(character) {
    this.activeCharacter = character;
  }

  setOnlinePlayers(list) {
    this.onlinePlayers = list;
  }

  setDmRoster(roster) {
    this.dmRoster = roster;
  }

  setPublicRoster(list) {
    this.publicRoster = list;
  }

  setDmMonsterInstances(instances) {
    this.dmMonsterInstances = instances;
  }

  setSession(mode, name) {
    this.session.mode = mode;
    this.session.name = name;
  }

  setBoard(newBoard) {
    Object.assign(this.board, newBoard);
  }
}

export const clientState = new ClientState();
