// Ashen Flight: place Dread on the opponent, then use that pressure to amplify later Dragons.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Ashen Flight readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const ASHEN_FLIGHT_CARDS: readonly CardDefinition[] = [
  card({
    id: 'ashen_flight_dragons_spark',
    nameId: 'ashen_flight_dragons_spark',
    textId: 'ashen_flight_dragons_spark',
    art: 'ashen_flight_dragons_spark',
    set: 'ashen_flight',
    value: 1,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(10) },
        duration: 'instant',
        textValues: { amount: constant(10), cap: constant(1) },
      },
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(1) },
        duration: 'thisComparison',
        stackMode: 'lowest',
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_smoke_break',
    nameId: 'ashen_flight_dragons_smoke_break',
    textId: 'ashen_flight_dragons_smoke_break',
    art: 'ashen_flight_dragons_smoke_break',
    set: 'ashen_flight',
    value: 2,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(4), { type: 'counter', owner: 'opponent', counter: 'Dread' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(4), { type: 'counter', owner: 'opponent', counter: 'Dread' }],
          },
          rate: constant(4),
        },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_roost',
    nameId: 'ashen_flight_dragons_roost',
    textId: 'ashen_flight_dragons_roost',
    art: 'ashen_flight_dragons_roost',
    set: 'ashen_flight',
    value: 3,
    tribes: ['Dragon'],
    tags: ['Fire', 'Dungeon'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'opponent',
          counter: 'Dread',
          op: 'gte',
          amount: constant(1),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-10) },
        duration: 'thisComparison',
        textValues: { amount: constant(10), threshold: constant(1) },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_first_raid',
    nameId: 'ashen_flight_dragons_first_raid',
    textId: 'ashen_flight_dragons_first_raid',
    art: 'ashen_flight_dragons_first_raid',
    set: 'ashen_flight',
    value: 4,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_ashfall',
    nameId: 'ashen_flight_dragons_ashfall',
    textId: 'ashen_flight_dragons_ashfall',
    art: 'ashen_flight_dragons_ashfall',
    set: 'ashen_flight',
    value: 5,
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
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'counter', owner: 'opponent', counter: 'Dread' },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_fire_drill',
    nameId: 'ashen_flight_dragons_fire_drill',
    textId: 'ashen_flight_dragons_fire_drill',
    art: 'ashen_flight_dragons_fire_drill',
    set: 'ashen_flight',
    value: 6,
    tribes: ['Dragon'],
    tags: ['Fire', 'Dungeon'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'opponent',
          counter: 'Dread',
          op: 'gte',
          amount: constant(2),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-2) },
        duration: 'thisComparison',
        textValues: { amount: constant(2), threshold: constant(2) },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_sky_hunt',
    nameId: 'ashen_flight_dragons_sky_hunt',
    textId: 'ashen_flight_dragons_sky_hunt',
    art: 'ashen_flight_dragons_sky_hunt',
    set: 'ashen_flight',
    value: 7,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3), bonus: constant(3) },
      },
      {
        trigger: 'onWin',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(3) },
        duration: 'instant',
        stackMode: 'unique',
        limits: { oncePerRound: true },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_bridge_roast',
    nameId: 'ashen_flight_dragons_bridge_roast',
    textId: 'ashen_flight_dragons_bridge_roast',
    art: 'ashen_flight_dragons_bridge_roast',
    set: 'ashen_flight',
    value: 8,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(2), { type: 'counter', owner: 'opponent', counter: 'Dread' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(2), { type: 'counter', owner: 'opponent', counter: 'Dread' }],
          },
          rate: constant(2),
        },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_sun_feast',
    nameId: 'ashen_flight_dragons_sun_feast',
    textId: 'ashen_flight_dragons_sun_feast',
    art: 'ashen_flight_dragons_sun_feast',
    set: 'ashen_flight',
    value: 9,
    tribes: ['Dragon'],
    tags: ['Fire', 'Dungeon'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'opponent',
          counter: 'Dread',
          op: 'gte',
          amount: constant(1),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), threshold: constant(1) },
      },
    ],
  }),
  card({
    id: 'ashen_flight_dragons_long_nap',
    nameId: 'ashen_flight_dragons_long_nap',
    textId: 'ashen_flight_dragons_long_nap',
    art: 'ashen_flight_dragons_long_nap',
    set: 'ashen_flight',
    value: 10,
    tribes: ['Dragon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'addCounter', counter: 'Dread', amount: constant(16) },
        duration: 'instant',
        textValues: { amount: constant(16) },
      },
    ],
  }),
];
