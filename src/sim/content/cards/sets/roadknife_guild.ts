// Roadknife Guild: trade raw value for hand disruption, selective reveals, and opportunistic draws.
//
// Data-as-code. Every card here is a declarative record over the sanctioned
// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is
// engine logic and no card needs any. One module per design identity, each a
// complete value 1 to 10 run, is what makes Roadknife Guild readable as a
// deck rather than as thirty scattered rows.
//
// `nameId` / `textId` are i18n KEY ids, never English: the English lives in
// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back
// to the procedural card face until a painting is committed.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { card, constant } from '../card_authoring';

export const ROADKNIFE_GUILD_CARDS: readonly CardDefinition[] = [
  card({
    id: 'roadknife_guild_bandits_heist',
    nameId: 'roadknife_guild_bandits_heist',
    textId: 'roadknife_guild_bandits_heist',
    art: 'roadknife_guild_bandits_heist',
    set: 'roadknife_guild',
    value: 1,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
    rarity: 'common',
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
    id: 'roadknife_guild_bandits_lookout',
    nameId: 'roadknife_guild_bandits_lookout',
    textId: 'roadknife_guild_bandits_lookout',
    art: 'roadknife_guild_bandits_lookout',
    set: 'roadknife_guild',
    value: 2,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
    rarity: 'common',
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
    id: 'roadknife_guild_bandits_road_toll',
    nameId: 'roadknife_guild_bandits_road_toll',
    textId: 'roadknife_guild_bandits_road_toll',
    art: 'roadknife_guild_bandits_road_toll',
    set: 'roadknife_guild',
    value: 3,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
    rarity: 'common',
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
    id: 'roadknife_guild_bandits_knife_game',
    nameId: 'roadknife_guild_bandits_knife_game',
    textId: 'roadknife_guild_bandits_knife_game',
    art: 'roadknife_guild_bandits_knife_game',
    set: 'roadknife_guild',
    value: 4,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_bridge_job',
    nameId: 'roadknife_guild_bandits_bridge_job',
    textId: 'roadknife_guild_bandits_bridge_job',
    art: 'roadknife_guild_bandits_bridge_job',
    set: 'roadknife_guild',
    value: 5,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_powder_plot',
    nameId: 'roadknife_guild_bandits_powder_plot',
    textId: 'roadknife_guild_bandits_powder_plot',
    art: 'roadknife_guild_bandits_powder_plot',
    set: 'roadknife_guild',
    value: 6,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_night_raid',
    nameId: 'roadknife_guild_bandits_night_raid',
    textId: 'roadknife_guild_bandits_night_raid',
    art: 'roadknife_guild_bandits_night_raid',
    set: 'roadknife_guild',
    value: 7,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_coach_job',
    nameId: 'roadknife_guild_bandits_coach_job',
    textId: 'roadknife_guild_bandits_coach_job',
    art: 'roadknife_guild_bandits_coach_job',
    set: 'roadknife_guild',
    value: 8,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_guild_vote',
    nameId: 'roadknife_guild_bandits_guild_vote',
    textId: 'roadknife_guild_bandits_guild_vote',
    art: 'roadknife_guild_bandits_guild_vote',
    set: 'roadknife_guild',
    value: 9,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
    id: 'roadknife_guild_bandits_last_score',
    nameId: 'roadknife_guild_bandits_last_score',
    textId: 'roadknife_guild_bandits_last_score',
    art: 'roadknife_guild_bandits_last_score',
    set: 'roadknife_guild',
    value: 10,
    tribes: ['Bandit'],
    tags: ['Eastbrook'],
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
