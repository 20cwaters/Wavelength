import type { Team } from '../../shared/types';

export const teamName = (t: Team): string => (t === 'red' ? 'Red' : 'Blue');

export const teamText = (t: Team): string => (t === 'red' ? 'text-rose-400' : 'text-sky-400');

export const teamBg = (t: Team): string =>
  t === 'red' ? 'bg-rose-500/15 border-rose-500/50' : 'bg-sky-500/15 border-sky-500/50';

/** Stable per-player accent colors (indexed by join order) for party mode. */
export const PLAYER_COLORS = [
  '#f87171',
  '#60a5fa',
  '#4ade80',
  '#facc15',
  '#c084fc',
  '#fb923c',
  '#2dd4bf',
  '#f472b6',
  '#a3e635',
  '#38bdf8',
];
