// Boneflame Host: recycle cheap threats, with stronger cards paying for recursion through drawbacks.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Boneflame Host readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const BONEFLAME_HOST_CARDS: readonly CardDefinition[] = [
  card({
    id: 'boneflame_host_skeletons_spark',
    nameId: 'boneflame_host_skeletons_spark',
    textId: 'boneflame_host_skeletons_spark',
    art: 'boneflame_host_skeletons_spark',
    set: 'boneflame_host',
    value: 1,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Undead', maxValue: 2 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
        textValues: { drawCount: constant(5), threshold: constant(2) },
      },
      {
        trigger: 'onLose',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(5) },
        duration: 'instant',
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_bone_toss',
    nameId: 'boneflame_host_skeletons_bone_toss',
    textId: 'boneflame_host_skeletons_bone_toss',
    art: 'boneflame_host_skeletons_bone_toss',
    set: 'boneflame_host',
    value: 2,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Undead', maxValue: 2 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
        textValues: { threshold: constant(2) },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_ash_dance',
    nameId: 'boneflame_host_skeletons_ash_dance',
    textId: 'boneflame_host_skeletons_ash_dance',
    art: 'boneflame_host_skeletons_ash_dance',
    set: 'boneflame_host',
    value: 3,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
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
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(5),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
          rate: constant(5),
        },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_grave_run',
    nameId: 'boneflame_host_skeletons_grave_run',
    textId: 'boneflame_host_skeletons_grave_run',
    art: 'boneflame_host_skeletons_grave_run',
    set: 'boneflame_host',
    value: 4,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [
              constant(3),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(3),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
          rate: constant(3),
        },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_fire_walk',
    nameId: 'boneflame_host_skeletons_fire_walk',
    textId: 'boneflame_host_skeletons_fire_walk',
    art: 'boneflame_host_skeletons_fire_walk',
    set: 'boneflame_host',
    value: 5,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: {
          type: 'modifyValue',
          amount: {
            type: 'multiply',
            terms: [
              constant(2),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
        },
        duration: 'thisComparison',
        textValues: {
          amount: {
            type: 'multiply',
            terms: [
              constant(2),
              { type: 'historyCount', filter: { owner: 'self', tribe: 'Undead', result: 'lose' } },
            ],
          },
          rate: constant(2),
        },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_pyre',
    nameId: 'boneflame_host_skeletons_pyre',
    textId: 'boneflame_host_skeletons_pyre',
    art: 'boneflame_host_skeletons_pyre',
    set: 'boneflame_host',
    value: 6,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onWin',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Undead', maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
        limits: { oncePerRound: true },
        textValues: { threshold: constant(3) },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_crypt_roast',
    nameId: 'boneflame_host_skeletons_crypt_roast',
    textId: 'boneflame_host_skeletons_crypt_roast',
    art: 'boneflame_host_skeletons_crypt_roast',
    set: 'boneflame_host',
    value: 7,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Undead', maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
        limits: { oncePerRound: true },
        textValues: { threshold: constant(3) },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_last_march',
    nameId: 'boneflame_host_skeletons_last_march',
    textId: 'boneflame_host_skeletons_last_march',
    art: 'boneflame_host_skeletons_last_march',
    set: 'boneflame_host',
    value: 8,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Undead', maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
        textValues: { threshold: constant(3) },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_bone_feast',
    nameId: 'boneflame_host_skeletons_bone_feast',
    textId: 'boneflame_host_skeletons_bone_feast',
    art: 'boneflame_host_skeletons_bone_feast',
    set: 'boneflame_host',
    value: 9,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'boneflame_host_skeletons_inferno',
    nameId: 'boneflame_host_skeletons_inferno',
    textId: 'boneflame_host_skeletons_inferno',
    art: 'boneflame_host_skeletons_inferno',
    set: 'boneflame_host',
    value: 10,
    tribes: ['Undead', 'Demon'],
    tags: ['Fire'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self' },
        effect: { type: 'modifyValue', amount: constant(16) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(16) },
      },
    ],
  }),
];
