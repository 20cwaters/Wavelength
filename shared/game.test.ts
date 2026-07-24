import { describe, expect, it } from 'vitest';
import {
  DIAL_MAX,
  DIAL_MIN,
  TARGET_MAX,
  TARGET_MIN,
  WEDGE_WIDTH,
} from './constants';
import {
  checkWinner,
  clampDial,
  drawCard,
  majoritySide,
  partyAuthorPoints,
  pickPsychic,
  randomTarget,
  resolveBonus,
  scoreGuess,
  shuffleInPlace,
  targetSideOfPointer,
  validateTopic,
  wedgeRanges,
} from './game';
import { DECKS, PRESET_TOPICS } from './topics';
import type { SpectrumCard } from './types';

const H = WEDGE_WIDTH / 2;

describe('scoreGuess', () => {
  it('scores a perfect guess as a bullseye', () => {
    expect(scoreGuess(90, 90)).toBe(4);
  });

  it('scores wedge boundaries inclusively', () => {
    expect(scoreGuess(90, 90 + H)).toBe(4);
    expect(scoreGuess(90, 90 - H)).toBe(4);
    expect(scoreGuess(90, 90 + H + WEDGE_WIDTH)).toBe(3);
    expect(scoreGuess(90, 90 - H - WEDGE_WIDTH)).toBe(3);
    expect(scoreGuess(90, 90 + H + WEDGE_WIDTH * 2)).toBe(2);
    expect(scoreGuess(90, 90 - H - WEDGE_WIDTH * 2)).toBe(2);
  });

  it('scores just past each boundary as the next wedge out', () => {
    expect(scoreGuess(90, 90 + H + 0.01)).toBe(3);
    expect(scoreGuess(90, 90 + H + WEDGE_WIDTH + 0.01)).toBe(2);
    expect(scoreGuess(90, 90 + H + WEDGE_WIDTH * 2 + 0.01)).toBe(0);
  });

  it('scores far misses as zero', () => {
    expect(scoreGuess(30, 170)).toBe(0);
    expect(scoreGuess(170, 30)).toBe(0);
  });
});

describe('wedgeRanges', () => {
  it('produces five contiguous bands centered on the target', () => {
    const ranges = wedgeRanges(100);
    expect(ranges).toHaveLength(5);
    expect(ranges.map((r) => r.points)).toEqual([2, 3, 4, 3, 2]);
    expect(ranges[2].from).toBe(100 - H);
    expect(ranges[2].to).toBe(100 + H);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].from).toBe(ranges[i - 1].to);
    }
  });
});

describe('bonus guess', () => {
  it('identifies which side of the pointer the target is on', () => {
    expect(targetSideOfPointer(80, 100)).toBe('left');
    expect(targetSideOfPointer(120, 100)).toBe('right');
    expect(targetSideOfPointer(100, 100)).toBeNull();
  });

  it('resolves majority votes', () => {
    expect(majoritySide(['left', 'left', 'right'])).toBe('left');
    expect(majoritySide(['right'])).toBe('right');
    expect(majoritySide(['left', 'right'])).toBeNull();
    expect(majoritySide([])).toBeNull();
  });

  it('awards the bonus for a correct majority guess', () => {
    const r = resolveBonus(['left'], 80, 100, 2);
    expect(r).toEqual({ side: 'left', correctSide: 'left', awarded: true });
  });

  it('does not award the bonus for a wrong guess', () => {
    expect(resolveBonus(['right'], 80, 100, 2).awarded).toBe(false);
  });

  it('does not award the bonus on a bullseye round', () => {
    // Target 3 away from pointer is still inside the 4-point wedge.
    expect(resolveBonus(['left'], 97, 100, scoreGuess(97, 100)).awarded).toBe(false);
  });

  it('does not award the bonus on a tied vote or when target equals pointer', () => {
    expect(resolveBonus(['left', 'right'], 80, 100, 2).awarded).toBe(false);
    expect(resolveBonus(['left'], 100, 100, 0).awarded).toBe(false);
  });
});

