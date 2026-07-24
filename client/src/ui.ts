import type { Team } from '../../shared/types';

export const teamName = (t: Team): string => (t === 'red' ? 'Red' : 'Blue');

export const teamText = (t: Team): string => (t === 'red' ? 'text-rose-400' : 'text-sky-400');

export const teamBg = (t: Team): string =>
  t === 'red' ? 'bg-rose-500/15 border-rose-500/50' : 'bg-sky-500/15 border-sky-500/50';

/** Stable per-player accent colors (indexed by join order), pulled from the
 *  box-art palette. Every color must read on both the dark pills and the
 *  cream dial face. */
export const PLAYER_COLORS = [
  '#e8613c', // burnt orange
  '#45b5e0', // sky blue
  '#8faf3e', // avocado
  '#e5a62e', // mustard
  '#b3502f', // brick
  '#3d8b57', // deep green
  '#f0a184', // salmon
  '#8fd4ee', // light blue
  '#5bbf9e', // mint
  '#7a5c3a', // warm brown
];
