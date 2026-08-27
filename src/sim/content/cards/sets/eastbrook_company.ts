// Eastbrook Company: Human handlers prepare the next Beast, encouraging mixed Human and Beast decks.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Eastbrook Company readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const EASTBROOK_COMPANY_CARDS: readonly CardDefinition[] = [
  card({
    id: 'eastbrook_company_rangers_patrol',
    nameId: 'eastbrook_company_rangers_patrol',
    textId: 'eastbrook_company_rangers_patrol',
    art: 'eastbrook_company_rangers_patrol',
    set: 'eastbrook_company',
    value: 1,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(30) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(30) },
      },
      {
        trigger: 'onLose',
        target: {
          type: 'zone',
          owner: 'self',
          zone: 'discard',
          select: 'highest',
          count: 1,
          match: { tribe: 'Beast' },
        },
        effect: { type: 'returnToHand' },
        duration: 'instant',
        stackMode: 'unique',
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_lost_map',
    nameId: 'eastbrook_company_rangers_lost_map',
    textId: 'eastbrook_company_rangers_lost_map',
    art: 'eastbrook_company_rangers_lost_map',
    set: 'eastbrook_company',
    value: 2,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(21) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_dog_walk',
    nameId: 'eastbrook_company_rangers_dog_walk',
    textId: 'eastbrook_company_rangers_dog_walk',
    art: 'eastbrook_company_rangers_dog_walk',
    set: 'eastbrook_company',
    value: 3,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'common',
    effects: [
      {
        trigger: 'onLose',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(15) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(15) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_campfire',
    nameId: 'eastbrook_company_rangers_campfire',
    textId: 'eastbrook_company_rangers_campfire',
    art: 'eastbrook_company_rangers_campfire',
    set: 'eastbrook_company',
    value: 4,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_beast_hunt',
    nameId: 'eastbrook_company_rangers_beast_hunt',
    textId: 'eastbrook_company_rangers_beast_hunt',
    art: 'eastbrook_company_rangers_beast_hunt',
    set: 'eastbrook_company',
    value: 5,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_stable_shift',
    nameId: 'eastbrook_company_rangers_stable_shift',
    textId: 'eastbrook_company_rangers_stable_shift',
    art: 'eastbrook_company_rangers_stable_shift',
    set: 'eastbrook_company',
    value: 6,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onReveal',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_roll_call',
    nameId: 'eastbrook_company_rangers_roll_call',
    textId: 'eastbrook_company_rangers_roll_call',
    art: 'eastbrook_company_rangers_roll_call',
    set: 'eastbrook_company',
    value: 7,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(3) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(3) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_rescue',
    nameId: 'eastbrook_company_rangers_rescue',
    textId: 'eastbrook_company_rangers_rescue',
    art: 'eastbrook_company_rangers_rescue',
    set: 'eastbrook_company',
    value: 8,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_last_watch',
    nameId: 'eastbrook_company_rangers_last_watch',
    textId: 'eastbrook_company_rangers_last_watch',
    art: 'eastbrook_company_rangers_last_watch',
    set: 'eastbrook_company',
    value: 9,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'onWin',
        target: { type: 'nextCard', owner: 'self', match: { tribe: 'Beast' } },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'untilTriggered',
        stackMode: 'unique',
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'eastbrook_company_rangers_victory_march',
    nameId: 'eastbrook_company_rangers_victory_march',
    textId: 'eastbrook_company_rangers_victory_march',
    art: 'eastbrook_company_rangers_victory_march',
    set: 'eastbrook_company',
    value: 10,
    tribes: ['Human'],
    tags: ['Eastbrook'],
    rarity: 'legendary',
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
