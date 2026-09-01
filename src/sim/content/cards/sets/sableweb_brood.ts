// Sableweb Brood: accumulate Web and reward patient sequencing, with a few Human-hunting payoffs.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Sableweb Brood readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const SABLEWEB_BROOD_CARDS: readonly CardDefinition[] = [
  card({
    id: 'sableweb_brood_spiders_web',
    nameId: 'sableweb_brood_spiders_web',
    textId: 'sableweb_brood_spiders_web',
    art: 'sableweb_brood_spiders_web',
    set: 'sableweb_brood',
    value: 1,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Web', amount: constant(10) },
        duration: 'instant',
        textValues: { amount: constant(10) },
      },
      {
        trigger: 'onReveal',
        target: { type: 'opponentCard' },
        effect: { type: 'silence' },
        duration: 'thisRound',
        stackMode: 'replace',
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_wait',
    nameId: 'sableweb_brood_spiders_wait',
    textId: 'sableweb_brood_spiders_wait',
    art: 'sableweb_brood_spiders_wait',
    set: 'sableweb_brood',
    value: 2,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Web',
          op: 'gte',
          amount: constant(1),
        },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'thisComparison',
        textValues: { amount: constant(21), threshold: constant(1) },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_snack',
    nameId: 'sableweb_brood_spiders_snack',
    textId: 'sableweb_brood_spiders_snack',
    art: 'sableweb_brood_spiders_snack',
    set: 'sableweb_brood',
    value: 3,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Web' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Web' }],
          },
          rate: constant(3),
        },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_silk_trap',
    nameId: 'sableweb_brood_spiders_silk_trap',
    textId: 'sableweb_brood_spiders_silk_trap',
    art: 'sableweb_brood_spiders_silk_trap',
    set: 'sableweb_brood',
    value: 4,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Web', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3), threshold: constant(1) },
      },
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Web',
          op: 'gte',
          amount: constant(1),
        },
        effect: { type: 'addTribe', tribe: 'Spirit' },
        duration: 'thisRound',
        stackMode: 'unique',
        limits: { oncePerRound: true },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_shed',
    nameId: 'sableweb_brood_spiders_shed',
    textId: 'sableweb_brood_spiders_shed',
    art: 'sableweb_brood_spiders_shed',
    set: 'sableweb_brood',
    value: 5,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Web',
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
    id: 'sableweb_brood_spiders_egg_hunt',
    nameId: 'sableweb_brood_spiders_egg_hunt',
    textId: 'sableweb_brood_spiders_egg_hunt',
    art: 'sableweb_brood_spiders_egg_hunt',
    set: 'sableweb_brood',
    value: 6,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'modifyValue', amount: { type: 'counter', owner: 'self', counter: 'Web' } },
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'counter', owner: 'self', counter: 'Web' },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_tea_party',
    nameId: 'sableweb_brood_spiders_tea_party',
    textId: 'sableweb_brood_spiders_tea_party',
    art: 'sableweb_brood_spiders_tea_party',
    set: 'sableweb_brood',
    value: 7,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Web', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_night_watch',
    nameId: 'sableweb_brood_spiders_night_watch',
    textId: 'sableweb_brood_spiders_night_watch',
    art: 'sableweb_brood_spiders_night_watch',
    set: 'sableweb_brood',
    value: 8,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Web',
          op: 'gte',
          amount: constant(1),
        },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4), threshold: constant(1) },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_feast',
    nameId: 'sableweb_brood_spiders_feast',
    textId: 'sableweb_brood_spiders_feast',
    art: 'sableweb_brood_spiders_feast',
    set: 'sableweb_brood',
    value: 9,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Web' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Web' }],
          },
          rate: constant(3),
        },
      },
    ],
  }),
  card({
    id: 'sableweb_brood_spiders_brood_rite',
    nameId: 'sableweb_brood_spiders_brood_rite',
    textId: 'sableweb_brood_spiders_brood_rite',
    art: 'sableweb_brood_spiders_brood_rite',
    set: 'sableweb_brood',
    value: 10,
    tribes: ['Spider'],
    tags: ['Mirefen'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Web', amount: constant(8) },
        duration: 'instant',
        textValues: { amount: constant(8) },
      },
    ],
  }),
];
