// Ironward Assembly: control floors, ceilings, ties, and abilities instead of relying on additive bonuses.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Ironward Assembly readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const IRONWARD_ASSEMBLY_CARDS: readonly CardDefinition[] = [
  card({
    id: 'ironward_assembly_golems_boot',
    nameId: 'ironward_assembly_golems_boot',
    textId: 'ironward_assembly_golems_boot',
    art: 'ironward_assembly_golems_boot',
    set: 'ironward_assembly',
    value: 1,
    tribes: ['Construct'],
    tags: ['Dungeon'],
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
    id: 'ironward_assembly_golems_test_run',
    nameId: 'ironward_assembly_golems_test_run',
    textId: 'ironward_assembly_golems_test_run',
    art: 'ironward_assembly_golems_test_run',
    set: 'ironward_assembly',
    value: 2,
    tribes: ['Construct'],
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
    id: 'ironward_assembly_golems_watch',
    nameId: 'ironward_assembly_golems_watch',
    textId: 'ironward_assembly_golems_watch',
    art: 'ironward_assembly_golems_watch',
    set: 'ironward_assembly',
    value: 3,
    tribes: ['Construct'],
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
    id: 'ironward_assembly_golems_tune_up',
    nameId: 'ironward_assembly_golems_tune_up',
    textId: 'ironward_assembly_golems_tune_up',
    art: 'ironward_assembly_golems_tune_up',
    set: 'ironward_assembly',
    value: 4,
    tribes: ['Construct'],
    tags: ['Dungeon'],
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
    id: 'ironward_assembly_golems_forge_day',
    nameId: 'ironward_assembly_golems_forge_day',
    textId: 'ironward_assembly_golems_forge_day',
    art: 'ironward_assembly_golems_forge_day',
    set: 'ironward_assembly',
    value: 5,
    tribes: ['Construct'],
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
    id: 'ironward_assembly_golems_shield_wall',
    nameId: 'ironward_assembly_golems_shield_wall',
    textId: 'ironward_assembly_golems_shield_wall',
    art: 'ironward_assembly_golems_shield_wall',
    set: 'ironward_assembly',
    value: 6,
    tribes: ['Construct'],
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
    id: 'ironward_assembly_golems_march',
    nameId: 'ironward_assembly_golems_march',
    textId: 'ironward_assembly_golems_march',
    art: 'ironward_assembly_golems_march',
    set: 'ironward_assembly',
    value: 7,
    tribes: ['Construct'],
    tags: ['Dungeon'],
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
    id: 'ironward_assembly_golems_lockdown',
    nameId: 'ironward_assembly_golems_lockdown',
    textId: 'ironward_assembly_golems_lockdown',
    art: 'ironward_assembly_golems_lockdown',
    set: 'ironward_assembly',
    value: 8,
    tribes: ['Construct'],
    tags: ['Dungeon'],
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
    id: 'ironward_assembly_golems_last_stand',
    nameId: 'ironward_assembly_golems_last_stand',
    textId: 'ironward_assembly_golems_last_stand',
    art: 'ironward_assembly_golems_last_stand',
    set: 'ironward_assembly',
    value: 9,
    tribes: ['Construct'],
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
    id: 'ironward_assembly_golems_awakening',
    nameId: 'ironward_assembly_golems_awakening',
    textId: 'ironward_assembly_golems_awakening',
    art: 'ironward_assembly_golems_awakening',
    set: 'ironward_assembly',
    value: 10,
    tribes: ['Construct'],
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
