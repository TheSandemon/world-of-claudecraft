// Greenwake Circle: reward varied tribes and a broad history rather than one narrow tribal line.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Greenwake Circle readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const GREENWAKE_CIRCLE_CARDS: readonly CardDefinition[] = [
  card({
    id: 'greenwake_circle_treants_sprout',
    nameId: 'greenwake_circle_treants_sprout',
    textId: 'greenwake_circle_treants_sprout',
    art: 'greenwake_circle_treants_sprout',
    set: 'greenwake_circle',
    value: 1,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [
              constant(5),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Elemental' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(5),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Elemental' } },
            ],
          },
          rate: constant(5),
        },
      },
      {
        trigger: 'onReveal',
        effect: { type: 'addTribe', tribe: 'Spirit' },
        duration: 'thisRound',
        stackMode: 'unique',
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_rain_song',
    nameId: 'greenwake_circle_treants_rain_song',
    textId: 'greenwake_circle_treants_rain_song',
    art: 'greenwake_circle_treants_rain_song',
    set: 'greenwake_circle',
    value: 2,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'uniqueTribesCompare', owner: 'self', op: 'gte', amount: constant(3) },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'thisComparison',
        textValues: { amount: constant(21), threshold: constant(3) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_root_race',
    nameId: 'greenwake_circle_treants_root_race',
    textId: 'greenwake_circle_treants_root_race',
    art: 'greenwake_circle_treants_root_race',
    set: 'greenwake_circle',
    value: 3,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'previousResult', owner: 'self', result: 'lose' },
        effect: { type: 'modifyValue', amount: constant(10) },
        duration: 'thisComparison',
        textValues: { amount: constant(10) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_orchard_walk',
    nameId: 'greenwake_circle_treants_orchard_walk',
    textId: 'greenwake_circle_treants_orchard_walk',
    art: 'greenwake_circle_treants_orchard_walk',
    set: 'greenwake_circle',
    value: 4,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'roundCompare', op: 'gte', amount: constant(5) },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), round: constant(5) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_stag_hunt',
    nameId: 'greenwake_circle_treants_stag_hunt',
    textId: 'greenwake_circle_treants_stag_hunt',
    art: 'greenwake_circle_treants_stag_hunt',
    set: 'greenwake_circle',
    value: 5,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'consecutive',
          owner: 'self',
          result: 'lose',
          op: 'gte',
          amount: constant(2),
        },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4), threshold: constant(2) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_bloom',
    nameId: 'greenwake_circle_treants_bloom',
    textId: 'greenwake_circle_treants_bloom',
    art: 'greenwake_circle_treants_bloom',
    set: 'greenwake_circle',
    value: 6,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Elemental' } },
        },
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Elemental' } },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_grove_dance',
    nameId: 'greenwake_circle_treants_grove_dance',
    textId: 'greenwake_circle_treants_grove_dance',
    art: 'greenwake_circle_treants_grove_dance',
    set: 'greenwake_circle',
    value: 7,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'uniqueTribesCompare', owner: 'self', op: 'gte', amount: constant(3) },
        effect: { type: 'modifyValue', amount: constant(3) },
        duration: 'thisComparison',
        textValues: { amount: constant(3), threshold: constant(3) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_wild_hunt',
    nameId: 'greenwake_circle_treants_wild_hunt',
    textId: 'greenwake_circle_treants_wild_hunt',
    art: 'greenwake_circle_treants_wild_hunt',
    set: 'greenwake_circle',
    value: 8,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'previousResult', owner: 'self', result: 'lose' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_long_sleep',
    nameId: 'greenwake_circle_treants_long_sleep',
    textId: 'greenwake_circle_treants_long_sleep',
    art: 'greenwake_circle_treants_long_sleep',
    set: 'greenwake_circle',
    value: 9,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'roundCompare', op: 'gte', amount: constant(5) },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), round: constant(5) },
      },
    ],
  }),
  card({
    id: 'greenwake_circle_treants_awakening',
    nameId: 'greenwake_circle_treants_awakening',
    textId: 'greenwake_circle_treants_awakening',
    art: 'greenwake_circle_treants_awakening',
    set: 'greenwake_circle',
    value: 10,
    tribes: ['Elemental', 'Beast'],
    tags: ['Nature'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'consecutive',
          owner: 'self',
          result: 'lose',
          op: 'gte',
          amount: constant(2),
        },
        effect: { type: 'modifyValue', amount: constant(8) },
        duration: 'thisComparison',
        textValues: { amount: constant(8), threshold: constant(2) },
      },
    ],
  }),
];
