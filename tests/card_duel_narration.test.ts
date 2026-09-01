import { describe, expect, it } from 'vitest';
import {
  CARD_NARRATION_BEATS,
  CARD_NARRATION_MAX_S,
  cardNarrationSeconds,
} from '../src/sim/minigames/card_duel/narration';

/** A round with `steps` narratable effects, and whether it dealt damage. */
function round(steps: number, damage = 0) {
  return { log: Array.from({ length: steps }, (_, i) => i), damage };
}

describe('card duel narration clock', () => {
  it('is content-shaped: every effect that happened costs exactly one beat', () => {
    // The rule the whole module exists for. A plain round is short and a busy
    // one takes as long as it earned, rather than every round waiting out one
    // hard-coded length.
    const plain = cardNarrationSeconds(round(0));
    const one = cardNarrationSeconds(round(1));
    const three = cardNarrationSeconds(round(3));
    expect(one - plain).toBeCloseTo(CARD_NARRATION_BEATS.step, 5);
    expect(three - one).toBeCloseTo(CARD_NARRATION_BEATS.step * 2, 5);
  });

  it('pays for the hit only on a round that dealt one', () => {
    expect(cardNarrationSeconds(round(0, 12)) - cardNarrationSeconds(round(0, 0))).toBeCloseTo(
      CARD_NARRATION_BEATS.damage,
      5,
    );
  });

  it('gives a plain round enough time for an eye to follow it', () => {
    // The floor is the complaint this exists for: the beats went by faster
    // than a player could tell which card a number had moved on, twice, and
    // were doubled twice. A plain round with a hit in it is the commonest
    // round in the game, and it now runs long enough to be read beat by beat.
    // The ceiling is loose on purpose: the round clock is HELD for the whole
    // telling, so length costs the player nothing but patience.
    expect(cardNarrationSeconds(round(0, 5))).toBeGreaterThan(6);
    expect(cardNarrationSeconds(round(0, 5))).toBeLessThan(10);
  });

  // NOTE: the old "stay under a fifth of the round clock" pin lived here and is
  // deliberately gone. It was guarding against a telling that ate think time,
  // which cannot happen: the round clock is HELD for the whole telling and the
  // next deadline starts from its end, so a long telling delays the next round
  // and takes nothing from the player. That relationship is pinned where it is
  // actually observable, against the live sim
  // (tests/card_duel.test.ts, "accepts a card the instant the telling ends").
  it('caps a pathological round rather than trusting the sum', () => {
    expect(cardNarrationSeconds(round(50, 9))).toBe(CARD_NARRATION_MAX_S);
  });

  it('is a pure function of the round', () => {
    expect(cardNarrationSeconds(round(2, 4))).toBe(cardNarrationSeconds(round(2, 4)));
  });
});
