import { describe, expect, it } from 'vitest';
import {
  CARD_NARRATION_BEATS,
  CARD_NARRATION_MAX_S,
  cardNarrationSeconds,
} from '../src/sim/minigames/card_duel/narration';
import { CARD_DUEL_ROUND_DEADLINE_S } from '../src/sim/minigames/card_duel/rules';

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

  it('keeps a plain round brief', () => {
    // The complaint behind all of this was a round that was over before it
    // could be read; the answer is not a round that drags either.
    expect(cardNarrationSeconds(round(0, 5))).toBeLessThan(2.5);
    expect(cardNarrationSeconds(round(0, 5))).toBeGreaterThan(0.5);
  });

  it('caps a pathological round rather than trusting the sum', () => {
    expect(cardNarrationSeconds(round(50, 9))).toBe(CARD_NARRATION_MAX_S);
  });

  it('never eats a meaningful share of the round clock it pauses', () => {
    // The sim adds this to the next deadline. If the telling could rival the
    // think time it protects, pausing the clock would stop being a courtesy and
    // start being a way to stall a match.
    expect(CARD_NARRATION_MAX_S).toBeLessThan(CARD_DUEL_ROUND_DEADLINE_S / 5);
  });

  it('is a pure function of the round', () => {
    expect(cardNarrationSeconds(round(2, 4))).toBe(cardNarrationSeconds(round(2, 4)));
  });
});
