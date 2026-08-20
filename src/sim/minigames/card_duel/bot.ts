// The CPU opponent: pure policies over the SAME per-viewer projection a human
// client receives.
//
// That signature is the whole design. The bot cannot peek at the opponent's
// hand because the information is not in its input, the same way it is not in
// the network frame: the bot is fair by CONSTRUCTION, not by discipline. It
// doubles as a completeness check on the projection (if a policy wants a fact
// the view lacks, the human UI is missing it too), and because it is a pure
// function of a view plus a seeded rng, every tier is directly unit-testable
// with no Sim, no match, and no server.

import type { CardInstance, HandInstanceId } from './types';

/** Exactly what a client can see of a live match: its own hand, public
 *  counts, the score, and whatever the opponent has revealed or played. */
export interface CardBotView {
  hand: readonly CardInstance[];
  deckCount: number;
  discardCount: number;
  myRounds: number;
  opponentRounds: number;
  roundsToWin: number;
  round: number;
  myCounters: Readonly<Record<string, number>>;
  opponentCounters: Readonly<Record<string, number>>;
  /** Opponent cards this viewer is entitled to see (a reveal effect fired). */
  opponentRevealed: readonly CardInstance[];
  /** Face values the opponent has already played this match, in order. Public
   *  by the rules: both sides watch every reveal. */
  opponentPlayedValues: readonly number[];
}

/** Difficulty is just which policy runs; adding a tier is a new function and a
 *  catalog row, never an engine change. */
export type CardBotTier = 'novice' | 'steady' | 'sharp' | 'master';

export const CARD_BOT_TIERS: readonly CardBotTier[] = ['novice', 'steady', 'sharp', 'master'];

export type CardBotPolicy = (view: CardBotView, rng: { next(): number }) => HandInstanceId | null;

/**
 * Novice: uniform random from hand. It teaches nothing and loses to anything,
 * which is exactly right for a first sit-down, and it makes the standalone
 * slice self-playing (a soak test for the engine rather than a hot-seat toy).
 */
export const novicePolicy: CardBotPolicy = (view, rng) => {
  if (view.hand.length === 0) return null;
  return view.hand[Math.floor(rng.next() * view.hand.length)].iid;
};

const POLICIES: Readonly<Record<CardBotTier, CardBotPolicy>> = {
  novice: novicePolicy,
  // The three higher tiers land with the named regulars; until then they play
  // the Novice policy rather than silently having no opponent at all.
  steady: novicePolicy,
  sharp: novicePolicy,
  master: novicePolicy,
};

export function policyFor(tier: CardBotTier): CardBotPolicy {
  return POLICIES[tier];
}

/**
 * Picks the card the bot plays this round. Returns null only when the hand is
 * empty, which the round resolution already treats as losing the round.
 */
export function chooseCard(
  view: CardBotView,
  rng: { next(): number },
  tier: CardBotTier = 'novice',
): HandInstanceId | null {
  return policyFor(tier)(view, rng);
}
