// In-memory room/game state. Rooms are short-lived party sessions, so there is
// no persistence — a server restart clears all games.
//
// Two modes:
//   'party' (default): no teams. Everyone writes clues for N dials up front,
//     the dials are shuffled, and each round every other player guesses on
//     their own private dial. Individual leaderboard.
//   'teams' (classic): two teams, one Psychic per round, opposing-team bonus.

import {
  DEFAULT_CLUES_PER_PLAYER,
  DEFAULT_TARGET_SCORE,
  MAX_CLUES_PER_PLAYER,
  MAX_CLUE_LEN,
  MAX_CUSTOM_TOPICS,
  MAX_TARGET_SCORE,
  MIN_CLUES_PER_PLAYER,
  MIN_TARGET_SCORE,
} from '../../shared/constants';
import {
  checkWinner,
  clampDial,
  drawCard,
  partyAuthorPoints,
  pickPsychic,
  randomTarget,
  resolveBonus,
  scoreGuess,
  shuffleInPlace,
  validateTopic,
} from '../../shared/game';
import { DECKS, PRESET_TOPICS } from '../../shared/topics';
import type {
  AuthoringView,
  BonusView,
  GameMode,
  GameSettings,
  PartyGuessResult,
  PartyRoundResult,
  PartyRoundView,
  Phase,
  PlayerView,
  Role,
  RoomView,
  RoundResult,
  Side,
  SpectrumCard,
  Team,
  TopicSource,
} from '../../shared/types';

