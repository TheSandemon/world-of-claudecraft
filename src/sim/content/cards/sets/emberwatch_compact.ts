// Emberwatch Compact: comeback cards that improve while behind without forming an automatic all-purpose package.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Emberwatch Compact readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const EMBERWATCH_COMPACT_CARDS: readonly CardDefinition[] = [
  card({
    id: 'emberwatch_compact_wardens_watch',
    nameId: 'emberwatch_compact_wardens_watch',
    textId: 'emberwatch_compact_wardens_watch',
    art: 'emberwatch_compact_wardens_watch',
    set: 'emberwatch_compact',
    value: 1,
    tribes: ['Human'],
    tags: ['Fire', 'Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(5) },
        duration: 'instant',
        textValues: { amount: constant(5), threshold: constant(3) },
      },
      {
        trigger: 'onLose',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Human', maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_lantern_run',
    nameId: 'emberwatch_compact_wardens_lantern_run',
    textId: 'emberwatch_compact_wardens_lantern_run',
    art: 'emberwatch_compact_wardens_lantern_run',
    set: 'emberwatch_compact',
    value: 2,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'player', owner: 'self' },
        effect: { type: 'draw', amount: constant(4) },
        duration: 'instant',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_fire_drill',
    nameId: 'emberwatch_compact_wardens_fire_drill',
    textId: 'emberwatch_compact_wardens_fire_drill',
    art: 'emberwatch_compact_wardens_fire_drill',
    set: 'emberwatch_compact',
    value: 3,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'common',
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
    id: 'emberwatch_compact_wardens_night_shift',
    nameId: 'emberwatch_compact_wardens_night_shift',
    textId: 'emberwatch_compact_wardens_night_shift',
    art: 'emberwatch_compact_wardens_night_shift',
    set: 'emberwatch_compact',
    value: 4,
    tribes: ['Human'],
    tags: ['Fire', 'Eastbrook'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_beacon',
    nameId: 'emberwatch_compact_wardens_beacon',
    textId: 'emberwatch_compact_wardens_beacon',
    art: 'emberwatch_compact_wardens_beacon',
    set: 'emberwatch_compact',
    value: 5,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_muster',
    nameId: 'emberwatch_compact_wardens_muster',
    textId: 'emberwatch_compact_wardens_muster',
    art: 'emberwatch_compact_wardens_muster',
    set: 'emberwatch_compact',
    value: 6,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'uncommon',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'thisComparison',
        textValues: { amount: constant(2) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_rescue',
    nameId: 'emberwatch_compact_wardens_rescue',
    textId: 'emberwatch_compact_wardens_rescue',
    art: 'emberwatch_compact_wardens_rescue',
    set: 'emberwatch_compact',
    value: 7,
    tribes: ['Human'],
    tags: ['Fire', 'Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(3) },
        duration: 'thisComparison',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_last_watch',
    nameId: 'emberwatch_compact_wardens_last_watch',
    textId: 'emberwatch_compact_wardens_last_watch',
    art: 'emberwatch_compact_wardens_last_watch',
    set: 'emberwatch_compact',
    value: 8,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'scoreCompare', op: 'lt' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'emberwatch_compact_wardens_alarm',
    nameId: 'emberwatch_compact_wardens_alarm',
    textId: 'emberwatch_compact_wardens_alarm',
    art: 'emberwatch_compact_wardens_alarm',
    set: 'emberwatch_compact',
    value: 9,
    tribes: ['Human'],
    tags: ['Fire'],
    rarity: 'rare',
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
    id: 'emberwatch_compact_wardens_final_stand',
    nameId: 'emberwatch_compact_wardens_final_stand',
    textId: 'emberwatch_compact_wardens_final_stand',
    art: 'emberwatch_compact_wardens_final_stand',
    set: 'emberwatch_compact',
    value: 10,
    tribes: ['Human'],
    tags: ['Fire', 'Eastbrook'],
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
