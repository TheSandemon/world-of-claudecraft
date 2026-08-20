// The Card Duel launch set: three cards at every value 1 to 10.
//
// Data-as-code. Every card is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing here is engine
// logic, and no card needs any. Three per value is what makes the deck rule
// meaningful: a deck holds exactly two cards of each value with no repeats, so
// each value is a real choice rather than a slot that fills itself.
//
// Text: `nameId` and `textId` are i18n KEY ids, never English. The English
// sentences live in src/ui/i18n.catalog/cards.ts under `cards.name.*` and
// `cards.text.*`, and every {placeholder} in one is a value the card's own
// effect tree supplies (tests/card_catalog.test.ts pins exactly that).
//
// Art: `art` is an id, not a path. It resolves through src/ui/card_art.ts; a
// card with no committed painting falls back to a procedural face keyed on its
// tribe and value, so no card ever renders as a blank rectangle.
//
// Balance: power comes from selection, synergy, and timing, never from bigger
// numbers. A card cannot power-creep by being numerically larger, because it
// competes only with the other cards of its own value.

import type { CardDefinition, CardNumericExpr } from '../../minigames/card_duel/types';

const constant = (value: number): CardNumericExpr => ({ type: 'constant', value });

/** Shorthand for the common "this card, this comparison" effect shape. */
const card = (def: CardDefinition): CardDefinition => def;