describe('randomTarget / clampDial', () => {
  it('keeps targets within the safe margin', () => {
    expect(randomTarget(() => 0)).toBe(TARGET_MIN);
    expect(randomTarget(() => 0.9999)).toBe(TARGET_MAX);
    for (let i = 0; i < 200; i++) {
      const t = randomTarget();
      expect(t).toBeGreaterThanOrEqual(TARGET_MIN);
      expect(t).toBeLessThanOrEqual(TARGET_MAX);
    }
  });

  it('clamps and rounds dial values', () => {
    expect(clampDial(-50)).toBe(DIAL_MIN);
    expect(clampDial(999)).toBe(DIAL_MAX);
    expect(clampDial(90.4)).toBe(90);
    expect(clampDial(90.6)).toBe(91);
  });

  it('allows targets at the very edge of the dial', () => {
    expect(TARGET_MIN).toBe(DIAL_MIN);
    expect(TARGET_MAX).toBe(DIAL_MAX);
    // A dial pinned to the edge scores the bullseye on an edge target.
    expect(scoreGuess(DIAL_MIN, DIAL_MIN)).toBe(4);
    expect(scoreGuess(DIAL_MAX, DIAL_MAX)).toBe(4);
    expect(scoreGuess(DIAL_MAX, DIAL_MAX - Math.floor(H))).toBe(4);
    // The wedge zone may extend past the board — rendering clips it.
    const ranges = wedgeRanges(DIAL_MIN);
    expect(ranges[0].from).toBeLessThan(0);
    expect(ranges[2].from).toBeLessThanOrEqual(DIAL_MIN);
  });
});

describe('pickPsychic', () => {
  const member = (id: string, joinedAt: number, lastPsychicRound: number, connected = true) => ({
    id,
    joinedAt,
    lastPsychicRound,
    connected,
  });

  it('rotates fairly through a team', () => {
    const a = member('a', 1, -1);
    const b = member('b', 2, -1);
    expect(pickPsychic([a, b])).toBe('a');
    a.lastPsychicRound = 1;
    expect(pickPsychic([a, b])).toBe('b');
    b.lastPsychicRound = 3;
    expect(pickPsychic([a, b])).toBe('a');
  });

  it('skips disconnected players', () => {
    expect(pickPsychic([member('a', 1, -1, false), member('b', 2, -1)])).toBe('b');
  });

  it('returns null when nobody is available', () => {
    expect(pickPsychic([])).toBeNull();
    expect(pickPsychic([member('a', 1, -1, false)])).toBeNull();
  });
});

describe('checkWinner', () => {
  it('declares a winner at the target score', () => {
    expect(checkWinner({ red: 10, blue: 3 }, 10)).toBe('red');
    expect(checkWinner({ red: 9, blue: 11 }, 10)).toBe('blue');
  });

  it('continues play below the target score', () => {
    expect(checkWinner({ red: 9, blue: 9 }, 10)).toBeNull();
  });

  it('goes to sudden death on a tie at or above the target', () => {
    expect(checkWinner({ red: 10, blue: 10 }, 10)).toBeNull();
    expect(checkWinner({ red: 11, blue: 10 }, 10)).toBe('red');
  });
});

describe('validateTopic', () => {
  it('accepts and trims a valid pair', () => {
    expect(validateTopic('  Cold pizza ', 'Fresh pizza')).toEqual({
      ok: true,
      left: 'Cold pizza',
      right: 'Fresh pizza',
    });
  });

  it('rejects missing or blank sides', () => {
    expect(validateTopic('', 'Right').ok).toBe(false);
    expect(validateTopic('Left', '   ').ok).toBe(false);
    expect(validateTopic(undefined, 'Right').ok).toBe(false);
  });

  it('rejects too-short and too-long sides', () => {
    expect(validateTopic('A', 'Right side').ok).toBe(false);
    expect(validateTopic('x'.repeat(41), 'Right side').ok).toBe(false);
  });

  it('rejects identical sides (case-insensitive)', () => {
    expect(validateTopic('Same', 'same').ok).toBe(false);
  });
});