/** Errors safe to show to players (sent back through the socket ack). */
export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg);
};

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function rid(len: number, alphabet: string): string {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const otherTeam = (t: Team): Team => (t === 'red' ? 'blue' : 'red');

const KNOWN_DECKS = new Set(DECKS.map((d) => d.id));
const TOPIC_SOURCES: TopicSource[] = ['presets', 'custom', 'mix'];
const GAME_MODES: GameMode[] = ['party', 'teams'];

export const defaultSettings = (): GameSettings => ({
  mode: 'party',
  targetScore: DEFAULT_TARGET_SCORE,
  cluesPerPlayer: DEFAULT_CLUES_PER_PLAYER,
  decks: DECKS.map((d) => d.id),
  topicSource: 'mix',
});

export function sanitizeSettings(partial: Partial<GameSettings> | undefined, base: GameSettings): GameSettings {
  const s: GameSettings = { ...base, decks: [...base.decks] };
  if (!partial || typeof partial !== 'object') return s;
  if (GAME_MODES.includes(partial.mode as GameMode)) s.mode = partial.mode as GameMode;
  if (typeof partial.targetScore === 'number' && Number.isFinite(partial.targetScore)) {
    s.targetScore = Math.min(MAX_TARGET_SCORE, Math.max(MIN_TARGET_SCORE, Math.round(partial.targetScore)));
  }
  if (typeof partial.cluesPerPlayer === 'number' && Number.isFinite(partial.cluesPerPlayer)) {
    s.cluesPerPlayer = Math.min(
      MAX_CLUES_PER_PLAYER,
      Math.max(MIN_CLUES_PER_PLAYER, Math.round(partial.cluesPerPlayer)),
    );
  }
  if (Array.isArray(partial.decks)) {
    s.decks = partial.decks.filter((d): d is string => typeof d === 'string' && KNOWN_DECKS.has(d));
  }
  if (TOPIC_SOURCES.includes(partial.topicSource as TopicSource)) {
    s.topicSource = partial.topicSource as TopicSource;
  }
  return s;
}

export const cleanStr = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

interface Player {
  id: string;
  /** Secret reconnect key supplied by the client; never sent to other players. */
  key: string;
  name: string;
  team: Team | null;
  connected: boolean;
  joinedAt: number;
  lastPsychicRound: number;
  tutorial: boolean;
  socketId: string | null;
}

interface Round {
  number: number;
  psychicId: string;
  psychicTeam: Team;
  /** Psychic had no teammates: the opposing team moves the dial, no bonus guess. */
  soloRound: boolean;
  card: SpectrumCard;
  target: number;
  clue: string | null;
  pointer: number;
  locked: boolean;
  votes: Map<string, Side>;
}

interface Assignment {
  card: SpectrumCard;
  target: number;
  clue: string | null;
}

interface PartyDial {
  authorId: string;
  card: SpectrumCard;
  target: number;
  clue: string;
}

export class Room {
  code: string;
  hostId = '';
  players: Player[] = [];
  settings: GameSettings;
  phase: Phase = 'lobby';
  customTopics: SpectrumCard[] = [];
  private customSeq = 0;
  usedIds = new Set<string>();
  lastActivity = Date.now();
  roundNo = 0;

  // Teams mode
  scores: Record<Team, number> = { red: 0, blue: 0 };
  startingTeam: Team = 'red';
  round: Round | null = null;
  history: RoundResult[] = [];
  lastResult: RoundResult | null = null;
  winner: Team | null = null;

  // Party mode
  assignments = new Map<string, Assignment[]>();
  dials: PartyDial[] = [];
  dialIndex = 0;
  partyGuesses = new Map<string, number>();
  /** In-progress guess positions for the current dial — shown live to its author only. */
  partyLive = new Map<string, number>();
  partyScores = new Map<string, number>();
  partyHistory: PartyRoundResult[] = [];
  partyLastResult: PartyRoundResult | null = null;

  constructor(code: string, settings?: Partial<GameSettings>) {
    this.code = code;
    this.settings = sanitizeSettings(settings, defaultSettings());
  }

  touch(): void {
    this.lastActivity = Date.now();
  }

  private player(id: string): Player {
    return this.players.find((p) => p.id === id) ?? fail('Player not found');
  }

  /** Join as a new player, or reclaim an existing seat by reconnect key. */
  addOrReclaim(key: string, name: string, tutorial: boolean, socketId: string): Player {
    this.touch();
    const existing = this.players.find((p) => p.key === key);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      if (name) existing.name = name;
      return existing;
    }
    const player: Player = {
      id: rid(10, ID_ALPHABET),
      key,
      name: name || 'Player',
      team: null,
      connected: true,
      joinedAt: Date.now(),
      lastPsychicRound: -1,
      tutorial,
      socketId,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    return player;
  }

  markDisconnected(playerId: string): void {
    this.touch();
    const p = this.player(playerId);
    p.connected = false;
    p.socketId = null;
    if (this.hostId === p.id) {
      const next = this.players
        .filter((q) => q.connected)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) this.hostId = next.id;
    }
    // Don't leave a phase stuck waiting on input that will never come.
    if (this.settings.mode === 'party') {
      if (this.phase === 'authoring') this.maybeFinishAuthoring();
      else if (this.phase === 'guessing') this.checkPartyComplete();
    } else if (this.phase === 'bonus') {
      this.checkBonusComplete();
    }
  }

  private currentDial(): PartyDial | undefined {
    return this.dials[this.dialIndex];
  }

  roleOf(p: Player): Role {
    if (this.settings.mode === 'party') {
      const dial = this.currentDial();
      if (dial && ['guessing', 'reveal', 'gameover'].includes(this.phase)) {
        return p.id === dial.authorId ? 'psychic' : 'guesser';
      }
      return 'guesser';
    }
    const r = this.round;
    if (!r || p.team === null) return 'spectator';
    if (p.id === r.psychicId) return 'psychic';
    if (r.soloRound) return 'guesser';
    return p.team === r.psychicTeam ? 'guesser' : 'opponent';
  }

  private teamMembers(team: Team): Player[] {
    return this.players.filter((p) => p.team === team);
  }

  private connectedOpponents(): Player[] {
    const r = this.round;
    if (!r || r.soloRound) return [];
    return this.players.filter(
      (p) => p.connected && p.team === otherTeam(r.psychicTeam) && p.id !== r.psychicId,
    );
  }

  setTeam(playerId: string, team: unknown): void {
    this.touch();
    if (team !== 'red' && team !== 'blue') fail('Pick red or blue');
    const p = this.player(playerId);
    const switchable: Phase[] = ['lobby', 'reveal', 'gameover'];
    if (p.team !== null && this.settings.mode === 'teams' && !switchable.includes(this.phase)) {
      fail('You can only switch teams between rounds');
    }
    p.team = team as Team;
  }

  setTutorial(playerId: string, on: boolean): void {
    this.player(playerId).tutorial = !!on;
  }

  setSettings(playerId: string, partial: Partial<GameSettings>): void {
    this.touch();
    if (playerId !== this.hostId) fail('Only the host can change settings');
    if (this.phase !== 'lobby') fail('Settings can only be changed in the lobby');
    this.settings = sanitizeSettings(partial, this.settings);
  }

  addTopic(playerId: string, left: unknown, right: unknown): number {
    this.touch();
    const p = this.player(playerId);
    const v = validateTopic(left, right);
    if (!v.ok) fail(v.error);
    if (this.customTopics.length >= MAX_CUSTOM_TOPICS) fail('The custom topic pool is full');
    const ok = v as { ok: true; left: string; right: string };
    this.customTopics.push({
      id: `custom-${++this.customSeq}`,
      left: ok.left,
      right: ok.right,
      deck: 'custom',
      submittedBy: p.name,
    });
    return this.customTopics.length;
  }

  private drawOne(): { card: SpectrumCard; target: number } {
    const drawn = drawCard(
      PRESET_TOPICS,
      this.customTopics,
      this.settings.topicSource,
      this.settings.decks,
      this.usedIds,
    );
    if (!drawn) fail('No topics available — add some custom topics or select a deck');
    const { card, resetUsed } = drawn!;
    if (resetUsed) this.usedIds.clear();
    this.usedIds.add(card.id);
    return { card, target: randomTarget() };
  }

  private resetGameState(): void {
    this.roundNo = 0;
    this.scores = { red: 0, blue: 0 };
    this.round = null;
    this.history = [];
    this.lastResult = null;
    this.winner = null;
    this.assignments = new Map();
    this.dials = [];
    this.dialIndex = 0;
    this.partyGuesses = new Map();
    this.partyLive = new Map();
    this.partyScores = new Map();
    this.partyHistory = [];
    this.partyLastResult = null;
    for (const p of this.players) p.lastPsychicRound = -1;
  }

  start(playerId: string): void {
    this.touch();
    if (playerId !== this.hostId) fail('Only the host can start the game');
    if (this.phase !== 'lobby') fail('The game is already running');
    this.resetGameState();

    if (this.settings.mode === 'party') {
      const participants = this.players.filter((p) => p.connected);
      if (participants.length < 2) fail('Party mode needs at least 2 players');
      for (const p of participants) {
        const cards: Assignment[] = [];
        for (let i = 0; i < this.settings.cluesPerPlayer; i++) {
          cards.push({ ...this.drawOne(), clue: null });
        }
        this.assignments.set(p.id, cards);
        this.partyScores.set(p.id, 0);
      }
      this.phase = 'authoring';
      return;
    }

    const red = this.teamMembers('red').filter((p) => p.connected).length;
    const blue = this.teamMembers('blue').filter((p) => p.connected).length;
    if (red < 1 || blue < 1) fail('Each team needs at least one player');
    this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
    this.beginRound();
  }

  // ---------- Party mode ----------

  authorClue(playerId: string, clue: unknown): void {
    this.touch();
    if (this.phase !== 'authoring') fail('Not collecting clues right now');
    const list = this.assignments.get(playerId) ?? fail('You have no cards this game — you can still guess!');
    const pending = (list as Assignment[]).find((a) => a.clue === null) ?? fail('All your clues are in');
    const c = cleanStr(clue, MAX_CLUE_LEN);
    if (!c) fail('Enter a clue first');
    (pending as Assignment).clue = c;
    this.maybeFinishAuthoring();
  }

  private maybeFinishAuthoring(): void {
    if (this.phase !== 'authoring') return;
    const stillWriting = [...this.assignments.entries()].some(([pid, list]) => {
      const p = this.players.find((q) => q.id === pid);
      return p?.connected && list.some((a) => a.clue === null);
    });
    if (stillWriting) return;
    const anyAuthored = [...this.assignments.values()].some((list) => list.some((a) => a.clue !== null));
    if (anyAuthored) this.buildDials();
  }

  /** Collect all authored dials, shuffle, and start the first guessing round.
   *  Unwritten clues (disconnected/AFK players) are simply dropped. */
  private buildDials(): void {
    const dials: PartyDial[] = [];
    for (const [pid, list] of this.assignments) {
      for (const a of list) {
        if (a.clue !== null) dials.push({ authorId: pid, card: a.card, target: a.target, clue: a.clue });
      }
    }
    if (dials.length === 0) fail('Nobody has written a clue yet');
    shuffleInPlace(dials);
    this.dials = dials;
    this.dialIndex = 0;
    this.beginPartyDial();
  }

  private beginPartyDial(): void {
    this.partyGuesses = new Map();
    this.partyLive = new Map();
    this.partyLastResult = null;
    this.roundNo = this.dialIndex + 1;
    this.phase = 'guessing';
  }

  /** Record a guesser's in-progress dial position. Returns the author's socket
   *  id (for a targeted live update) or null when the move is ignored. */
  partySetLive(playerId: string, value: number): string | null {
    if (this.settings.mode !== 'party' || this.phase !== 'guessing') return null;
    const dial = this.currentDial();
    if (!dial || playerId === dial.authorId) return null;
    if (this.partyGuesses.has(playerId)) return null; // locked — position is final
    if (!Number.isFinite(value)) return null;
    this.partyLive.set(playerId, clampDial(value));
    this.touch();
    const author = this.players.find((p) => p.id === dial.authorId);
    return author?.connected ? author.socketId : null;
  }

  partyLock(playerId: string, value: number): void {
    this.touch();
    if (this.settings.mode !== 'party') fail('Not in party mode');
    if (this.phase !== 'guessing') fail('No dial to guess right now');
    const dial = this.currentDial() ?? fail('No dial to guess right now');
    if (playerId === (dial as PartyDial).authorId) fail('You wrote this clue — you sit this one out');
    if (this.partyGuesses.has(playerId)) fail('You already locked in');
    if (!Number.isFinite(value)) fail('Invalid guess');
    this.player(playerId); // validate membership
    const clamped = clampDial(value);
    this.partyGuesses.set(playerId, clamped);
    this.partyLive.set(playerId, clamped); // author's live view shows the final position
    this.checkPartyComplete();
  }

  private connectedPartyGuessers(authorId: string): Player[] {
    return this.players.filter((p) => p.connected && p.id !== authorId);
  }

  checkPartyComplete(): void {
    if (this.settings.mode !== 'party' || this.phase !== 'guessing') return;
    const dial = this.currentDial();
    if (!dial) return;
    const guessers = this.connectedPartyGuessers(dial.authorId);
    if (guessers.length > 0 && guessers.every((g) => this.partyGuesses.has(g.id))) {
      this.resolvePartyDial();
    }
  }

  private resolvePartyDial(): void {
    const dial = this.currentDial()!;
    const guesses: PartyGuessResult[] = [...this.partyGuesses].map(([pid, value]) => ({
      playerId: pid,
      name: this.players.find((p) => p.id === pid)?.name ?? '?',
      value,
      points: scoreGuess(dial.target, value),
    }));
    guesses.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    for (const g of guesses) {
      this.partyScores.set(g.playerId, (this.partyScores.get(g.playerId) ?? 0) + g.points);
    }
    const authorPoints = partyAuthorPoints(guesses.map((g) => g.points));
    this.partyScores.set(dial.authorId, (this.partyScores.get(dial.authorId) ?? 0) + authorPoints);

    const result: PartyRoundResult = {
      dialNumber: this.dialIndex + 1,
      totalDials: this.dials.length,
      authorId: dial.authorId,
      authorName: this.players.find((p) => p.id === dial.authorId)?.name ?? '?',
      card: dial.card,
      clue: dial.clue,
      target: dial.target,
      guesses,
      authorPoints,
    };
    this.partyHistory.push(result);
    this.partyLastResult = result;
    this.phase = 'reveal';
  }

  private advancePartyDial(): void {
    if (this.dialIndex + 1 < this.dials.length) {
      this.dialIndex += 1;
      this.beginPartyDial();
    } else {
      this.phase = 'gameover';
    }
  }

  // ---------- Teams mode ----------

  private beginRound(): void {
    this.roundNo += 1;
    let team: Team = this.roundNo % 2 === 1 ? this.startingTeam : otherTeam(this.startingTeam);
    let psychicId = pickPsychic(this.teamMembers(team));
    if (!psychicId) {
      team = otherTeam(team);
      psychicId = pickPsychic(this.teamMembers(team));
    }
    if (!psychicId) fail('No connected players available to be the Psychic');
    const psychic = this.player(psychicId as string);
    psychic.lastPsychicRound = this.roundNo;

    const { card, target } = this.drawOne();
    const teammates = this.teamMembers(team).filter((p) => p.id !== psychic.id && p.connected);
    this.round = {
      number: this.roundNo,
      psychicId: psychic.id,
      psychicTeam: team,
      soloRound: teammates.length === 0,
      card,
      target,
      clue: null,
      pointer: 90,
      locked: false,
      votes: new Map(),
    };
    this.lastResult = null;
    this.phase = 'clue';
  }

  submitClue(playerId: string, clue: unknown): void {
    this.touch();
    const r = this.round ?? fail('No round in progress');
    if (this.phase !== 'clue') fail('Not waiting for a clue right now');
    if (playerId !== r.psychicId) fail('Only the Psychic gives the clue');
    const c = cleanStr(clue, MAX_CLUE_LEN);
    if (!c) fail('Enter a clue first');
    r.clue = c;
    this.phase = 'guessing';
  }

  setPointer(playerId: string, value: number): void {
    const r = this.round ?? fail('No round in progress');
    if (this.phase !== 'guessing' || r.locked) fail('The dial is locked');
    if (this.roleOf(this.player(playerId)) !== 'guesser') fail('Only the guessing team moves the dial');
    r.pointer = clampDial(value);
    this.touch();
  }

  lockGuess(playerId: string): void {
    this.touch();
    const r = this.round ?? fail('No round in progress');
    if (this.phase !== 'guessing' || r.locked) fail('Nothing to lock right now');
    if (this.roleOf(this.player(playerId)) !== 'guesser') fail('Only the guessing team can lock in');
    r.locked = true;
    if (r.soloRound || this.connectedOpponents().length === 0) {
      this.finishRound();
    } else {
      this.phase = 'bonus';
    }
  }

  voteBonus(playerId: string, side: unknown): void {
    this.touch();
    const r = this.round ?? fail('No round in progress');
    if (this.phase !== 'bonus') fail('No bonus guess is being collected');
    if (side !== 'left' && side !== 'right') fail('Vote left or right');
    if (this.roleOf(this.player(playerId)) !== 'opponent') fail('Only the opposing team votes');
    r.votes.set(playerId, side as Side);
    this.checkBonusComplete();
  }

  checkBonusComplete(): void {
    const r = this.round;
    if (!r || this.phase !== 'bonus') return;
    const opponents = this.connectedOpponents();
    if (opponents.every((p) => r.votes.has(p.id))) this.finishRound();
  }

  private finishRound(): void {
    const r = this.round!;
    const points = scoreGuess(r.target, r.pointer);
    const bonus = resolveBonus([...r.votes.values()], r.target, r.pointer, points);
    this.scores[r.psychicTeam] += points;
    const bonusTeam = r.soloRound ? null : otherTeam(r.psychicTeam);
    if (bonus.awarded && bonusTeam) this.scores[bonusTeam] += 1;
    this.winner = checkWinner(this.scores, this.settings.targetScore);
    const result: RoundResult = {
      round: r.number,
      psychicId: r.psychicId,
      psychicName: this.player(r.psychicId).name,
      psychicTeam: r.psychicTeam,
      card: r.card,
      clue: r.clue ?? '',
      target: r.target,
      guess: r.pointer,
      points,
      bonusSide: r.soloRound ? null : bonus.side,
      bonusCorrectSide: bonus.correctSide,
      bonusAwarded: bonus.awarded && bonusTeam !== null,
      bonusTeam,
      skipped: false,
    };
    this.history.push(result);
    this.lastResult = result;
    this.phase = 'reveal';
  }

  // ---------- Shared flow ----------

  nextRound(playerId: string): void {
    this.touch();
    if (this.phase !== 'reveal') fail('The round is not over yet');
    if (this.settings.mode === 'party') {
      const dial = this.currentDial();
      if (playerId !== this.hostId && playerId !== dial?.authorId) {
        fail('Only the host or the clue writer can continue');
      }
      this.advancePartyDial();
      return;
    }
    const isPsychic = this.round?.psychicId === playerId;
    if (playerId !== this.hostId && !isPsychic) fail('Only the host or the Psychic can continue');
    if (this.winner) {
      this.phase = 'gameover';
    } else {
      this.beginRound();
    }
  }

  skipRound(playerId: string): void {
    this.touch();
    if (playerId !== this.hostId) fail('Only the host can skip');
    if (this.settings.mode === 'party') {
      if (this.phase === 'authoring') {
        this.buildDials(); // force start — drops unwritten clues, throws if none exist
      } else if (this.phase === 'guessing') {
        this.advancePartyDial(); // abandon this dial, nobody scores
      } else {
        fail('Nothing to skip right now');
      }
      return;
    }
    const r = this.round ?? fail('No round in progress');
    const active: Phase[] = ['clue', 'guessing', 'bonus'];
    if (!active.includes(this.phase)) fail('Nothing to skip right now');
    const result: RoundResult = {
      round: r.number,
      psychicId: r.psychicId,
      psychicName: this.player(r.psychicId).name,
      psychicTeam: r.psychicTeam,
      card: r.card,
      clue: r.clue ?? '',
      target: r.target,
      guess: r.pointer,
      points: 0,
      bonusSide: null,
      bonusCorrectSide: null,
      bonusAwarded: false,
      bonusTeam: null,
      skipped: true,
    };
    this.history.push(result);
    this.lastResult = result;
    this.phase = 'reveal';
  }

  rematch(playerId: string): void {
    this.touch();
    if (playerId !== this.hostId) fail('Only the host can start a rematch');
    if (this.phase !== 'gameover') fail('The game is not over yet');
    this.resetGameState();
    this.phase = 'lobby'; // back to the lobby so settings/teams can change
  }

  // ---------- Views ----------

  private playerView(p: Player): PlayerView {
    const isPsychic =
      this.settings.mode === 'party'
        ? this.phase !== 'authoring' && this.currentDial()?.authorId === p.id
        : this.round?.psychicId === p.id;
    return {
      id: p.id,
      name: p.name,
      team: p.team,
      connected: p.connected,
      isHost: p.id === this.hostId,
      isPsychic,
      tutorial: p.tutorial,
    };
  }

  private authoringViewFor(me: Player): AuthoringView {
    const mine = this.assignments.get(me.id);
    let yourCard: AuthoringView['yourCard'] = null;
    if (mine) {
      const done = mine.filter((a) => a.clue !== null).length;
      const pending = mine.find((a) => a.clue === null);
      if (pending) {
        yourCard = { index: done + 1, total: mine.length, card: pending.card, target: pending.target };
      }
    }
    const entries = [...this.assignments.entries()];
    return {
      yourCard,
      participating: !!mine,
      doneCount: entries.filter(([, list]) => list.every((a) => a.clue !== null)).length,
      totalAuthors: entries.length,
      waitingFor: entries
        .filter(([, list]) => list.some((a) => a.clue === null))
        .map(([pid]) => this.players.find((p) => p.id === pid)?.name ?? '?'),
    };
  }

  /** Build the personalized, hidden-info-safe state for one player. */
  viewFor(playerId: string): RoomView {
    const me = this.player(playerId);
    const role = this.roleOf(me);

    const base: RoomView = {
      code: this.code,
      mode: this.settings.mode,
      phase: this.phase,
      round: this.roundNo,
      you: { ...this.playerView(me), role },
      players: this.players.map((p) => this.playerView(p)),
      hostId: this.hostId,
      settings: this.settings,
      customTopicCount: this.customTopics.length,
      card: null,
      clue: null,
      target: null,
      pointer: 90,
      locked: false,
      psychicId: null,
      scores: { ...this.scores },
      psychicTeam: null,
      soloRound: false,
      bonus: null,
      lastResult: null,
      history: this.history,
      winner: this.winner,
      authoring: null,
      party: null,
      partyScores: Object.fromEntries(this.partyScores),
      partyLastResult: null,
      partyHistory: this.partyHistory,
    };

    if (this.settings.mode === 'party') {
      if (this.phase === 'authoring') {
        return { ...base, authoring: this.authoringViewFor(me) };
      }
      const dial = ['guessing', 'reveal', 'gameover'].includes(this.phase) ? this.currentDial() : undefined;
      if (!dial) return base;
      const isAuthor = dial.authorId === me.id;
      // Your own target while authoring/authored; everyone's at reveal.
      const targetVisible = isAuthor || this.phase !== 'guessing';
      return {
        ...base,
        card: dial.card,
        clue: dial.clue,
        target: targetVisible ? dial.target : null,
        locked: this.partyGuesses.has(me.id),
        psychicId: dial.authorId,
        party: {
          dialNumber: this.dialIndex + 1,
          totalDials: this.dials.length,
          authorId: dial.authorId,
          yourGuess: this.partyGuesses.get(me.id) ?? null,
          lockedCount: this.partyGuesses.size,
          neededCount: this.connectedPartyGuessers(dial.authorId).length,
          liveGuesses:
            isAuthor && this.phase === 'guessing' ? Object.fromEntries(this.partyLive) : null,
          lockedIds: isAuthor ? [...this.partyGuesses.keys()] : null,
        },
        partyLastResult:
          this.phase === 'reveal' || this.phase === 'gameover' ? this.partyLastResult : null,
      };
    }

    // Teams mode
    const r = this.round;
    const cardVisible = r !== null && this.phase !== 'lobby' && (this.phase !== 'clue' || role === 'psychic');
    const targetVisible =
      r !== null && (role === 'psychic' || this.phase === 'reveal' || this.phase === 'gameover');

    let bonus: BonusView | null = null;
    if (r && this.phase === 'bonus') {
      bonus = {
        yourVote: r.votes.get(me.id) ?? null,
        votes: role === 'opponent' ? Object.fromEntries(r.votes) : null,
        voted: r.votes.size,
        needed: this.connectedOpponents().length,
      };
    }

    return {
      ...base,
      psychicId: r?.psychicId ?? null,
      psychicTeam: r?.psychicTeam ?? null,
      soloRound: r?.soloRound ?? false,
      card: cardVisible ? r!.card : null,
      clue: r?.clue ?? null,
      pointer: r?.pointer ?? 90,
      locked: r?.locked ?? false,
      target: targetVisible ? r!.target : null,
      bonus,
      lastResult: this.phase === 'reveal' || this.phase === 'gameover' ? this.lastResult : null,
    };
  }
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const ROOM_TTL_MS = 30 * 60 * 1000;

export class RoomManager {
  rooms = new Map<string, Room>();
  private bySocket = new Map<string, { code: string; playerId: string }>();

  constructor() {
    setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref?.();
  }

  get size(): number {
    return this.rooms.size;
  }

  create(
    key: string,
    name: string,
    tutorial: boolean,
    socketId: string,
    settings?: Partial<GameSettings>,
  ): { room: Room; player: Player } {
    let code = rid(4, CODE_ALPHABET);
    while (this.rooms.has(code)) code = rid(4, CODE_ALPHABET);
    const room = new Room(code, settings);
    this.rooms.set(code, room);
    const player = room.addOrReclaim(key, name, tutorial, socketId);
    this.bySocket.set(socketId, { code, playerId: player.id });
    return { room, player };
  }

  join(
    rawCode: string,
    key: string,
    name: string,
    tutorial: boolean,
    socketId: string,
  ): { room: Room; player: Player } {
    const code = rawCode.toUpperCase().trim();
    const room = this.rooms.get(code) ?? fail('Room not found — check the code');
    const existing = room.players.find((p) => p.key === key);
    // A reconnecting player may still have a stale socket mapping (e.g. refresh).
    if (existing?.socketId) this.bySocket.delete(existing.socketId);
    const player = room.addOrReclaim(key, name, tutorial, socketId);
    this.bySocket.set(socketId, { code, playerId: player.id });
    return { room, player };
  }

  /** Resolve the room + player for a connected socket, or throw. */
  ctx(socketId: string): { room: Room; player: Player } {
    const entry = this.bySocket.get(socketId) ?? fail('You are not in a room');
    const room = this.rooms.get(entry.code) ?? fail('Room no longer exists');
    const player = room.players.find((p) => p.id === entry.playerId) ?? fail('Player not found');
    return { room, player };
  }

  /** Handle a socket going away. Returns the affected room, if any. */
  disconnect(socketId: string): Room | null {
    const entry = this.bySocket.get(socketId);
    if (!entry) return null;
    this.bySocket.delete(socketId);
    const room = this.rooms.get(entry.code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === entry.playerId);
    if (player && player.socketId === socketId) room.markDisconnected(player.id);
    return room;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const allGone = room.players.every((p) => !p.connected);
      if (allGone && now - room.lastActivity > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }
}
