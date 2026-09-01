import { describe, expect, it } from 'vitest';
import { INSPECT_GAP_PX, placeCardInspect } from '../src/ui/cards/card_inspect_view';

const popup = { width: 208, height: 300 };
const desktop = { width: 1280, height: 800 };
/** A hand card, the size the duel window paints one at. */
const card = { left: 600, top: 400, width: 68, height: 96 };

describe('card inspect placement', () => {
  it('puts the enlarged card beside the one being inspected, never over it', () => {
    const spot = placeCardInspect(card, popup, desktop);
    expect(spot.side).toBe('right');
    expect(spot.left).toBeGreaterThanOrEqual(card.left + card.width);
    // Vertically centred on the card it describes.
    expect(spot.top + popup.height / 2).toBeCloseTo(card.top + card.height / 2, 0);
  });

  it('flips to the other side rather than running off the screen', () => {
    const nearRightEdge = { ...card, left: desktop.width - 100 };
    const spot = placeCardInspect(nearRightEdge, popup, desktop);
    expect(spot.side).toBe('left');
    expect(spot.left + popup.width).toBeLessThanOrEqual(nearRightEdge.left);
    expect(spot.left).toBeGreaterThanOrEqual(INSPECT_GAP_PX);
  });

  it('pulls a popup taller than its card back inside the viewport', () => {
    // The real case: the hand sits at the bottom of the window, so a popup
    // centred on a hand card hangs off the bottom of the screen.
    const spot = placeCardInspect({ ...card, top: 680 }, popup, desktop);
    expect(spot.top).toBeGreaterThanOrEqual(INSPECT_GAP_PX);
    expect(spot.top + popup.height).toBeLessThanOrEqual(desktop.height - INSPECT_GAP_PX);
  });

  it('goes above the card when neither side has room, and below when nothing does', () => {
    const narrow = { width: 380, height: 800 };
    const midCard = { left: 150, top: 500, width: 68, height: 96 };
    expect(placeCardInspect(midCard, popup, narrow).side).toBe('above');
    // A card near the top of a narrow screen has no room above it either.
    expect(placeCardInspect({ ...midCard, top: 40 }, popup, narrow).side).toBe('below');
  });

  it('still returns a placement inside a viewport too small for any side', () => {
    // A landscape phone is about 430px tall: the popup cannot avoid overlapping,
    // and showing the card somewhere beats showing it nowhere.
    const phone = { width: 740, height: 380 };
    const spot = placeCardInspect({ left: 300, top: 240, width: 84, height: 122 }, popup, phone);
    expect(spot.left).toBeGreaterThanOrEqual(INSPECT_GAP_PX);
    expect(spot.top).toBeGreaterThanOrEqual(INSPECT_GAP_PX);
    expect(spot.left + popup.width).toBeLessThanOrEqual(phone.width);
  });

  it('is a pure function of its inputs', () => {
    expect(placeCardInspect(card, popup, desktop)).toEqual(placeCardInspect(card, popup, desktop));
  });
});
