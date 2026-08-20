// Pure deck/hand engine for the Card Duel minigame (docs: Card Master NPC,
// src/sim/social/card_duel.ts). No SimContext, no class coupling: any player
// can hold a CardHandState. Determinism: shuffling draws only from the `Rng`
// passed in, never `Math.random`.
//
// This is the former src/sim/minigames/card_hand.ts, moved here and
// generalized from `number` to `CardInstance` so a deck can hold two DIFFERENT
// cards of the same value (docs/prd/card-duel-v2.md section 6.1). Deal,
// shuffle, and reshuffle behavior is unchanged by the move, which is what
// keeps the parity golden still valid.
//
// One of the engine's two declared rng sites (the other is selectors.ts):
// nothing else under card_duel/ may touch the rng, so the golden's draw count
// stays a property of this file alone.

import type { CardId, CardInstance, CardSeat, CardValue } from './types';
import { CARD_VALUES } from './types';

export const DECK_SIZE = 20;
export const STARTING_HAND_SIZE = 4;

// The hand is refilled back to this size after every round, so no effect can
// quietly starve a player of choices by discarding or drawing out of turn
// (docs/prd/card-duel-v2.md section 6.2). Same number as the starting hand:
// they are the same rule seen at two moments.
export const HAND_SIZE = STARTING_HAND_SIZE;

/** Copies of each value a legal deck holds (two of every value 1 to 10). */
export const COPIES_PER_VALUE = 2;

// A card in a live match is an instance of a catalog definition: the deck holds
// two cards per value and they may be different cards, so the hand is keyed by
// instance, not by the number on the face.
export interface CardHandState {
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
}

/** One slot of an authored deck list: which card definition fills it. */
export interface CardDeckEntry {
  cardId: CardId;
  value: CardValue;
}

// The unauthored fallback deck: two plain cards per value, no effects. Used
// until a player has built a deck (and by every test that only cares about the
// numbers). Ids are stable and match the catalog's basic set.
export const BASIC_DECK_LIST: readonly CardDeckEntry[] = CARD_VALUES.flatMap((value) =>
  Array.from({ length: COPIES_PER_VALUE }, (_, copy) => ({
    cardId: `basic_${value}_${copy + 1}`,
    value,
  })),
);

// Instance ids are minted per seat from a fixed stride, so the two sides of a
// match can never collide and an id stays stable for the whole match. The pool
// is closed (deck + hand + discard always totals DECK_SIZE), so no card is ever
// created mid-match and no allocator is needed.
export const CARD_SEAT_IID_STRIDE = 1000;

export function seatIidBase(seat: CardSeat): number {
  return seat === 'a' ? CARD_SEAT_IID_STRIDE : CARD_SEAT_IID_STRIDE * 2;
}

/** Builds one seat's 20 card instances from a deck list, in list order. */
export function buildDeck(seat: CardSeat, entries: readonly CardDeckEntry[]): CardInstance[] {
  const base = seatIidBase(seat);
  return entries.map((entry, i) => ({
    iid: base + i,
    cardId: entry.cardId,
    value: entry.value,
  }));
}

// Fisher-Yates using the shared deterministic Rng. Generic so it shuffles a
// deck list, a card instance array, or a plain number array with one draw
// order.
export function shuffle<T>(rng: { next(): number }, cards: readonly T[]): T[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createCardHand(
  rng: { next(): number },
  seat: CardSeat,
  entries: readonly CardDeckEntry[] = BASIC_DECK_LIST,
): CardHandState {
  const deck = shuffle(rng, buildDeck(seat, entries));
  const hand: CardInstance[] = [];
  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    const card = deck.pop();
    if (card !== undefined) hand.push(card);
  }
  return { deck, hand, discard: [] };
}

// Draws one card into the hand, reshuffling the discard pile back into the
// deck first if the deck is empty (deck+discard is a closed pool of 20).
// Returns whether this draw triggered a reshuffle, so a caller can play a
// distinct shuffle cue for that (rarer) moment.
export function drawOne(rng: { next(): number }, state: CardHandState): boolean {
  let reshuffled = false;
  if (state.deck.length === 0) {
    if (state.discard.length === 0) return false;
    state.deck = shuffle(rng, state.discard);
    state.discard = [];
    reshuffled = true;
  }
  const card = state.deck.pop();
  if (card !== undefined) state.hand.push(card);
  return reshuffled;
}

// Plays (removes) one card by value from the hand into the discard pile.
// Returns the played instance, or null if the hand does not hold that value.
// Kept for the value-keyed callers that predate the instance re-key; playing
// by instance id (playCardByInstance) is what the command path uses.
export function playCard(state: CardHandState, value: number): CardInstance | null {
  const idx = state.hand.findIndex((c) => c.value === value);
  if (idx === -1) return null;
  const [card] = state.hand.splice(idx, 1);
  state.discard.push(card);
  return card;
}

// Plays (removes) one card by INSTANCE id from the hand into the discard pile.
// Returns the played instance, or null if the hand does not hold it: that null
// is the server-side rejection for a client naming a card it does not have.
export function playCardByInstance(state: CardHandState, iid: number): CardInstance | null {
  const idx = state.hand.findIndex((c) => c.iid === iid);
  if (idx === -1) return null;
  const [card] = state.hand.splice(idx, 1);
  state.discard.push(card);
  return card;
}

/** What a refill did, so the caller can play the (rarer) shuffle cue and fire
 *  an onDraw trigger per card that actually arrived. */
export interface CardRefillResult {
  drawn: CardInstance[];
  reshuffled: boolean;
}

// Refills a hand back to HAND_SIZE, one draw at a time. The reshuffle can
// happen MID-REFILL (the deck runs dry on the second of three needed draws),
// and the refill continues through it in the same operation: that is the case a
// naive single-draw implementation gets wrong. If deck plus discard cannot fill
// the hand, the player simply plays with fewer cards rather than the loop
// spinning.
export function refillHand(
  rng: { next(): number },
  state: CardHandState,
  size: number = HAND_SIZE,
): CardRefillResult {
  const drawn: CardInstance[] = [];
  let reshuffled = false;
  while (state.hand.length < size) {
    if (state.deck.length === 0 && state.discard.length === 0) break;
    const before = state.hand.length;
    if (drawOne(rng, state)) reshuffled = true;
    if (state.hand.length === before) break;
    drawn.push(state.hand[state.hand.length - 1]);
  }
  return { drawn, reshuffled };
}
