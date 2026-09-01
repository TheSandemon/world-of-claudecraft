// Crownless Legends: a loose legendary line with one-off history mechanics rather than one tribal engine.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Crownless Legends readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const CROWNLESS_LEGENDS_CARDS: readonly CardDefinition[] = [
  card({
    id: 'crownless_legends_whisper',
    nameId: 'crownless_legends_whisper',
    textId: 'crownless_legends_whisper',
    art: 'crownless_legends_whisper',
    set: 'crownless_legends',
    value: 1,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Spirit' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(5),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Spirit' } },
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
    id: 'crownless_legends_exile',
    nameId: 'crownless_legends_exile',
    textId: 'crownless_legends_exile',
    art: 'crownless_legends_exile',
    set: 'crownless_legends',
    value: 2,
    tribes: ['Spirit'],
    tags: ['RareMob', 'Boss'],
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
    id: 'crownless_legends_broken_oath',
    nameId: 'crownless_legends_broken_oath',
    textId: 'crownless_legends_broken_oath',
    art: 'crownless_legends_broken_oath',
    set: 'crownless_legends',
    value: 3,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
    id: 'crownless_legends_empty_hall',
    nameId: 'crownless_legends_empty_hall',
    textId: 'crownless_legends_empty_hall',
    art: 'crownless_legends_empty_hall',
    set: 'crownless_legends',
    value: 4,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
    id: 'crownless_legends_last_song',
    nameId: 'crownless_legends_last_song',
    textId: 'crownless_legends_last_song',
    art: 'crownless_legends_last_song',
    set: 'crownless_legends',
    value: 5,
    tribes: ['Spirit'],
    tags: ['RareMob', 'Boss'],
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
    id: 'crownless_legends_ghost_court',
    nameId: 'crownless_legends_ghost_court',
    textId: 'crownless_legends_ghost_court',
    art: 'crownless_legends_ghost_court',
    set: 'crownless_legends',
    value: 6,
    tribes: ['Spirit'],
    tags: ['RareMob'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Spirit' } },
        },
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'historyCount', filter: { owner: 'self', tribe: 'Spirit' } },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'crownless_legends_lost_crown',
    nameId: 'crownless_legends_lost_crown',
    textId: 'crownless_legends_lost_crown',
    art: 'crownless_legends_lost_crown',
    set: 'crownless_legends',
    value: 7,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
    id: 'crownless_legends_kingless_feast',
    nameId: 'crownless_legends_kingless_feast',
    textId: 'crownless_legends_kingless_feast',
    art: 'crownless_legends_kingless_feast',
    set: 'crownless_legends',
    value: 8,
    tribes: ['Spirit'],
    tags: ['RareMob', 'Boss'],
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
    id: 'crownless_legends_final_war',
    nameId: 'crownless_legends_final_war',
    textId: 'crownless_legends_final_war',
    art: 'crownless_legends_final_war',
    set: 'crownless_legends',
    value: 9,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
    id: 'crownless_legends_return',
    nameId: 'crownless_legends_return',
    textId: 'crownless_legends_return',
    art: 'crownless_legends_return',
    set: 'crownless_legends',
    value: 10,
    tribes: ['Spirit'],
    tags: ['RareMob'],
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
