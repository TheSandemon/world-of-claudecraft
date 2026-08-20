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
//
// One of the folder's declared rng sites, and NOT part of round resolution: a
// policy draws when a seat chooses a card, at the orchestrator's commit step.

import { COPIES_PER_VALUE } from './deck';
import type { CardInstance, CardValue, HandInstanceId } from './types';
import { CARD_VALUES } from './types';

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

/** Highest-valued card in hand, ties broken on instance id so the pick never
 *  depends on where a card sits in the array. */
function highest(hand: readonly CardInstance[]): CardInstance {
  return [...hand].sort((a, b) => b.value - a.value || a.iid - b.iid)[0];
}

function lowest(hand: readonly CardInstance[]): CardInstance {
  return [...hand].sort((a, b) => a.value - b.value || a.iid - b.iid)[0];
}

/** Is this the round that decides the match for one side or the other? */
function roundMatters(view: CardBotView): boolean {
  const oneOff = view.roundsToWin - 1;
  return view.myRounds >= oneOff || view.opponentRounds >= oneOff;
}

/**
 * Novice: uniform random from hand. It teaches nothing and loses to anything,
 * which is exactly right for a first sit-down, and it makes the standalone
 * slice self-playing (a soak test for the engine rather than a hot-seat toy).
 */
export const novicePolicy: CardBotPolicy = (view, rng) => {
  if (view.hand.length === 0) return null;
  return view.hand[Math.floor(rng.next() * view.hand.length)].iid;
};

/**
 * Steady: value heuristics only, no reading of the board. Commit high when the
 * round decides something, dump low when it does not, and never spend a 10 on
 * a round that did not need it. A plausible casual human.
 */
export const steadyPolicy: CardBotPolicy = (view, rng) => {
  if (view.hand.length === 0) return null;
  if (roundMatters(view)) return highest(view.hand).iid;
  // An early, undecided round: shed the cheapest card rather than burning a
  // high one, but stay unpredictable enough to be worth playing against.
  return rng.next() < 0.75 ? lowest(view.hand).iid : novicePolicy(view, rng);
};

/**
 * Sharp: Steady plus the public state. It reads what the opponent has already
 * played, so it knows when a big card is likely to be answered and when it is
 * not, and it punishes a sloppy dump.
 */
export const sharpPolicy: CardBotPolicy = (view, rng) => {
  if (view.hand.length === 0) return null;
  if (roundMatters(view)) return highest(view.hand).iid;
  // The opponent's last card is the only tell the projection carries about
  // their intent, and it is public.
  const theirLast = view.opponentPlayedValues[view.opponentPlayedValues.length - 1];
  if (theirLast !== undefined && theirLast >= 8) {
    // They just spent a big card; the next one is likely small, so a middling
    // card takes the round cheaply.
    const sorted = [...view.hand].sort((a, b) => a.value - b.value || a.iid - b.iid);
    return sorted[Math.min(1, sorted.length - 1)].iid;
  }
  return steadyPolicy(view, rng);
};

/**
 * Master: Sharp plus card counting, which the deck rule makes nearly free.
 * Every legal deck holds exactly two of each value, so after tracking what the
 * opponent has played the bot knows the EXACT multiset still available to them.
 * That is arithmetic, not a heuristic: no search, no evaluation function, no
 * tuning pass.
 */
export function opponentRemainingValues(view: CardBotView): CardValue[] {
  const played = new Map<number, number>();
  for (const value of view.opponentPlayedValues) {
    played.set(value, (played.get(value) ?? 0) + 1);
  }
  const remaining: CardValue[] = [];
  for (const value of CARD_VALUES) {
    const left = COPIES_PER_VALUE - (played.get(value) ?? 0);
    for (let i = 0; i < left; i++) remaining.push(value);
  }
  return remaining;
}

/** The chance a card of `value` beats a card drawn uniformly from what the
 *  opponent could still be holding. Ties count as half, since a push scores
 *  for neither side. */
export function beatChance(value: number, remaining: readonly number[]): number {
  if (remaining.length === 0) return 1;
  let wins = 0;
  let ties = 0;
  for (const other of remaining) {
    if (value > other) wins++;
    else if (value === other) ties++;
  }
  return (wins + ties / 2) / remaining.length;
}

// Master draws no rng at all: with the count in hand every decision is
// arithmetic, so the parameter is accepted (the policy signature is shared)
// and deliberately unused.
export const masterPolicy: CardBotPolicy = (view, _rng) => {
  if (view.hand.length === 0) return null;
  const remaining = opponentRemainingValues(view);
  const scored = [...view.hand]
    .map((card) => ({ card, chance: beatChance(card.value, remaining) }))
    .sort((a, b) => b.chance - a.chance || b.card.value - a.card.value || a.card.iid - b.card.iid);
  if (roundMatters(view)) {
    // The round decides the match: take the surest card, not the biggest.
    return scored[0].card.iid;
  }
  // Otherwise spend the card whose odds are WORST, since holding it only makes
  // the later rounds harder, unless it is already a near-certain winner.
  const cheapest = scored[scored.length - 1];
  return cheapest.chance > 0.85 ? scored[0].card.iid : cheapest.card.iid;
};

const POLICIES: Readonly<Record<CardBotTier, CardBotPolicy>> = {
  novice: novicePolicy,
  steady: steadyPolicy,
  sharp: sharpPolicy,
  master: masterPolicy,
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

/**
 * How long the bot waits before committing, in SIM TICKS.
 *
 * It must not commit the instant the round opens: simultaneous hidden
 * selection is the game's identity, and an opponent who locks in with zero
 * delay both breaks the feel and quietly announces itself as a bot. The delay
 * is drawn from the injected rng and counted in ticks, never wall clock, so the
 * offline Sim, the server, and the headless env agree.
 *
 * Every band fits well inside the round window, so a bot can never time itself
 * out.
 */
export const BOT_COMMIT_TICKS: Readonly<Record<CardBotTier, readonly [number, number]>> = {
  // Novice snaps; Master deliberates. Cheap characterisation, no extra state.
  novice: [10, 24],
  steady: [16, 40],
  sharp: [24, 60],
  master: [30, 80],
};

export function botCommitDelayTicks(tier: CardBotTier, rng: { next(): number }): number {
  const [min, max] = BOT_COMMIT_TICKS[tier];
  return min + Math.floor(rng.next() * (max - min + 1));
}
