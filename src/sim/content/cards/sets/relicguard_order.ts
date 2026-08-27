// Relicguard Order: defensive relic keepers using silence, caps, and tie control with minimal stacking.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Relicguard Order readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const RELICGUARD_ORDER_CARDS: readonly CardDefinition[] = [
  card({
    id: 'relicguard_order_sentinels_vigil',
    nameId: 'relicguard_order_sentinels_vigil',
    textId: 'relicguard_order_sentinels_vigil',
    art: 'relicguard_order_sentinels_vigil',
    set: 'relicguard_order',
    value: 1,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon', 'Quest'],
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
    id: 'relicguard_order_sentinels_key_turn',
    nameId: 'relicguard_order_sentinels_key_turn',
    textId: 'relicguard_order_sentinels_key_turn',
    art: 'relicguard_order_sentinels_key_turn',
    set: 'relicguard_order',
    value: 2,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
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
    id: 'relicguard_order_sentinels_vault_watch',
    nameId: 'relicguard_order_sentinels_vault_watch',
    textId: 'relicguard_order_sentinels_vault_watch',
    art: 'relicguard_order_sentinels_vault_watch',
    set: 'relicguard_order',
    value: 3,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
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
    id: 'relicguard_order_sentinels_seal',
    nameId: 'relicguard_order_sentinels_seal',
    textId: 'relicguard_order_sentinels_seal',
    art: 'relicguard_order_sentinels_seal',
    set: 'relicguard_order',
    value: 4,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon', 'Quest'],
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
    id: 'relicguard_order_sentinels_relic_hunt',
    nameId: 'relicguard_order_sentinels_relic_hunt',
    textId: 'relicguard_order_sentinels_relic_hunt',
    art: 'relicguard_order_sentinels_relic_hunt',
    set: 'relicguard_order',
    value: 5,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
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
    id: 'relicguard_order_sentinels_oath',
    nameId: 'relicguard_order_sentinels_oath',
    textId: 'relicguard_order_sentinels_oath',
    art: 'relicguard_order_sentinels_oath',
    set: 'relicguard_order',
    value: 6,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
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
    id: 'relicguard_order_sentinels_crypt_guard',
    nameId: 'relicguard_order_sentinels_crypt_guard',
    textId: 'relicguard_order_sentinels_crypt_guard',
    art: 'relicguard_order_sentinels_crypt_guard',
    set: 'relicguard_order',
    value: 7,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon', 'Quest'],
    rarity: 'rare',
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
    id: 'relicguard_order_sentinels_gate_lock',
    nameId: 'relicguard_order_sentinels_gate_lock',
    textId: 'relicguard_order_sentinels_gate_lock',
    art: 'relicguard_order_sentinels_gate_lock',
    set: 'relicguard_order',
    value: 8,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
    rarity: 'rare',
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
    id: 'relicguard_order_sentinels_last_watch',
    nameId: 'relicguard_order_sentinels_last_watch',
    textId: 'relicguard_order_sentinels_last_watch',
    art: 'relicguard_order_sentinels_last_watch',
    set: 'relicguard_order',
    value: 9,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon'],
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
    id: 'relicguard_order_sentinels_final_oath',
    nameId: 'relicguard_order_sentinels_final_oath',
    textId: 'relicguard_order_sentinels_final_oath',
    art: 'relicguard_order_sentinels_final_oath',
    set: 'relicguard_order',
    value: 10,
    tribes: ['Construct', 'Spirit'],
    tags: ['Dungeon', 'Quest'],
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
