// Fenward Hunters: flexible hunters that punish Spider cards and high commitments in the Mirefen matchup.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Fenward Hunters readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const FENWARD_HUNTERS_CARDS: readonly CardDefinition[] = [
  card({
    id: 'fenward_hunters_scout',
    nameId: 'fenward_hunters_scout',
    textId: 'fenward_hunters_scout',
    art: 'fenward_hunters_scout',
    set: 'fenward_hunters',
    value: 1,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(6),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-30) },
        duration: 'thisComparison',
        textValues: { amount: constant(30), threshold: constant(6) },
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
    id: 'fenward_hunters_net_cast',
    nameId: 'fenward_hunters_net_cast',
    textId: 'fenward_hunters_net_cast',
    art: 'fenward_hunters_net_cast',
    set: 'fenward_hunters',
    value: 2,
    tribes: ['Human'],
    tags: ['Mirefen', 'Quest'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(6),
        },
        effect: { type: 'modifyValue', amount: constant(21) },
        duration: 'thisComparison',
        textValues: { amount: constant(21), threshold: constant(6) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_bog_hunt',
    nameId: 'fenward_hunters_bog_hunt',
    textId: 'fenward_hunters_bog_hunt',
    art: 'fenward_hunters_bog_hunt',
    set: 'fenward_hunters',
    value: 3,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'common',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(7),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-10) },
        duration: 'thisComparison',
        textValues: { amount: constant(10), threshold: constant(7) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_spider_trap',
    nameId: 'fenward_hunters_spider_trap',
    textId: 'fenward_hunters_spider_trap',
    art: 'fenward_hunters_spider_trap',
    set: 'fenward_hunters',
    value: 4,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Spider' },
        effect: { type: 'modifyValue', amount: constant(6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_trail',
    nameId: 'fenward_hunters_trail',
    textId: 'fenward_hunters_trail',
    art: 'fenward_hunters_trail',
    set: 'fenward_hunters',
    value: 5,
    tribes: ['Human'],
    tags: ['Mirefen', 'Quest'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(8),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4), threshold: constant(8) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_night_hunt',
    nameId: 'fenward_hunters_night_hunt',
    textId: 'fenward_hunters_night_hunt',
    art: 'fenward_hunters_night_hunt',
    set: 'fenward_hunters',
    value: 6,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(8),
        },
        effect: { type: 'modifyValue', amount: constant(2) },
        duration: 'thisComparison',
        textValues: { amount: constant(2), threshold: constant(8) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_web_raid',
    nameId: 'fenward_hunters_web_raid',
    textId: 'fenward_hunters_web_raid',
    art: 'fenward_hunters_web_raid',
    set: 'fenward_hunters',
    value: 7,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(9),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-3) },
        duration: 'thisComparison',
        textValues: { amount: constant(3), threshold: constant(9) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_mire_watch',
    nameId: 'fenward_hunters_mire_watch',
    textId: 'fenward_hunters_mire_watch',
    art: 'fenward_hunters_mire_watch',
    set: 'fenward_hunters',
    value: 8,
    tribes: ['Human'],
    tags: ['Mirefen', 'Quest'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Spider' },
        effect: { type: 'modifyValue', amount: constant(4) },
        duration: 'thisComparison',
        textValues: { amount: constant(4) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_queen_hunt',
    nameId: 'fenward_hunters_queen_hunt',
    textId: 'fenward_hunters_queen_hunt',
    art: 'fenward_hunters_queen_hunt',
    set: 'fenward_hunters',
    value: 9,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'rare',
    effects: [
      {
        trigger: 'beforeCompare',
        conditions: {
          type: 'valueCompare',
          card: 'opponentCard',
          value: 'base',
          op: 'gte',
          amount: constant(9),
        },
        target: { type: 'opponentCard' },
        effect: { type: 'modifyValue', amount: constant(-6) },
        duration: 'thisComparison',
        textValues: { amount: constant(6), threshold: constant(9) },
      },
    ],
  }),
  card({
    id: 'fenward_hunters_homecoming',
    nameId: 'fenward_hunters_homecoming',
    textId: 'fenward_hunters_homecoming',
    art: 'fenward_hunters_homecoming',
    set: 'fenward_hunters',
    value: 10,
    tribes: ['Human'],
    tags: ['Mirefen'],
    rarity: 'legendary',
    effects: [
      {
        trigger: 'beforeCompare',
        target: { type: 'opponentCard' },
        effect: { type: 'maximumValue', amount: constant(1) },
        duration: 'thisComparison',
        stackMode: 'lowest',
        textValues: { amount: constant(1) },
      },
    ],
  }),
];
