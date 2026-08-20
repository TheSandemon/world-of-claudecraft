// Shared Card Duel test fixtures. A live match holds CardInstances, not plain
// numbers, so a suite that wants to force "side A holds a 9" mints an instance
// rather than poking a number into the hand. Kept here (not copied per suite)
// because five suites drive matches this way.

import type { CardInstance, CardValue } from '../../src/sim/minigames/card_duel';

let nextFixtureIid = 900000;

/** One card instance of the given face value, with a unique instance id.
 *  Deterministic per call ORDER, which is all a test needs; production ids
 *  come from the seat stride in deck.ts. */
export function cardOfValue(value: number, cardId = `fixture_${value}`): CardInstance {
  nextFixtureIid += 1;
  return { iid: nextFixtureIid, cardId, value: value as CardValue };
}

/** The face values of a hand, for the value-shaped assertions a suite makes
 *  about what a side is holding. */
export function handValues(cards: readonly CardInstance[]): number[] {
  return cards.map((c) => c.value);
}

/** A whole zone (hand, deck, or discard) built from plain face values. */
export function cardsOfValues(values: readonly number[]): CardInstance[] {
  return values.map((v) => cardOfValue(v));
}
