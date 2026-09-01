import { describe, expect, it } from 'vitest';
import {
  FLIGHT_MAX_MS,
  FLIGHT_MIN_MS,
  flightDurationMs,
  flightTransform,
  flightTransformCss,
} from '../src/ui/cards/card_flight_core';

/** A hand card, and the stage slot it lands in: the real sizes the duel window
 *  paints, since the card also grows on the way. */
const handCard = { left: 100, top: 700, width: 68, height: 96 };
const stageSlot = { left: 300, top: 400, width: 96, height: 148 };

describe('card flight geometry', () => {
  it('moves centre to centre, so the card lands where it is going', () => {
    // Corner to corner drifts off target as the scale grows, which is exactly
    // the case here: a hand card is smaller than a stage card.
    const move = flightTransform(handCard, stageSlot);
    expect(move.dx).toBe(300 + 48 - (100 + 34));
    expect(move.dy).toBe(400 + 74 - (700 + 48));
  });

  it('grows the card to the size of the place it lands in', () => {
    const move = flightTransform(handCard, stageSlot);
    expect(move.scaleX).toBeCloseTo(96 / 68, 5);
    expect(move.scaleY).toBeCloseTo(148 / 96, 5);
  });

  it('leaves the card its own size rather than collapsing it to nothing', () => {
    // A destination that has not been laid out yet reports zero.
    const move = flightTransform(handCard, { left: 0, top: 0, width: 0, height: 0 });
    expect(move.scaleX).toBe(1);
    expect(move.scaleY).toBe(1);
  });

  it('writes a transform-only rule, so the move never touches layout', () => {
    const css = flightTransformCss(flightTransform(handCard, stageSlot));
    expect(css).toBe('translate(214px, -274px) scale(1.41, 1.54)');
    expect(css).not.toContain('left');
    expect(css).not.toContain('top');
  });

  it('scales the duration with the distance, inside its own bounds', () => {
    const near = flightDurationMs(flightTransform(handCard, { ...handCard, left: 120 }));
    const far = flightDurationMs(flightTransform(handCard, { ...handCard, left: 900, top: 100 }));
    expect(near).toBeGreaterThanOrEqual(FLIGHT_MIN_MS);
    expect(near).toBeLessThan(far);
    // A card that has barely moved never takes less than the floor, and one
    // crossing the whole table never takes more than the ceiling.
    expect(flightDurationMs(flightTransform(handCard, handCard))).toBe(FLIGHT_MIN_MS);
    expect(far).toBe(FLIGHT_MAX_MS);
    // A card crossing the table takes longer than one moving an inch, but
    // neither outlives the beat it belongs to.
    expect(flightDurationMs(flightTransform(handCard, stageSlot))).toBeGreaterThan(FLIGHT_MIN_MS);
    expect(flightDurationMs(flightTransform(handCard, stageSlot))).toBeLessThan(FLIGHT_MAX_MS);
  });

  it('is a pure function of the two rectangles', () => {
    expect(flightTransform(handCard, stageSlot)).toEqual(flightTransform(handCard, stageSlot));
  });
});
