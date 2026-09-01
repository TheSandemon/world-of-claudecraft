// Stormheart Conclave: punish predictable high values with threshold-based boosts and reductions.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Stormheart Conclave readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const STORMHEART_CONCLAVE_CARDS: readonly CardDefinition[] = [
  card({
    id: 'stormheart_conclave_stormlings_static',
    nameId: 'stormheart_conclave_stormlings_static',
    textId: 'stormheart_conclave_stormlings_static',
    art: 'stormheart_conclave_stormlings_static',
    set: 'stormheart_conclave',
    value: 1,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(6),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-30) },
        duration: 'thisComparison',
        textValues: { amount: constant(30), cap: constant(1), threshold: constant(6) },
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
    id: 'stormheart_conclave_stormlings_rain_dance',
    nameId: 'stormheart_conclave_stormlings_rain_dance',
    textId: 'stormheart_conclave_stormlings_rain_dance',
    art: 'stormheart_conclave_stormlings_rain_dance',
    set: 'stormheart_conclave',
    value: 2,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(6),
        },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'thisComparison',
        textValues: { amount: constant(21), threshold: constant(6) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_wind_race',
    nameId: 'stormheart_conclave_stormlings_wind_race',
    textId: 'stormheart_conclave_stormlings_wind_race',
    art: 'stormheart_conclave_stormlings_wind_race',
    set: 'stormheart_conclave',
    value: 3,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'common',
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
        effect: { type: 'modifyValue', amount: constant(-10) },
        duration: 'thisComparison',
        textValues: { amount: constant(10), threshold: constant(7) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_storm_call',
    nameId: 'stormheart_conclave_stormlings_storm_call',
    textId: 'stormheart_conclave_stormlings_storm_call',
    art: 'stormheart_conclave_stormlings_storm_call',
    set: 'stormheart_conclave',
    value: 4,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
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
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), threshold: constant(7) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_cloudbreak',
    nameId: 'stormheart_conclave_stormlings_cloudbreak',
    textId: 'stormheart_conclave_stormlings_cloudbreak',
    art: 'stormheart_conclave_stormlings_cloudbreak',
    set: 'stormheart_conclave',
    value: 5,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
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
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4), threshold: constant(8) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_thunder_roll',
    nameId: 'stormheart_conclave_stormlings_thunder_roll',
    textId: 'stormheart_conclave_stormlings_thunder_roll',
    art: 'stormheart_conclave_stormlings_thunder_roll',
    set: 'stormheart_conclave',
    value: 6,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
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
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'thisComparison',
        textValues: { amount: constant(2), threshold: constant(8) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_sky_brawl',
    nameId: 'stormheart_conclave_stormlings_sky_brawl',
    textId: 'stormheart_conclave_stormlings_sky_brawl',
    art: 'stormheart_conclave_stormlings_sky_brawl',
    set: 'stormheart_conclave',
    value: 7,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(9),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-3) },
        duration: 'thisComparison',
        textValues: { amount: constant(3), threshold: constant(9) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_blackout',
    nameId: 'stormheart_conclave_stormlings_blackout',
    textId: 'stormheart_conclave_stormlings_blackout',
    art: 'stormheart_conclave_stormlings_blackout',
    set: 'stormheart_conclave',
    value: 8,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(9),
        },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4), threshold: constant(9) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_tempest',
    nameId: 'stormheart_conclave_stormlings_tempest',
    textId: 'stormheart_conclave_stormlings_tempest',
    art: 'stormheart_conclave_stormlings_tempest',
    set: 'stormheart_conclave',
    value: 9,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(9),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), threshold: constant(9) },
      },
    ],
  }),
  card({
    id: 'stormheart_conclave_stormlings_big_bang',
    nameId: 'stormheart_conclave_stormlings_big_bang',
    textId: 'stormheart_conclave_stormlings_big_bang',
    art: 'stormheart_conclave_stormlings_big_bang',
    set: 'stormheart_conclave',
    value: 10,
    tribes: ['Elemental'],
    tags: ['Nature'],
    rarity: 'legendary',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(1) },
        duration: 'thisComparison',
        stackMode: 'lowest',
        textValues: { amount: constant(1) },
      },
    ],
  }),
];
