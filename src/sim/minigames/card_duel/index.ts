// The Card Duel rules engine: the public surface the SimContext-bound
// orchestrator (src/sim/social/card_duel.ts), the standalone slice
// (src/cards/), and the tests import. Pure and SimContext-free by design, so
// the browser, the server, and the headless env run identical rules.
//
// Import from this barrel, not from the modules directly, unless you are
// inside the folder. See ./CLAUDE.md for what belongs here.

export * from './conditions';
export * from './deck';
export * from './effects';
export * from './expressions';
export * from './match_state';
export * from './modifiers';
export * from './resolve';
export * from './selectors';
export * from './types';