export const LAUNCH_CARDS: readonly CardDefinition[] = [
  // ---------------------------------------------------------------- value 1
  card({
    id: 'mudfin_scout',
    nameId: 'mudfin_scout',
    textId: 'mudfin_scout',
    art: 'mudfin_scout',
    value: 1,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 2 },
        effect: { type: 'reveal' },
        textValues: { count: constant(2) },
      },
    ],
  }),
  card({
    id: 'ratling_thief',
    nameId: 'ratling_thief',
    textId: 'ratling_thief',
    art: 'ratling_thief',
    value: 1,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random' },
        effect: { type: 'discard' },
      },
    ],
  }),
  card({
    id: 'grave_rat',
    nameId: 'grave_rat',
    textId: 'grave_rat',
    art: 'grave_rat',
    value: 1,
    tribes: ['Undead'],
    tags: [],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-1) },
        textValues: { amount: constant(1) },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 2
  card({
    id: 'grave_candle',
    nameId: 'grave_candle',
    textId: 'grave_candle',
    art: 'grave_candle',
    value: 2,
    tribes: ['Spirit'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Undead' } },
        effect: { type: 'modifyValue', amount: constant(3) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'web_spinner',
    nameId: 'web_spinner',
    textId: 'web_spinner',
    art: 'web_spinner',
    value: 2,
    tribes: ['Spider'],
    tags: [],
    rarity: 'common',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Web', amount: constant(1) },
        textValues: { amount: constant(1) },
      },
    ],
  }),
  card({
    id: 'mire_toad',
    nameId: 'mire_toad',
    textId: 'mire_toad',
    art: 'mire_toad',
    value: 2,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(8),
        },
        effect: { type: 'modifyValue', amount: constant(5) },
        textValues: { amount: constant(5), threshold: constant(8) },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 3
  card({
    id: 'forest_wolf',
    nameId: 'forest_wolf',
    textId: 'forest_wolf',
    art: 'forest_wolf',
    value: 3,
    tribes: ['Beast'],
    tags: ['Wolf', 'Eastbrook', 'Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Beast' },
        effect: { type: 'modifyValue', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'bramble_sprite',
    nameId: 'bramble_sprite',
    textId: 'bramble_sprite',
    art: 'bramble_sprite',
    value: 3,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'thisCard' },
        effect: { type: 'addTribe', tribe: 'Beast' },
      },
      {
        trigger: 'beforeCompare',
        effect: { type: 'modifyValue', amount: constant(1) },
        textValues: { amount: constant(1) },
      },
    ],
  }),
  card({
    id: 'bone_picker',
    nameId: 'bone_picker',
    textId: 'bone_picker',
    art: 'bone_picker',
    value: 3,
    tribes: ['Undead'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead' } },
        },
        textValues: {
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead' } },
        },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 4
  card({
    id: 'sableweb_hexer',
    nameId: 'sableweb_hexer',
    textId: 'sableweb_hexer',
    art: 'sableweb_hexer',
    value: 4,
    tribes: ['Spider'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Human' },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-3) },
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'nullstone',
    nameId: 'nullstone',
    textId: 'nullstone',
    art: 'nullstone',
    value: 4,
    tribes: ['Construct'],
    tags: [],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'opponentCard' },
        effect: { type: 'silence' },
      },
    ],
  }),
  card({
    id: 'stablemaster',
    nameId: 'stablemaster',
    textId: 'stablemaster',
    art: 'stablemaster',
    value: 4,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(2) },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 5
  card({
    id: 'doppelganger',
    nameId: 'doppelganger',
    textId: 'doppelganger',
    art: 'doppelganger',
    value: 5,
    tribes: ['Spirit'],
    tags: [],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'setValue',
          amount: { type: 'cardValue', card: 'opponentCard', value: 'base' },
        },
      },
    ],
  }),
  card({
    id: 'necromancer',
    nameId: 'necromancer',
    textId: 'necromancer',
    art: 'necromancer',
    value: 5,
    tribes: ['Human'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Undead' } },
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'torchbearer',
    nameId: 'torchbearer',
    textId: 'torchbearer',
    art: 'torchbearer',
    value: 5,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 6
  card({
    id: 'pack_alpha',
    nameId: 'pack_alpha',
    textId: 'pack_alpha',
    art: 'pack_alpha',
    value: 6,
    tribes: ['Beast'],
    tags: ['Wolf', 'Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'floor',
            of: {
              type: 'divide',
              left: { type: 'historyCount', filter: { owner: 'self', tribe: 'Beast' } },
              right: constant(2),
            },
          },
        },
        textValues: {
          amount: {
            type: 'floor',
            of: {
              type: 'divide',
              left: { type: 'historyCount', filter: { owner: 'self', tribe: 'Beast' } },
              right: constant(2),
            },
          },
        },
      },
    ],
  }),
  card({
    id: 'tunnel_guard',
    nameId: 'tunnel_guard',
    textId: 'tunnel_guard',
    art: 'tunnel_guard',
    value: 6,
    tribes: ['Burrower'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'minimumValue', amount: constant(6) },
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'ember_drake',
    nameId: 'ember_drake',
    textId: 'ember_drake',
    art: 'ember_drake',
    value: 6,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'counter', owner: 'opponent', counter: 'Dread' },
        },
        textValues: { amount: { type: 'counter', owner: 'opponent', counter: 'Dread' } },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 7
  card({
    id: 'ironclad',
    nameId: 'ironclad',
    textId: 'ironclad',
    art: 'ironclad',
    value: 7,
    tribes: ['Construct'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(8) },
        textValues: { amount: constant(8) },
      },
    ],
  }),
  card({
    id: 'mirefen_ambusher',
    nameId: 'mirefen_ambusher',
    textId: 'mirefen_ambusher',
    art: 'mirefen_ambusher',
    value: 7,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Human' },
        effect: { type: 'modifyValue', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'grave_warden',
    nameId: 'grave_warden',
    textId: 'grave_warden',
    art: 'grave_warden',
    value: 7,
    tribes: ['Undead'],
    tags: [],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onWin',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          match: { tribe: 'Undead', maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        textValues: { threshold: constant(3) },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 8
  card({
    id: 'old_greyjaw',
    nameId: 'old_greyjaw',
    textId: 'old_greyjaw',
    art: 'old_greyjaw',
    value: 8,
    tribes: ['Beast'],
    tags: ['Wolf', 'RareMob'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'sable_matriarch',
    nameId: 'sable_matriarch',
    textId: 'sable_matriarch',
    art: 'sable_matriarch',
    value: 8,
    tribes: ['Spider'],
    tags: ['RareMob'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'counter', owner: 'self', counter: 'Web' },
        },
        textValues: { amount: { type: 'counter', owner: 'self', counter: 'Web' } },
      },
    ],
  }),
  card({
    id: 'hollow_knight',
    nameId: 'hollow_knight',
    textId: 'hollow_knight',
    art: 'hollow_knight',
    value: 8,
    tribes: ['Undead'],
    tags: ['Boss', 'Dungeon'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'winTies' },
      },
    ],
  }),

  // ---------------------------------------------------------------- value 9
  card({
    id: 'stormcaller',
    nameId: 'stormcaller',
    textId: 'stormcaller',
    art: 'stormcaller',
    value: 9,
    tribes: ['Elemental'],
    tags: [],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(7),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-3) },
        textValues: { amount: constant(3), threshold: constant(7) },
      },
    ],
  }),
  card({
    id: 'vale_warden',
    nameId: 'vale_warden',
    textId: 'vale_warden',
    art: 'vale_warden',
    value: 9,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(1) },
        textValues: { amount: constant(1) },
      },
    ],
  }),
  card({
    id: 'ashen_wyrm',
    nameId: 'ashen_wyrm',
    textId: 'ashen_wyrm',
    art: 'ashen_wyrm',
    value: 9,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(1) },
        textValues: { amount: constant(1) },
      },
    ],
  }),

  // --------------------------------------------------------------- value 10
  card({
    id: 'grix_tunnelking',
    nameId: 'grix_tunnelking',
    textId: 'grix_tunnelking',
    art: 'grix_tunnelking',
    value: 10,
    tribes: ['Burrower'],
    tags: ['Boss', 'RareMob'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self' },
        effect: { type: 'modifyValue', amount: constant(-3) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'nythraxis_broodling',
    nameId: 'nythraxis_broodling',
    textId: 'nythraxis_broodling',
    art: 'nythraxis_broodling',
    value: 10,
    tribes: ['Dragon'],
    tags: ['Boss', 'Dungeon'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'vale_champion',
    nameId: 'vale_champion',
    textId: 'vale_champion',
    art: 'vale_champion',
    value: 10,
    tribes: ['Human'],
    tags: ['Eastbrook', 'CardMaster'],
    rarity: 'legendary',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(2) },
        textValues: { amount: constant(2) },
      },
    ],
  }),
];
