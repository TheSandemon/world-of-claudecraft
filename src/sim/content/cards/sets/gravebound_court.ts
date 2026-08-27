// Gravebound Court: treat losses and the discard as resources, recovering small Undead again and again.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Gravebound Court readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const GRAVEBOUND_COURT_CARDS: readonly CardDefinition[] = [
  card({
    id: 'gravebound_court_ghosts_wake',
    nameId: 'gravebound_court_ghosts_wake',
    textId: 'gravebound_court_ghosts_wake',
    art: 'gravebound_court_ghosts_wake',
    set: 'gravebound_court',
    value: 1,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_vigil',
    nameId: 'gravebound_court_ghosts_vigil',
    textId: 'gravebound_court_ghosts_vigil',
    art: 'gravebound_court_ghosts_vigil',
    set: 'gravebound_court',
    value: 2,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_supper',
    nameId: 'gravebound_court_ghosts_supper',
    textId: 'gravebound_court_ghosts_supper',
    art: 'gravebound_court_ghosts_supper',
    set: 'gravebound_court',
    value: 3,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_grave_shift',
    nameId: 'gravebound_court_ghosts_grave_shift',
    textId: 'gravebound_court_ghosts_grave_shift',
    art: 'gravebound_court_ghosts_grave_shift',
    set: 'gravebound_court',
    value: 4,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_bell_toll',
    nameId: 'gravebound_court_ghosts_bell_toll',
    textId: 'gravebound_court_ghosts_bell_toll',
    art: 'gravebound_court_ghosts_bell_toll',
    set: 'gravebound_court',
    value: 5,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_procession',
    nameId: 'gravebound_court_ghosts_procession',
    textId: 'gravebound_court_ghosts_procession',
    art: 'gravebound_court_ghosts_procession',
    set: 'gravebound_court',
    value: 6,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
    id: 'gravebound_court_ghosts_crypt_ball',
    nameId: 'gravebound_court_ghosts_crypt_ball',
    textId: 'gravebound_court_ghosts_crypt_ball',
    art: 'gravebound_court_ghosts_crypt_ball',
    set: 'gravebound_court',
    value: 7,
    tribes: ['Undead'],
    tags: ['Dungeon'],
    rarity: 'rare',
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
    id: 'gravebound_court_ghosts_court',
    nameId: 'gravebound_court_ghosts_court',
    textId: 'gravebound_court_ghosts_court',
    art: 'gravebound_court_ghosts_court',
    set: 'gravebound_court',
    value: 8,
    tribes: ['Undead'],
    tags: ['Dungeon'],
    rarity: 'rare',
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
    id: 'gravebound_court_ghosts_coronation',
    nameId: 'gravebound_court_ghosts_coronation',
    textId: 'gravebound_court_ghosts_coronation',
    art: 'gravebound_court_ghosts_coronation',
    set: 'gravebound_court',
    value: 9,
    tribes: ['Undead'],
    tags: ['Dungeon'],
    rarity: 'rare',
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
    id: 'gravebound_court_ghosts_reunion',
    nameId: 'gravebound_court_ghosts_reunion',
    textId: 'gravebound_court_ghosts_reunion',
    art: 'gravebound_court_ghosts_reunion',
    set: 'gravebound_court',
    value: 10,
    tribes: ['Undead'],
    tags: ['Dungeon'],
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
