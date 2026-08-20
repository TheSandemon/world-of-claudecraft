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

  // Card names. Keyed by CardDefinition.nameId (src/sim/content/cards/), which
  // is a key id and never English: the sim stays language-agnostic.
  name: {
    mudfin_scout: 'Mudfin Scout',
    ratling_thief: 'Ratling Thief',
    grave_rat: 'Grave Rat',
    grave_candle: 'Grave Candle',
    web_spinner: 'Web Spinner',
    mire_toad: 'Mire Toad',
    forest_wolf: 'Forest Wolf',
    bramble_sprite: 'Bramble Sprite',
    bone_picker: 'Bone Picker',
    sableweb_hexer: 'Sableweb Hexer',
    nullstone: 'Nullstone',
    stablemaster: 'Stablemaster',
    doppelganger: 'Doppelganger',
    necromancer: 'Necromancer',
    torchbearer: 'Torchbearer',
    pack_alpha: 'Pack Alpha',
    tunnel_guard: 'Tunnel Guard',
    ember_drake: 'Ember Drake',
    ironclad: 'Ironclad',
    mirefen_ambusher: 'Mirefen Ambusher',
    grave_warden: 'Grave Warden',
    old_greyjaw: 'Old Greyjaw',
    sable_matriarch: 'Sable Matriarch',
    hollow_knight: 'Hollow Knight',
    stormcaller: 'Stormcaller',
    vale_warden: 'Vale Warden',
    ashen_wyrm: 'Ashen Wyrm',
    grix_tunnelking: 'Grix the Tunnelking',
    nythraxis_broodling: 'Nythraxis Broodling',
    vale_champion: 'Vale Champion',
  },

  // Rules text. ONE whole sentence per card with placeholders the card's own
  // effect tree supplies, never assembled from clause fragments: a machine-built
  // sentence cannot be translated into a language whose word order differs, and
  // cannot be reviewed against docs/design/tooltip-writing.md. Every {name} here
  // is pinned against the effect tree by tests/card_catalog.test.ts.
  text: {
    mudfin_scout: 'If this loses, reveal {count} random cards in the opponent hand.',
    ratling_thief: 'If this wins, the opponent discards a random card.',
    grave_rat: 'The opponent card gets -{amount} this round.',
    grave_candle: 'If this loses, your next Undead gets +{amount}.',
    web_spinner: 'When revealed, gain {amount} Web.',
    mire_toad: 'Gets +{amount} if the opponent card is a {threshold} or higher.',
    forest_wolf: 'Gets +{amount} if your previous card was a Beast.',
    bramble_sprite: 'Counts as a Beast this round and gets +{amount}.',
    bone_picker: 'Gets +1 for every Undead you have played this match.',
    sableweb_hexer: 'The opponent card gets -{amount} if it is Human.',
    nullstone: 'The opponent card has no effect this round.',
    stablemaster: 'Your next Beast gets +{amount}.',
    doppelganger: 'This card becomes the opponent card base value.',
    necromancer: 'Your next Undead gets +{amount}.',
    torchbearer: 'Gets +{amount} while you are behind on rounds.',
    pack_alpha: 'Gets +1 for every two Beasts you have played this match.',
    tunnel_guard: 'This card cannot be reduced below {amount}.',
    ember_drake: 'Gets +1 for each Dread on the opponent.',
    ironclad: 'The opponent card cannot exceed {amount} this round.',
    mirefen_ambusher: 'Gets +{amount} if the opponent card is Human.',
    grave_warden:
      'If this wins, return your highest Undead of value {threshold} or lower from your discard to your hand.',
    old_greyjaw: 'Gets +{amount} while you are behind on rounds.',
    sable_matriarch: 'Gets +1 for each Web you have.',
    hollow_knight: 'This card wins tied rounds.',
    stormcaller: 'The opponent card gets -{amount} if it is a {threshold} or higher.',
    vale_warden: 'If this wins, draw {amount} card.',
    ashen_wyrm: 'When revealed, give the opponent {amount} Dread.',
    grix_tunnelking: 'If this wins, your next card gets -{amount}.',
    nythraxis_broodling: 'When revealed, give the opponent {amount} Dread.',
    vale_champion: 'If this loses, draw {amount} cards.',
  },

  // Tribe names, shown on the card face and in the deck builder filters.
  tribe: {
    Beast: 'Beast',
    Human: 'Human',
    Undead: 'Undead',
    Demon: 'Demon',
    Spider: 'Spider',
    Mudfin: 'Mudfin',
    Burrower: 'Burrower',
    Construct: 'Construct',
    Elemental: 'Elemental',
    Spirit: 'Spirit',
    Dragon: 'Dragon',
    Bandit: 'Bandit',
  },

  card: {
    valueLabel: 'Value {value}',
    effectiveLabel: 'Effective value {value}',
    play: 'Play {name}',
  },
};
