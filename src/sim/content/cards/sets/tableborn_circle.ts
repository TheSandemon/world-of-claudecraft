// Tableborn Circle: reward card counting, round awareness, and deliberate streak management.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Tableborn Circle readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const TABLEBORN_CIRCLE_CARDS: readonly CardDefinition[] = [
  card({
    id: 'tableborn_circle_gamblers_deal',
    nameId: 'tableborn_circle_gamblers_deal',
    textId: 'tableborn_circle_gamblers_deal',
    art: 'tableborn_circle_gamblers_deal',
    set: 'tableborn_circle',
    value: 1,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Human' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(5),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Human' } },
            ],
          },
          rate: constant(5),
        },
      },
      {
        trigger: 'beforeCompare',
        effect: { type: 'reverseComparison' },
        duration: 'thisComparison',
        stackMode: 'replace',
      },
    ],
  }),
  card({
    id: 'tableborn_circle_gamblers_small_bet',
    nameId: 'tableborn_circle_gamblers_small_bet',
    textId: 'tableborn_circle_gamblers_small_bet',
    art: 'tableborn_circle_gamblers_small_bet',
    set: 'tableborn_circle',
    value: 2,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_card_trick',
    nameId: 'tableborn_circle_gamblers_card_trick',
    textId: 'tableborn_circle_gamblers_card_trick',
    art: 'tableborn_circle_gamblers_card_trick',
    set: 'tableborn_circle',
    value: 3,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_poker_night',
    nameId: 'tableborn_circle_gamblers_poker_night',
    textId: 'tableborn_circle_gamblers_poker_night',
    art: 'tableborn_circle_gamblers_poker_night',
    set: 'tableborn_circle',
    value: 4,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_bad_hand',
    nameId: 'tableborn_circle_gamblers_bad_hand',
    textId: 'tableborn_circle_gamblers_bad_hand',
    art: 'tableborn_circle_gamblers_bad_hand',
    set: 'tableborn_circle',
    value: 5,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_bluff',
    nameId: 'tableborn_circle_gamblers_bluff',
    textId: 'tableborn_circle_gamblers_bluff',
    art: 'tableborn_circle_gamblers_bluff',
    set: 'tableborn_circle',
    value: 6,
    tribes: ['Human'],
    tags: ['CardMaster'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Human' } },
        },
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Human' } },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'tableborn_circle_gamblers_lucky_draw',
    nameId: 'tableborn_circle_gamblers_lucky_draw',
    textId: 'tableborn_circle_gamblers_lucky_draw',
    art: 'tableborn_circle_gamblers_lucky_draw',
    set: 'tableborn_circle',
    value: 7,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_table_flip',
    nameId: 'tableborn_circle_gamblers_table_flip',
    textId: 'tableborn_circle_gamblers_table_flip',
    art: 'tableborn_circle_gamblers_table_flip',
    set: 'tableborn_circle',
    value: 8,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_final_bet',
    nameId: 'tableborn_circle_gamblers_final_bet',
    textId: 'tableborn_circle_gamblers_final_bet',
    art: 'tableborn_circle_gamblers_final_bet',
    set: 'tableborn_circle',
    value: 9,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
    id: 'tableborn_circle_gamblers_grand_game',
    nameId: 'tableborn_circle_gamblers_grand_game',
    textId: 'tableborn_circle_gamblers_grand_game',
    art: 'tableborn_circle_gamblers_grand_game',
    set: 'tableborn_circle',
    value: 10,
    tribes: ['Human'],
    tags: ['CardMaster'],
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
