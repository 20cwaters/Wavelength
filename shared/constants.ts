// Central tuning knobs for the game. Adjust here and everything (server
// scoring, client dial rendering, tests) stays consistent.

/** The dial runs from 1 (far left) to 180 (far right), in degrees. */
export const DIAL_MIN = 1;
export const DIAL_MAX = 180;

/** Width in degrees of each scoring wedge. The target zone is 5 wedges wide:
 *  2 | 3 | 4 | 3 | 2  (bullseye in the middle). */
export const WEDGE_WIDTH = 7;

/** Targets are kept far enough from the edges that the full wedge zone fits on the dial. */
export const TARGET_MARGIN = Math.ceil(WEDGE_WIDTH * 2.5) + 1;
export const TARGET_MIN = DIAL_MIN + TARGET_MARGIN;
export const TARGET_MAX = DIAL_MAX - TARGET_MARGIN;

export const DEFAULT_TARGET_SCORE = 10;
export const MIN_TARGET_SCORE = 3;
export const MAX_TARGET_SCORE = 30;

/** Party mode: how many dials each player writes clues for at game start. */
export const DEFAULT_CLUES_PER_PLAYER = 2;
export const MIN_CLUES_PER_PLAYER = 1;
export const MAX_CLUES_PER_PLAYER = 5;

export const MAX_NAME_LEN = 20;
export const MAX_CLUE_LEN = 100;
export const MIN_TOPIC_LEN = 2;
export const MAX_TOPIC_LEN = 40;
export const MAX_CUSTOM_TOPICS = 300;

/** Players who opt into tutorial mode see guided tips for this many rounds. */
export const TUTORIAL_ROUNDS = 2;