describe('drawCard', () => {
  const presets: SpectrumCard[] = [
    { id: 'a1', left: 'L', right: 'R', deck: 'd1' },
    { id: 'a2', left: 'L', right: 'R', deck: 'd1' },
    { id: 'b1', left: 'L', right: 'R', deck: 'd2' },
  ];
  const custom: SpectrumCard[] = [{ id: 'c1', left: 'L', right: 'R', deck: 'custom' }];

  it('respects the deck filter for presets', () => {
    for (let i = 0; i < 50; i++) {
      const res = drawCard(presets, [], 'presets', ['d1'], new Set());
      expect(res!.card.deck).toBe('d1');
    }
  });

  it('treats an empty deck list as all decks', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(drawCard(presets, [], 'presets', [], new Set())!.card.deck);
    expect(seen).toEqual(new Set(['d1', 'd2']));
  });

  it('never repeats an unused card until the pool is exhausted', () => {
    const used = new Set(['a1', 'b1']);
    const res = drawCard(presets, [], 'presets', [], used)!;
    expect(res.card.id).toBe('a2');
    expect(res.resetUsed).toBe(false);
  });

  it('signals a reset when every card has been used', () => {
    const used = new Set(['a1', 'a2', 'b1']);
    const res = drawCard(presets, [], 'presets', [], used)!;
    expect(res.resetUsed).toBe(true);
    expect(['a1', 'a2', 'b1']).toContain(res.card.id);
  });

  it('uses custom topics when the source is custom', () => {
    expect(drawCard(presets, custom, 'custom', [], new Set())!.card.id).toBe('c1');
  });

  it('falls back to presets when custom is selected but empty', () => {
    expect(drawCard(presets, [], 'custom', [], new Set())!.card.deck).not.toBe('custom');
  });

  it('gives custom topics a 50/50 pool pick in mix mode', () => {
    // rand() first call selects the pool: >= 0.5 picks the custom pool.
    const res = drawCard(presets, custom, 'mix', [], new Set(), () => 0.9)!;
    expect(res.card.id).toBe('c1');
    const res2 = drawCard(presets, custom, 'mix', [], new Set(), () => 0.1)!;
    expect(res2.card.deck).toBe('d1');
  });

  it('returns null only when there is nothing to draw', () => {
    expect(drawCard([], [], 'presets', [], new Set())).toBeNull();
  });
});

describe('preset topic library', () => {
  it('has at least 60 pairs across 5 decks', () => {
    expect(PRESET_TOPICS.length).toBeGreaterThanOrEqual(60);
    expect(DECKS.length).toBe(5);
    for (const d of DECKS) {
      expect(PRESET_TOPICS.filter((c) => c.deck === d.id).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('has unique ids and valid pairs throughout', () => {
    const ids = new Set(PRESET_TOPICS.map((c) => c.id));
    expect(ids.size).toBe(PRESET_TOPICS.length);
    for (const c of PRESET_TOPICS) {
      expect(validateTopic(c.left, c.right).ok).toBe(true);
    }
  });
});

describe('party mode helpers', () => {
  it('gives the clue writer the rounded average of guesser points', () => {
    expect(partyAuthorPoints([4, 4, 4])).toBe(4);
    expect(partyAuthorPoints([4, 3, 2])).toBe(3);
    expect(partyAuthorPoints([4, 3])).toBe(4); // 3.5 rounds up
    expect(partyAuthorPoints([0, 0, 4])).toBe(1);
    expect(partyAuthorPoints([0])).toBe(0);
  });

  it('gives the clue writer nothing when nobody guessed', () => {
    expect(partyAuthorPoints([])).toBe(0);
  });

  it('shuffles deterministically with an injected rng and keeps all elements', () => {
    const arr = [1, 2, 3, 4];
    const out = shuffleInPlace(arr, () => 0);
    expect(out).toBe(arr);
    expect(out).toEqual([2, 3, 4, 1]);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });
});
