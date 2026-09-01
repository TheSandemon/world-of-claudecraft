// Questbound Caravan: general-purpose utility centered on draws, recovery, and losing gracefully.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Questbound Caravan readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const QUESTBOUND_CARAVAN_CARDS: readonly CardDefinition[] = [
  card({
    id: 'questbound_caravan_travelers_errand',
    nameId: 'questbound_caravan_travelers_errand',
    textId: 'questbound_caravan_travelers_errand',
    art: 'questbound_caravan_travelers_errand',
    set: 'questbound_caravan',
    value: 1,
    tribes: ['Human'],
    tags: ['Profession'],
    rarity: 'uncommon',
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
          match: { maxValue: 3 },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
      },
    ],
  }),
  card({
    id: 'questbound_caravan_travelers_wrong_turn',
    nameId: 'questbound_caravan_travelers_wrong_turn',
    textId: 'questbound_caravan_travelers_wrong_turn',
    art: 'questbound_caravan_travelers_wrong_turn',
    set: 'questbound_caravan',
    value: 2,
    tribes: ['Human'],
    tags: ['Profession'],
    rarity: 'uncommon',
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
    id: 'questbound_caravan_travelers_bridge_stop',
    nameId: 'questbound_caravan_travelers_bridge_stop',
    textId: 'questbound_caravan_travelers_bridge_stop',
    art: 'questbound_caravan_travelers_bridge_stop',
    set: 'questbound_caravan',
    value: 3,
    tribes: ['Human'],
    tags: ['Profession', 'Quest'],
    rarity: 'uncommon',
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
    id: 'questbound_caravan_travelers_camp',
    nameId: 'questbound_caravan_travelers_camp',
    textId: 'questbound_caravan_travelers_camp',
    art: 'questbound_caravan_travelers_camp',
    set: 'questbound_caravan',
    value: 4,
    tribes: ['Human'],
    tags: ['Profession'],
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
    id: 'questbound_caravan_travelers_side_quest',
    nameId: 'questbound_caravan_travelers_side_quest',
    textId: 'questbound_caravan_travelers_side_quest',
    art: 'questbound_caravan_travelers_side_quest',
    set: 'questbound_caravan',
    value: 5,
    tribes: ['Human'],
    tags: ['Profession'],
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
    id: 'questbound_caravan_travelers_cart_fix',
    nameId: 'questbound_caravan_travelers_cart_fix',
    textId: 'questbound_caravan_travelers_cart_fix',
    art: 'questbound_caravan_travelers_cart_fix',
    set: 'questbound_caravan',
    value: 6,
    tribes: ['Human'],
    tags: ['Profession', 'Quest'],
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
    id: 'questbound_caravan_travelers_road_meal',
    nameId: 'questbound_caravan_travelers_road_meal',
    textId: 'questbound_caravan_travelers_road_meal',
    art: 'questbound_caravan_travelers_road_meal',
    set: 'questbound_caravan',
    value: 7,
    tribes: ['Human'],
    tags: ['Profession'],
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
    id: 'questbound_caravan_travelers_lost_map',
    nameId: 'questbound_caravan_travelers_lost_map',
    textId: 'questbound_caravan_travelers_lost_map',
    art: 'questbound_caravan_travelers_lost_map',
    set: 'questbound_caravan',
    value: 8,
    tribes: ['Human'],
    tags: ['Profession'],
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
    id: 'questbound_caravan_travelers_boss_fight',
    nameId: 'questbound_caravan_travelers_boss_fight',
    textId: 'questbound_caravan_travelers_boss_fight',
    art: 'questbound_caravan_travelers_boss_fight',
    set: 'questbound_caravan',
    value: 9,
    tribes: ['Human'],
    tags: ['Profession', 'Quest'],
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
    id: 'questbound_caravan_travelers_homecoming',
    nameId: 'questbound_caravan_travelers_homecoming',
    textId: 'questbound_caravan_travelers_homecoming',
    art: 'questbound_caravan_travelers_homecoming',
    set: 'questbound_caravan',
    value: 10,
    tribes: ['Human'],
    tags: ['Profession'],
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
