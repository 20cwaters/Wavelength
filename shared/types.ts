export type Team = 'red' | 'blue';
export type Side = 'left' | 'right';
export type GameMode = 'party' | 'teams';
export type Phase = 'lobby' | 'authoring' | 'clue' | 'guessing' | 'bonus' | 'reveal' | 'gameover';
export type Role = 'psychic' | 'guesser' | 'opponent' | 'spectator';
export type TopicSource = 'presets' | 'custom' | 'mix';

export interface SpectrumCard {
  id: string;
  left: string;
  right: string;
  /** Preset deck id, or 'custom' for player-submitted pairs. */
  deck: string;
  submittedBy?: string;
}

export interface GameSettings {
  /** 'party' (default): no teams — everyone writes clues up front, then all guess
   *  each dial individually. 'teams': classic two-team play. */
  mode: GameMode;
  /** Teams mode: first team to reach this score wins. */
  targetScore: number;
  /** Party mode: dials each player authors at game start. */
  cluesPerPlayer: number;
  /** Preset deck ids in play. Empty array means "all decks". */
  decks: string[];
  topicSource: TopicSource;
}

export interface PlayerView {
  id: string;
  name: string;
  team: Team | null;
  connected: boolean;
  isHost: boolean;
  isPsychic: boolean;
  tutorial: boolean;
}

// ---------- Teams mode ----------

export interface RoundResult {
  round: number;
  psychicId: string;
  psychicName: string;
  psychicTeam: Team;
  card: SpectrumCard;
  clue: string;
  target: number;
  guess: number;
  points: number;
  /** Which side the opposing team (majority) guessed, null if tied / no votes / solo round. */
  bonusSide: Side | null;
  /** Which side the target actually was relative to the locked pointer. */
  bonusCorrectSide: Side | null;
  bonusAwarded: boolean;
  bonusTeam: Team | null;
  skipped: boolean;
}

export interface BonusView {
  yourVote: Side | null;
  /** playerId -> vote. Only sent to the opposing (voting) team. */
  votes: Record<string, Side> | null;
  voted: number;
  needed: number;
}

// ---------- Party mode ----------

export interface AuthoringCardView {
  index: number;
  total: number;
  card: SpectrumCard;
  /** Only ever the viewer's own target. */
  target: number;
}

export interface AuthoringView {
  /** The next card you still need to write a clue for; null when you're done. */
  yourCard: AuthoringCardView | null;
  /** False for players who joined after the game started (they guess only). */
  participating: boolean;
  doneCount: number;
  totalAuthors: number;
  waitingFor: string[];
}

export interface PartyRoundView {
  dialNumber: number;
  totalDials: number;
  authorId: string;
  yourGuess: number | null;
  lockedCount: number;
  neededCount: number;
  /** Live in-progress guess positions (playerId -> value). Author-only; null for everyone else. */
  liveGuesses: Record<string, number> | null;
  /** Which players have locked in. Author-only; null for everyone else. */
  lockedIds: string[] | null;
}

export interface PartyGuessResult {
  playerId: string;
  name: string;
  value: number;
  points: number;
}

export interface PartyRoundResult {
  dialNumber: number;
  totalDials: number;
  authorId: string;
  authorName: string;
  card: SpectrumCard;
  clue: string;
  target: number;
  guesses: PartyGuessResult[];
  /** Clue writer's reward: the average of the guessers' points, rounded. */
  authorPoints: number;
}

// ---------- Shared view ----------

export interface RoomView {
  code: string;
  mode: GameMode;
  phase: Phase;
  round: number;
  you: PlayerView & { role: Role };
  players: PlayerView[];
  hostId: string;
  settings: GameSettings;
  customTopicCount: number;

  /** Current card/clue: public per phase rules; null while hidden. */
  card: SpectrumCard | null;
  clue: string | null;
  /** Hidden target — only present for the psychic/author, or at reveal/gameover. */
  target: number | null;
  pointer: number;
  locked: boolean;
  psychicId: string | null;

  // Teams mode
  scores: Record<Team, number>;
  psychicTeam: Team | null;
  /** True when the psychic had no teammates, so the other team moves the dial (no bonus guess). */
  soloRound: boolean;
  bonus: BonusView | null;
  lastResult: RoundResult | null;
  history: RoundResult[];
  winner: Team | null;

  // Party mode
  authoring: AuthoringView | null;
  party: PartyRoundView | null;
  partyScores: Record<string, number>;
  partyLastResult: PartyRoundResult | null;
  partyHistory: PartyRoundResult[];
}

export type AckRes<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (
    p: { name: string; playerKey: string; tutorial: boolean; settings?: Partial<GameSettings> },
    ack: (r: AckRes<{ code: string }>) => void,
  ) => void;
  'room:join': (
    p: { code: string; name: string; playerKey: string; tutorial: boolean },
    ack: (r: AckRes<{ code: string }>) => void,
  ) => void;
  'room:leave': () => void;
  'team:set': (p: { team: Team }, ack: (r: AckRes) => void) => void;
  'settings:set': (p: Partial<GameSettings>, ack: (r: AckRes) => void) => void;
  'tutorial:set': (p: { tutorial: boolean }, ack: (r: AckRes) => void) => void;
  'game:start': (ack: (r: AckRes) => void) => void;
  'topic:add': (p: { left: string; right: string }, ack: (r: AckRes<{ count: number }>) => void) => void;
  'clue:set': (p: { clue: string }, ack: (r: AckRes) => void) => void;
  'pointer:set': (p: { value: number }) => void;
  'guess:lock': (ack: (r: AckRes) => void) => void;
  'bonus:vote': (p: { side: Side }, ack: (r: AckRes) => void) => void;
  'author:clue': (p: { clue: string }, ack: (r: AckRes) => void) => void;
  'party:pointer': (p: { value: number }) => void;
  'party:lock': (p: { value: number }, ack: (r: AckRes) => void) => void;
  'round:next': (ack: (r: AckRes) => void) => void;
  'round:skip': (ack: (r: AckRes) => void) => void;
  'game:rematch': (ack: (r: AckRes) => void) => void;
}

export interface ServerToClientEvents {
  state: (view: RoomView) => void;
  pointer: (value: number) => void;
  /** Party mode: live guess positions, streamed to the current dial's author only. */
  partyLive: (guesses: Record<string, number>) => void;
}
