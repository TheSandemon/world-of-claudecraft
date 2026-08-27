// Cryptfire Covenant: a second Dread package with riskier losses, Undead links, and match-long pressure.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Cryptfire Covenant readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const CRYPTFIRE_COVENANT_CARDS: readonly CardDefinition[] = [
  card({
    id: 'cryptfire_covenant_fiends_spark',
    nameId: 'cryptfire_covenant_fiends_spark',
    textId: 'cryptfire_covenant_fiends_spark',
    art: 'cryptfire_covenant_fiends_spark',
    set: 'cryptfire_covenant',
    value: 1,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire'],
    rarity: 'uncommon',
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
    id: 'cryptfire_covenant_fiends_grave_raid',
    nameId: 'cryptfire_covenant_fiends_grave_raid',
    textId: 'cryptfire_covenant_fiends_grave_raid',
    art: 'cryptfire_covenant_fiends_grave_raid',
    set: 'cryptfire_covenant',
    value: 2,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire'],
    rarity: 'uncommon',
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
    id: 'cryptfire_covenant_fiends_bone_fire',
    nameId: 'cryptfire_covenant_fiends_bone_fire',
    textId: 'cryptfire_covenant_fiends_bone_fire',
    art: 'cryptfire_covenant_fiends_bone_fire',
    set: 'cryptfire_covenant',
    value: 3,
    tribes: ['Demon', 'Undead'],
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
    id: 'cryptfire_covenant_fiends_soul_hunt',
    nameId: 'cryptfire_covenant_fiends_soul_hunt',
    textId: 'cryptfire_covenant_fiends_soul_hunt',
    art: 'cryptfire_covenant_fiends_soul_hunt',
    set: 'cryptfire_covenant',
    value: 4,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire'],
    rarity: 'rare',
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
    id: 'cryptfire_covenant_fiends_crypt_feast',
    nameId: 'cryptfire_covenant_fiends_crypt_feast',
    textId: 'cryptfire_covenant_fiends_crypt_feast',
    art: 'cryptfire_covenant_fiends_crypt_feast',
    set: 'cryptfire_covenant',
    value: 5,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire'],
    rarity: 'rare',
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
    id: 'cryptfire_covenant_fiends_ash_rite',
    nameId: 'cryptfire_covenant_fiends_ash_rite',
    textId: 'cryptfire_covenant_fiends_ash_rite',
    art: 'cryptfire_covenant_fiends_ash_rite',
    set: 'cryptfire_covenant',
    value: 6,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire', 'Dungeon'],
    rarity: 'rare',
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
    id: 'cryptfire_covenant_fiends_hellgate',
    nameId: 'cryptfire_covenant_fiends_hellgate',
    textId: 'cryptfire_covenant_fiends_hellgate',
    art: 'cryptfire_covenant_fiends_hellgate',
    set: 'cryptfire_covenant',
    value: 7,
    tribes: ['Demon', 'Undead'],
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
    id: 'cryptfire_covenant_fiends_doom_march',
    nameId: 'cryptfire_covenant_fiends_doom_march',
    textId: 'cryptfire_covenant_fiends_doom_march',
    art: 'cryptfire_covenant_fiends_doom_march',
    set: 'cryptfire_covenant',
    value: 8,
    tribes: ['Demon', 'Undead'],
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
    id: 'cryptfire_covenant_fiends_graveburn',
    nameId: 'cryptfire_covenant_fiends_graveburn',
    textId: 'cryptfire_covenant_fiends_graveburn',
    art: 'cryptfire_covenant_fiends_graveburn',
    set: 'cryptfire_covenant',
    value: 9,
    tribes: ['Demon', 'Undead'],
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
    id: 'cryptfire_covenant_fiends_endtime',
    nameId: 'cryptfire_covenant_fiends_endtime',
    textId: 'cryptfire_covenant_fiends_endtime',
    art: 'cryptfire_covenant_fiends_endtime',
    set: 'cryptfire_covenant',
    value: 10,
    tribes: ['Demon', 'Undead'],
    tags: ['Fire'],
    rarity: 'legendary',
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
