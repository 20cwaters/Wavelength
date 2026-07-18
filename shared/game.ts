// Pure game logic shared by server, client, and tests. No side effects; all
// randomness is injectable for testability.

import {
  DIAL_MAX,
  DIAL_MIN,
  MAX_TOPIC_LEN,
  MIN_TOPIC_LEN,
  TARGET_MAX,
  TARGET_MIN,
  WEDGE_WIDTH,
} from './constants';
import type { Side, SpectrumCard, Team, TopicSource } from './types';

export type Points = 0 | 2 | 3 | 4;

/** Distance-based wedge scoring: 4 for the bullseye wedge, 3 and 2 for the
 *  flanking wedges, 0 outside the zone. Boundaries are inclusive. */
export function scoreGuess(target: number, guess: number): Points {
  const d = Math.abs(target - guess);
  const half = WEDGE_WIDTH / 2;
  if (d <= half) return 4;
  if (d <= half + WEDGE_WIDTH) return 3;
  if (d <= half + WEDGE_WIDTH * 2) return 2;
  return 0;
}

/** The five wedge bands around a target, ordered left to right. */
export function wedgeRanges(target: number): { from: number; to: number; points: 2 | 3 | 4 }[] {
  const h = WEDGE_WIDTH / 2;
  return [
    { from: target - h - WEDGE_WIDTH * 2, to: target - h - WEDGE_WIDTH, points: 2 },
    { from: target - h - WEDGE_WIDTH, to: target - h, points: 3 },
    { from: target - h, to: target + h, points: 4 },
    { from: target + h, to: target + h + WEDGE_WIDTH, points: 3 },
    { from: target + h + WEDGE_WIDTH, to: target + h + WEDGE_WIDTH * 2, points: 2 },
  ];
}

/** Which side of the locked pointer the target actually sits on (null if dead on). */
export function targetSideOfPointer(target: number, pointer: number): Side | null {
  if (target < pointer) return 'left';
  if (target > pointer) return 'right';
  return null;
}

export function majoritySide(votes: Side[]): Side | null {
  let left = 0;
  let right = 0;
  for (const v of votes) {
    if (v === 'left') left++;
    else right++;
  }
  if (left === right) return null;
  return left > right ? 'left' : 'right';
}

/** Resolve the opposing team's left/right bonus guess. Standard Wavelength
 *  rule: no bonus point is available when the guessing team hit the bullseye. */
export function resolveBonus(
  votes: Side[],
  target: number,
  pointer: number,
  points: Points,
): { side: Side | null; correctSide: Side | null; awarded: boolean } {
  const side = majoritySide(votes);
  const correctSide = targetSideOfPointer(target, pointer);
  const awarded = points !== 4 && side !== null && side === correctSide;
  return { side, correctSide, awarded };
}

export function clampDial(v: number): number {
  return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(v)));
}

export function randomTarget(rand: () => number = Math.random): number {
  return TARGET_MIN + Math.floor(rand() * (TARGET_MAX - TARGET_MIN + 1));
}

export interface PsychicCandidate {
  id: string;
  joinedAt: number;
  lastPsychicRound: number;
  connected: boolean;
}

/** Fair rotation: the connected team member who has waited longest since being
 *  psychic goes next (ties broken by join order). */
export function pickPsychic(members: PsychicCandidate[]): string | null {
  const eligible = members.filter((m) => m.connected);
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.lastPsychicRound - b.lastPsychicRound || a.joinedAt - b.joinedAt);
  return eligible[0].id;
}

/** First team to reach the target score wins — but if both teams are tied at
 *  or above it, play continues (sudden death). */
export function checkWinner(scores: Record<Team, number>, targetScore: number): Team | null {
  const { red, blue } = scores;
  if (red < targetScore && blue < targetScore) return null;
  if (red === blue) return null;
  return red > blue ? 'red' : 'blue';
}

export type TopicValidation =
  | { ok: true; left: string; right: string }
  | { ok: false; error: string };

export function validateTopic(left: unknown, right: unknown): TopicValidation {
  const l = typeof left === 'string' ? left.trim() : '';
  const r = typeof right === 'string' ? right.trim() : '';
  if (!l || !r) return { ok: false, error: 'Fill in both ends of the spectrum' };
  if (l.length < MIN_TOPIC_LEN || r.length < MIN_TOPIC_LEN)
    return { ok: false, error: `Each side needs at least ${MIN_TOPIC_LEN} characters` };
  if (l.length > MAX_TOPIC_LEN || r.length > MAX_TOPIC_LEN)
    return { ok: false, error: `Keep each side under ${MAX_TOPIC_LEN} characters` };
  if (l.toLowerCase() === r.toLowerCase())
    return { ok: false, error: 'The two ends must be different' };
  return { ok: true, left: l, right: r };
}

/** Draw the next card for a round. `usedIds` avoids repeats; when a pool is
 *  exhausted the caller should clear it (signalled via `resetUsed`). In 'mix'
 *  mode custom topics get a 50/50 shot whenever any are unused, so player
 *  submissions actually come up. */
export function drawCard(
  presets: SpectrumCard[],
  custom: SpectrumCard[],
  source: TopicSource,
  deckIds: string[],
  usedIds: ReadonlySet<string>,
  rand: () => number = Math.random,
): { card: SpectrumCard; resetUsed: boolean } | null {
  const deckSet = new Set(deckIds);
  const presetPool = presets.filter((c) => deckSet.size === 0 || deckSet.has(c.deck));

  let pools: SpectrumCard[][];
  if (source === 'custom') pools = custom.length > 0 ? [custom] : [presetPool];
  else if (source === 'mix') pools = custom.length > 0 ? [presetPool, custom] : [presetPool];
  else pools = [presetPool];

  const all = pools.flat();
  if (all.length === 0) return null;

  let unusedPools = pools.map((p) => p.filter((c) => !usedIds.has(c.id))).filter((p) => p.length > 0);
  const resetUsed = unusedPools.length === 0;
  if (resetUsed) unusedPools = pools.filter((p) => p.length > 0);

  const pool =
    unusedPools.length === 1 ? unusedPools[0] : unusedPools[Math.floor(rand() * unusedPools.length)];
  const card = pool[Math.floor(rand() * pool.length)];
  return { card, resetUsed };
}

/** Party mode: the clue writer earns the average of the guessers' points,
 *  rounded to the nearest whole point (0 with no guessers). */
export function partyAuthorPoints(guessPoints: number[]): number {
  if (guessPoints.length === 0) return 0;
  return Math.round(guessPoints.reduce((a, b) => a + b, 0) / guessPoints.length);
}

/** Fisher–Yates shuffle (in place); randomness injectable for tests. */
export function shuffleInPlace<T>(arr: T[], rand: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
