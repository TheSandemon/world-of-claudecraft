// Briarpack: build Pack, then convert Pack into value. Low cards establish the engine, high cards cash it in.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Briarpack readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const BRIARPACK_CARDS: readonly CardDefinition[] = [
  card({
    id: 'briarpack_wolfs_nap',
    nameId: 'briarpack_wolfs_nap',
    textId: 'briarpack_wolfs_nap',
    art: 'briarpack_wolfs_nap',
    set: 'briarpack',
    value: 1,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Pack', amount: constant(10) },
        duration: 'instant',
        textValues: { amount: constant(10) },
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
    id: 'briarpack_wolves_hunt',
    nameId: 'briarpack_wolves_hunt',
    textId: 'briarpack_wolves_hunt',
    art: 'briarpack_wolves_hunt',
    set: 'briarpack',
    value: 2,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Pack',
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
    id: 'briarpack_wolves_howl',
    nameId: 'briarpack_wolves_howl',
    textId: 'briarpack_wolves_howl',
    art: 'briarpack_wolves_howl',
    set: 'briarpack',
    value: 3,
    tribes: ['Beast'],
    tags: ['Wolf', 'Eastbrook', 'Nature'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Pack' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Pack' }],
          },
          rate: constant(3),
        },
      },
    ],
  }),
  card({
    id: 'briarpack_wolves_ambush',
    nameId: 'briarpack_wolves_ambush',
    textId: 'briarpack_wolves_ambush',
    art: 'briarpack_wolves_ambush',
    set: 'briarpack',
    value: 4,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Pack', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3), threshold: constant(1) },
      },
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Pack',
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
    id: 'briarpack_wolves_trail',
    nameId: 'briarpack_wolves_trail',
    textId: 'briarpack_wolves_trail',
    art: 'briarpack_wolves_trail',
    set: 'briarpack',
    value: 5,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Pack',
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
    id: 'briarpack_wolves_moonrun',
    nameId: 'briarpack_wolves_moonrun',
    textId: 'briarpack_wolves_moonrun',
    art: 'briarpack_wolves_moonrun',
    set: 'briarpack',
    value: 6,
    tribes: ['Beast'],
    tags: ['Wolf', 'Eastbrook', 'Nature'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: { type: 'counter', owner: 'self', counter: 'Pack' },
        },
        duration: 'thisComparison',
        textValues: {
          amount: { type: 'counter', owner: 'self', counter: 'Pack' },
          rate: constant(1),
        },
      },
    ],
  }),
  card({
    id: 'briarpack_wolves_feast',
    nameId: 'briarpack_wolves_feast',
    textId: 'briarpack_wolves_feast',
    art: 'briarpack_wolves_feast',
    set: 'briarpack',
    value: 7,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Pack', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'briarpack_wolves_siege',
    nameId: 'briarpack_wolves_siege',
    textId: 'briarpack_wolves_siege',
    art: 'briarpack_wolves_siege',
    set: 'briarpack',
    value: 8,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'counterCompare',
          owner: 'self',
          counter: 'Pack',
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
    id: 'briarpack_wolves_overlook',
    nameId: 'briarpack_wolves_overlook',
    textId: 'briarpack_wolves_overlook',
    art: 'briarpack_wolves_overlook',
    set: 'briarpack',
    value: 9,
    tribes: ['Beast'],
    tags: ['Wolf', 'Eastbrook', 'Nature'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Pack' }],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Pack' }],
          },
          rate: constant(3),
        },
      },
    ],
  }),
  card({
    id: 'briarpack_wolves_wild_night',
    nameId: 'briarpack_wolves_wild_night',
    textId: 'briarpack_wolves_wild_night',
    art: 'briarpack_wolves_wild_night',
    set: 'briarpack',
    value: 10,
    tribes: ['Beast'],
    tags: ['Wolf'],
    rarity: 'legendary',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'addCounter', counter: 'Pack', amount: constant(8) },
        duration: 'instant',
        textValues: { amount: constant(8) },
      },
    ],
  }),
];
