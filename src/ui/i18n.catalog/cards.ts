// i18n source catalog - the Card Duel surface: the standalone playtest slice at
// /cards and (from the catalog phase on) card names and rules text. English
// values only; the locale translations live in src/ui/i18n.locales/<lang>.ts
// (the runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `cards` namespace. Like guide.ts
// and editor.ts this module carries NO per-locale blocks (no `as const`), so a
// new string is an English-only add that compiles.

export const cardsStrings = {
  // Browser tab title. Hyphen separator (not a dash character).
  docTitle: 'Card Duel Playtest - World of ClaudeCraft',
  appTitle: 'Card Duel Playtest',
  intro:
    'A world-less Card Duel table running the shipping rules engine. Set a seed to reproduce an exact shuffle.',

  // The unauthored fallback cards: ten plain numbers with no rules text.
  basicName: 'Plain {value}',
  noRulesText: 'No effect.',

  seat: {
    a: 'Seat A',
    b: 'Seat B',
    you: 'Your seat',
    committed: 'Card locked in',
    waiting: 'Choosing...',
    handLabel: 'Hand for {seat}',
    deckCount: 'Deck: {count}',
    discardCount: 'Discard: {count}',
    score: 'Rounds won: {count}',
  },

  controls: {
    label: 'Table controls',
    seed: 'Seed',
    seedHint: 'The same seed deals the same match every time.',
    newMatch: 'New match',
    runToEnd: 'Run to end',
    runToEndHint: 'Both seats must be computer opponents.',
    opponentA: 'Seat A played by',
    opponentB: 'Seat B played by',
    human: 'Human',
    novice: 'Novice',
    steady: 'Steady',
    sharp: 'Sharp',
    master: 'Master',
  },

  round: {
    heading: 'Round {round}',
    outcomeWin: 'Seat A wins the round, {a} to {b}.',
    outcomeLose: 'Seat B wins the round, {b} to {a}.',
    outcomePush: 'The round is a push at {a}.',
    reshuffled: 'A discard pile was shuffled back into its deck.',
    steps: '{count} effects resolved.',
    overflow: 'Resolution hit the step ceiling and the round was decided on current values.',
    empty: 'No rounds played yet.',
  },

  result: {
    winA: 'Seat A takes the match.',
    winB: 'Seat B takes the match.',
    live: 'Match in progress.',
  },

  card: {
    valueLabel: 'Value {value}',
    effectiveLabel: 'Effective value {value}',
    play: 'Play {name}',
  },
};
