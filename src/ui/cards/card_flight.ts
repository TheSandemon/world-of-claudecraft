// The card flight: a card physically leaving the hand and landing on the
// table.
//
// One node, mounted on <body>, positioned once at the rectangle the card left
// and then only transformed to the rectangle it lands in. It is pure
// decoration over a state the snapshot has already painted (the committed card
// is on the stage the instant the commit lands), so dropping it costs nothing
// and reduced motion drops it entirely.
//
// The awkward part it exists to solve: by the time the stage shows a committed
// card, the hand cell it came from is GONE (the hand repaints without it). So
// the origin rectangle has to be captured at the moment of the click, before
// the repaint, and handed here afterwards. That is why this takes a rect and
// not an element.

import {
  type FlightRect,
  flightDurationMs,
  flightTransform,
  flightTransformCss,
} from './card_flight_core';

export interface CardFlightOptions {
  /** Where the card started, in viewport coordinates, captured before the
   *  repaint that removed it. */
  from: FlightRect;
  /** Where it lands: the stage slot, read now. */
  to: HTMLElement;
  /** The card's markup, so the thing that flies is the card, not a rectangle. */
  html: string;
  /** Skipped entirely when false (reduced motion). */
  animate: boolean;
}

/**
 * Flies one card from `from` to the box of `to`.
 *
 * Fire and forget: the node removes itself when the move ends, and a caller
 * that fires two flights (both seats committing at once) gets two independent
 * nodes rather than a queue to manage.
 */
export function flyCard(opts: CardFlightOptions): void {
  if (!opts.animate) return;
  const doc = opts.to.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  const target = opts.to.getBoundingClientRect();
  // A destination that has not been laid out yet (a hidden window, a zero-size
  // slot) has nothing to fly to; skipping is correct, since the card is
  // already painted where it belongs.
  if (target.width <= 0 || target.height <= 0) return;
  const move = flightTransform(opts.from, {
    left: target.left,
    top: target.top,
    width: target.width,
    height: target.height,
  });
  const node = doc.createElement('div');
  node.className = 'cf-flight';
  node.setAttribute('aria-hidden', 'true');
  node.style.left = `${Math.round(opts.from.left)}px`;
  node.style.top = `${Math.round(opts.from.top)}px`;
  node.style.width = `${Math.round(opts.from.width)}px`;
  node.style.height = `${Math.round(opts.from.height)}px`;
  node.innerHTML = opts.html;
  doc.body.append(node);
  const ms = flightDurationMs(move);
  // Two frames before the transform: one for the node to exist at its origin,
  // one for the style engine to have committed that origin. Transitioning from
  // a style set in the same frame is the classic silently-instant animation.
  view.requestAnimationFrame(() => {
    view.requestAnimationFrame(() => {
      node.style.transition = `transform ${ms}ms ease-out, opacity ${ms}ms ease-in`;
      node.style.transform = flightTransformCss(move);
      node.style.opacity = '0.85';
    });
  });
  // Cleaned up on a TIMER rather than on transitionend: a transition that never
  // starts (the tab was backgrounded mid-flight, the node was hidden) fires no
  // end event, and a card left pinned over the table would be a bug that
  // outlives the round that caused it.
  view.setTimeout(() => node.remove(), ms + 120);
}
