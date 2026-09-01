// Mirefen Tide: reveal hands, disrupt choices, and profit from knowing what the opponent can commit.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Mirefen Tide readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const MIREFEN_TIDE_CARDS: readonly CardDefinition[] = [
  card({
    id: 'mirefen_tide_mudfins_puddle',
    nameId: 'mirefen_tide_mudfins_puddle',
    textId: 'mirefen_tide_mudfins_puddle',
    art: 'mirefen_tide_mudfins_puddle',
    set: 'mirefen_tide',
    value: 1,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 6 },
        effect: { type: 'reveal' },
        duration: 'instant',
        textValues: { count: constant(6), discardCount: constant(3) },
      },
      {
        trigger: 'onLose',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 3 },
        effect: { type: 'discard' },
        duration: 'instant',
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_fish_fry',
    nameId: 'mirefen_tide_mudfins_fish_fry',
    textId: 'mirefen_tide_mudfins_fish_fry',
    art: 'mirefen_tide_mudfins_fish_fry',
    set: 'mirefen_tide',
    value: 2,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 5 },
        effect: { type: 'reveal' },
        duration: 'instant',
        textValues: { count: constant(5) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_net_cast',
    nameId: 'mirefen_tide_mudfins_net_cast',
    textId: 'mirefen_tide_mudfins_net_cast',
    art: 'mirefen_tide_mudfins_net_cast',
    set: 'mirefen_tide',
    value: 3,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 3 },
        effect: { type: 'discard' },
        duration: 'instant',
        textValues: { count: constant(3) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_bog_race',
    nameId: 'mirefen_tide_mudfins_bog_race',
    textId: 'mirefen_tide_mudfins_bog_race',
    art: 'mirefen_tide_mudfins_bog_race',
    set: 'mirefen_tide',
    value: 4,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 2 },
        effect: { type: 'discard' },
        duration: 'instant',
        limits: { oncePerRound: true },
        textValues: { count: constant(2) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_reed_raid',
    nameId: 'mirefen_tide_mudfins_reed_raid',
    textId: 'mirefen_tide_mudfins_reed_raid',
    art: 'mirefen_tide_mudfins_reed_raid',
    set: 'mirefen_tide',
    value: 5,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'reveal' },
        duration: 'instant',
        stackMode: 'unique',
        limits: { oncePerMatch: true },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_tide_call',
    nameId: 'mirefen_tide_mudfins_tide_call',
    textId: 'mirefen_tide_mudfins_tide_call',
    art: 'mirefen_tide_mudfins_tide_call',
    set: 'mirefen_tide',
    value: 6,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'player', owner: 'opponent' },
        effect: { type: 'reveal' },
        duration: 'instant',
        stackMode: 'unique',
        limits: { oncePerMatch: true },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_grub_feast',
    nameId: 'mirefen_tide_mudfins_grub_feast',
    textId: 'mirefen_tide_mudfins_grub_feast',
    art: 'mirefen_tide_mudfins_grub_feast',
    set: 'mirefen_tide',
    value: 7,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Human' },
        effect: { type: 'modifyValue', amount: constant(5) },
        duration: 'thisComparison',
        textValues: { amount: constant(5) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_mud_ball',
    nameId: 'mirefen_tide_mudfins_mud_ball',
    textId: 'mirefen_tide_mudfins_mud_ball',
    art: 'mirefen_tide_mudfins_mud_ball',
    set: 'mirefen_tide',
    value: 8,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Human' },
        effect: { type: 'modifyValue', amount: constant(8) },
        duration: 'thisComparison',
        textValues: { amount: constant(8) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_moon_croak',
    nameId: 'mirefen_tide_mudfins_moon_croak',
    textId: 'mirefen_tide_mudfins_moon_croak',
    art: 'mirefen_tide_mudfins_moon_croak',
    set: 'mirefen_tide',
    value: 9,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(3) },
        duration: 'instant',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'mirefen_tide_mudfins_flood',
    nameId: 'mirefen_tide_mudfins_flood',
    textId: 'mirefen_tide_mudfins_flood',
    art: 'mirefen_tide_mudfins_flood',
    set: 'mirefen_tide',
    value: 10,
    tribes: ['Mudfin'],
    tags: ['Mirefen'],
    rarity: 'epic',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 4 },
        effect: { type: 'discard' },
        duration: 'instant',
        textValues: { count: constant(4) },
      },
    ],
  }),
];
