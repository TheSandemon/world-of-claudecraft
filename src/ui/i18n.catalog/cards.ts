// i18n source catalog - the Card Duel surface: card names, rules text, tribes,
// counters, and the Card Master's regulars. English values only; the locale translations live in src/ui/i18n.locales/<lang>.ts
// (the runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `cards` namespace. Like guide.ts
// and editor.ts this module carries NO per-locale blocks (no `as const`), so a
// new string is an English-only add that compiles.

export const cardsStrings = {
  // The unauthored fallback cards: ten plain numbers with no rules text.
  basicName: 'Plain {value}',
  noRulesText: 'No effect.',

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

  // The Card Master's regulars (src/sim/content/cards/opponents.ts). Each is a
  // content record, so a new one is a data change plus three strings here.
  opponent: {
    dockhand_pell: {
      name: 'Pell',
      title: 'Dockhand',
      greeting: 'Mind the mud. It bites back down my way.',
    },
    gravedigger_ossa: {
      name: 'Ossa',
      title: 'Gravedigger',
      greeting: 'Nothing I bury stays buried for long.',
    },
    huntsman_bregg: {
      name: 'Bregg',
      title: 'Huntsman',
      greeting: 'One wolf is a nuisance. Six is a hunt.',
    },
    the_card_master: {
      name: 'The Card Master',
      title: 'Keeper of the Table',
      greeting: 'Sit. Everyone gets the same twenty cards. Show me which ones you chose.',
    },
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

  // Counter names (src/sim/minigames/card_duel/), shown as tokens on the duel
  // table. The sim-side key is an id, never text: every counter a shipped card
  // can put on a side needs a name here (pinned by tests/card_catalog.test.ts).
  counter: {
    Web: 'Web',
    Dread: 'Dread',
  },

  card: {
    valueLabel: 'Value {value}',
    effectiveLabel: 'Effective value {value}',
    play: 'Play {name}',
  },
};
