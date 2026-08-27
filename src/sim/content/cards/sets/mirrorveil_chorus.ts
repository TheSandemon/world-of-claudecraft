// Mirrorveil Chorus: copy, exchange, and invert values. Individual cards are unusual rather than linear.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Mirrorveil Chorus readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const MIRRORVEIL_CHORUS_CARDS: readonly CardDefinition[] = [
  card({
    id: 'mirrorveil_chorus_spirits_glance',
    nameId: 'mirrorveil_chorus_spirits_glance',
    textId: 'mirrorveil_chorus_spirits_glance',
    art: 'mirrorveil_chorus_spirits_glance',
    set: 'mirrorveil_chorus',
    value: 1,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onReveal',
        effect: { type: 'reverseComparison' },
        duration: 'thisComparison',
        stackMode: 'unique',
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
    id: 'mirrorveil_chorus_spirits_echo',
    nameId: 'mirrorveil_chorus_spirits_echo',
    textId: 'mirrorveil_chorus_spirits_echo',
    art: 'mirrorveil_chorus_spirits_echo',
    set: 'mirrorveil_chorus',
    value: 2,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'winTies' },
        duration: 'thisComparison',
        stackMode: 'unique',
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_double_take',
    nameId: 'mirrorveil_chorus_spirits_double_take',
    textId: 'mirrorveil_chorus_spirits_double_take',
    art: 'mirrorveil_chorus_spirits_double_take',
    set: 'mirrorveil_chorus',
    value: 3,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'minimumValue', amount: constant(8) },
        duration: 'thisComparison',
        stackMode: 'highest',
        textValues: { amount: constant(8) },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_mirror_game',
    nameId: 'mirrorveil_chorus_spirits_mirror_game',
    textId: 'mirrorveil_chorus_spirits_mirror_game',
    art: 'mirrorveil_chorus_spirits_mirror_game',
    set: 'mirrorveil_chorus',
    value: 4,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(4) },
        duration: 'thisComparison',
        stackMode: 'lowest',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_glass_dance',
    nameId: 'mirrorveil_chorus_spirits_glass_dance',
    textId: 'mirrorveil_chorus_spirits_glass_dance',
    art: 'mirrorveil_chorus_spirits_glass_dance',
    set: 'mirrorveil_chorus',
    value: 5,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'setValue',
          amount: { type: 'cardValue', card: 'opponentCard', value: 'base' },
        },
        duration: 'thisComparison',
        stackMode: 'replace',
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_name_swap',
    nameId: 'mirrorveil_chorus_spirits_name_swap',
    textId: 'mirrorveil_chorus_spirits_name_swap',
    art: 'mirrorveil_chorus_spirits_name_swap',
    set: 'mirrorveil_chorus',
    value: 6,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'opponentCard' },
        effect: { type: 'silence' },
        duration: 'thisRound',
        stackMode: 'unique',
        limits: { oncePerMatch: true },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_lost_face',
    nameId: 'mirrorveil_chorus_spirits_lost_face',
    textId: 'mirrorveil_chorus_spirits_lost_face',
    art: 'mirrorveil_chorus_spirits_lost_face',
    set: 'mirrorveil_chorus',
    value: 7,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'swapValues' },
        duration: 'thisComparison',
        stackMode: 'unique',
        limits: { oncePerMatch: true },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_hall_walk',
    nameId: 'mirrorveil_chorus_spirits_hall_walk',
    textId: 'mirrorveil_chorus_spirits_hall_walk',
    art: 'mirrorveil_chorus_spirits_hall_walk',
    set: 'mirrorveil_chorus',
    value: 8,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'minimumValue', amount: constant(9) },
        duration: 'thisComparison',
        stackMode: 'highest',
        textValues: { amount: constant(9) },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_shattering',
    nameId: 'mirrorveil_chorus_spirits_shattering',
    textId: 'mirrorveil_chorus_spirits_shattering',
    art: 'mirrorveil_chorus_spirits_shattering',
    set: 'mirrorveil_chorus',
    value: 9,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(2) },
        duration: 'thisComparison',
        stackMode: 'lowest',
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'mirrorveil_chorus_spirits_encore',
    nameId: 'mirrorveil_chorus_spirits_encore',
    textId: 'mirrorveil_chorus_spirits_encore',
    art: 'mirrorveil_chorus_spirits_encore',
    set: 'mirrorveil_chorus',
    value: 10,
    tribes: ['Spirit'],
    tags: ['Quest'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self' },
        effect: { type: 'modifyValue', amount: constant(24) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(24) },
      },
    ],
  }),
];
