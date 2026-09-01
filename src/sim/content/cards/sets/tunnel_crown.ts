// Tunnel Crown: reward uninterrupted Burrower sequencing and establish sturdy value floors.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Tunnel Crown readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const TUNNEL_CROWN_CARDS: readonly CardDefinition[] = [
  card({
    id: 'tunnel_crown_burrowers_dig',
    nameId: 'tunnel_crown_burrowers_dig',
    textId: 'tunnel_crown_burrowers_dig',
    art: 'tunnel_crown_burrowers_dig',
    set: 'tunnel_crown',
    value: 1,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(30) },
        duration: 'thisComparison',
        textValues: { amount: constant(30) },
      },
      {
        trigger: 'beforeCompare',
        effect: { type: 'winTies' },
        duration: 'thisComparison',
        stackMode: 'replace',
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_shift',
    nameId: 'tunnel_crown_burrowers_shift',
    textId: 'tunnel_crown_burrowers_shift',
    art: 'tunnel_crown_burrowers_shift',
    set: 'tunnel_crown',
    value: 2,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'thisComparison',
        textValues: { amount: constant(21) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_cave_in',
    nameId: 'tunnel_crown_burrowers_cave_in',
    textId: 'tunnel_crown_burrowers_cave_in',
    art: 'tunnel_crown_burrowers_cave_in',
    set: 'tunnel_crown',
    value: 3,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(10) },
        duration: 'thisComparison',
        textValues: { amount: constant(10) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_gem_rush',
    nameId: 'tunnel_crown_burrowers_gem_rush',
    textId: 'tunnel_crown_burrowers_gem_rush',
    art: 'tunnel_crown_burrowers_gem_rush',
    set: 'tunnel_crown',
    value: 4,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'addTribe', tribe: 'Burrower' },
        duration: 'thisRound',
        stackMode: 'unique',
        limits: { oncePerRound: true },
        textValues: { amount: constant(6) },
      },
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_lunch_break',
    nameId: 'tunnel_crown_burrowers_lunch_break',
    textId: 'tunnel_crown_burrowers_lunch_break',
    art: 'tunnel_crown_burrowers_lunch_break',
    set: 'tunnel_crown',
    value: 5,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_deep_march',
    nameId: 'tunnel_crown_burrowers_deep_march',
    textId: 'tunnel_crown_burrowers_deep_march',
    art: 'tunnel_crown_burrowers_deep_march',
    set: 'tunnel_crown',
    value: 6,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'thisComparison',
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_rockfall',
    nameId: 'tunnel_crown_burrowers_rockfall',
    textId: 'tunnel_crown_burrowers_rockfall',
    art: 'tunnel_crown_burrowers_rockfall',
    set: 'tunnel_crown',
    value: 7,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(3) },
        duration: 'thisComparison',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_throne_run',
    nameId: 'tunnel_crown_burrowers_throne_run',
    textId: 'tunnel_crown_burrowers_throne_run',
    art: 'tunnel_crown_burrowers_throne_run',
    set: 'tunnel_crown',
    value: 8,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        effect: { type: 'addTribe', tribe: 'Burrower' },
        duration: 'thisRound',
        stackMode: 'unique',
        textValues: { amount: constant(4) },
      },
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_last_tunnel',
    nameId: 'tunnel_crown_burrowers_last_tunnel',
    textId: 'tunnel_crown_burrowers_last_tunnel',
    art: 'tunnel_crown_burrowers_last_tunnel',
    set: 'tunnel_crown',
    value: 9,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Burrower' },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'tunnel_crown_burrowers_uprising',
    nameId: 'tunnel_crown_burrowers_uprising',
    textId: 'tunnel_crown_burrowers_uprising',
    art: 'tunnel_crown_burrowers_uprising',
    set: 'tunnel_crown',
    value: 10,
    tribes: ['Burrower'],
    tags: ['Dungeon'],
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
