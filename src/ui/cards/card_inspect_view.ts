// Pure view-core for the card inspector: where the enlarged card sits relative
// to the small one the pointer is on.
//
// DOM-free and unit-tested directly (tests/card_inspect_view.test.ts): it takes
// plain rectangles and returns plain coordinates, so the placement can be
// argued about in Node instead of by eye against a phone.
//
// The rule it holds: the popup NEVER covers the card it describes, and never
// leaves the viewport. Those two together are what make it readable at a
// glance; a popup that has drifted half off the screen is worse than no popup,
// and one sitting on top of its own card hides the thing being asked about.

/** A rectangle in viewport (fixed-position) coordinates. */
export interface InspectRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface InspectSize {
  width: number;
  height: number;
}

export interface InspectViewport {
  width: number;
  height: number;
}

/** Which side of the anchor the popup was placed on. Reported so a caller can
 *  point an arrow the right way, and so a test can assert the preference order
 *  rather than only the final numbers. */
export type InspectPlacementSide = 'right' | 'left' | 'above' | 'below';

export interface InspectPlacement {
  left: number;
  top: number;
  side: InspectPlacementSide;
}

/** The breathing room between the card and its enlarged copy, and between the
 *  popup and the edge of the screen. */
export const INSPECT_GAP_PX = 10;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Places the enlarged card beside the one being inspected.
 *
 * Preference order: right, left, above, below. Sideways first because a hand
 * is a horizontal row at the bottom of the window, so a popup beside a card
 * covers table furniture rather than the neighbouring cards a player is
 * comparing it against. The last resort still returns a placement rather than
 * nothing: on a viewport too small for any side, the popup is clamped into
 * view and merely overlaps, because showing the card's text somewhere is the
 * whole point of asking for it.
 */
export function placeCardInspect(
  anchor: InspectRect,
  popup: InspectSize,
  viewport: InspectViewport,
  gap: number = INSPECT_GAP_PX,
): InspectPlacement {
  const fitsRight = anchor.left + anchor.width + gap + popup.width <= viewport.width - gap;
  const fitsLeft = anchor.left - gap - popup.width >= gap;
  const fitsAbove = anchor.top - gap - popup.height >= gap;
  const maxLeft = Math.max(gap, viewport.width - popup.width - gap);
  const maxTop = Math.max(gap, viewport.height - popup.height - gap);
  if (fitsRight || fitsLeft) {
    const side: InspectPlacementSide = fitsRight ? 'right' : 'left';
    const left = fitsRight ? anchor.left + anchor.width + gap : anchor.left - gap - popup.width;
    // Vertically centred on the card, then pulled back inside the viewport:
    // a hand card near the bottom edge would otherwise hang off it.
    const centred = anchor.top + anchor.height / 2 - popup.height / 2;
    return { left: clamp(left, gap, maxLeft), top: clamp(centred, gap, maxTop), side };
  }
  const side: InspectPlacementSide = fitsAbove ? 'above' : 'below';
  const top = fitsAbove ? anchor.top - gap - popup.height : anchor.top + anchor.height + gap;
  const centred = anchor.left + anchor.width / 2 - popup.width / 2;
  return { left: clamp(centred, gap, maxLeft), top: clamp(top, gap, maxTop), side };
}
