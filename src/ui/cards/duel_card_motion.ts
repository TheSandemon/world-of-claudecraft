// Where a ClaudeStone match card physically GOES: hand to table, table to discard, for
// both seats.
//
// The table could say what every card was worth and never showed one moving.
// A card left the hand and reappeared on the stage; at the end of the round it
// stopped existing. Both are the one thing a card game always does on screen,
// and doing neither is why a round could be read but not followed.
//
// This module owns all four of those moves and nothing else. It is the only
// place that measures a rectangle (`card_flight.ts` does the transform,
// `card_flight_core.ts` the geometry), which keeps every layout read for the
// whole feature in one file the window does not have to think about.
//
// PURE DECORATION over state the snapshot has already painted: the committed
// card is on the stage the instant the commit lands, and the discard count has
// already moved by the time a card flies into the pile. Reduced motion drops
// every flight and loses nothing.

import { flyCard } from './card_flight';
import type { FlightRect } from './card_flight_core';
import { resolveDuelMotion } from './duel_theater_host';

/** The elements the flights start and end at. Resolved by the window, which
 *  owns the markup; null for a surface that has no such place. */
export interface DuelMotionAnchors {
  /** The stage: where both seats' cards meet. */
  stage: HTMLElement;
  /** The board (both seat bands plus the stage), and therefore where both
   *  discard piles are. */
  board: HTMLElement | null;
  /** The opponent's hand row: the origin of THEIR commit. */
  oppoHand: HTMLElement | null;
}

/** Which seats put a card down on THIS paint. Not who is committed: a card
 *  already on the table must not fly again when the other seat's commit
 *  repaints the stage. */
export interface DuelCommitted {
  mine: boolean;
  theirs: boolean;
}

/** A card measured where it sat, captured before the repaint that removed it. */
export interface DuelCardOrigin {
  from: FlightRect;
  html: string;
}

function rectOf(el: Element): FlightRect {
  const box = el.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/** A box with no size has not been laid out (a hidden window, a collapsed
 *  row): there is nothing to fly to or from, and skipping is correct, because
 *  the card is already painted where it belongs. */
function laidOut(rect: FlightRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

/**
 * Whether flights run at all: only at FULL motion.
 *
 * A flight is the one thing here that is pure movement, and it is the one part
 * of the round a player loses nothing by not seeing: the card is already on the
 * table (or already in the pile) the instant the snapshot says so. So `calm`
 * keeps every beat and its ring and drops these, which is the whole shape of
 * that level: the round is still told, it just stops flying around.
 */
function animates(stage: HTMLElement): boolean {
  return resolveDuelMotion(stage.ownerDocument) === 'full';
}

function slotIn(stage: HTMLElement, side: 'mine' | 'theirs'): HTMLElement | null {
  return stage.querySelector(`[data-cd-slot="${side}"]`);
}

function discardPileFor(board: HTMLElement | null, side: 'mine' | 'theirs'): HTMLElement | null {
  if (!board) return null;
  return board.querySelector(`.dt-seat-${side} [data-pile="discard"]`);
}

/**
 * The viewer's own card, from the hand cell it was clicked in to its place on
 * the stage.
 *
 * Takes an ORIGIN rather than an element because by the time the stage shows
 * the card, the hand has repainted without it and there is nothing left to
 * measure. The caller captures the rectangle on the click.
 */
export function flyOwnCommit(anchors: DuelMotionAnchors, origin: DuelCardOrigin): void {
  const slot = slotIn(anchors.stage, 'mine');
  if (!slot) return;
  flyCard({ from: origin.from, to: slot, html: origin.html, animate: animates(anchors.stage) });
}

/**
 * The opponent's card, from their hand to their place on the stage.
 *
 * A face-down BACK, because that is honestly all this client knows: their hand
 * is a row of backs and their card is not revealed until the round turns. It
 * flies from the last place in their hand rather than a specific card, since
 * no place in that row is the one they played (they are all backs), and the
 * row is the thing a player watched it leave.
 */
export function flyOpponentCommit(anchors: DuelMotionAnchors): void {
  const slot = slotIn(anchors.stage, 'theirs');
  if (!slot || !anchors.oppoHand) return;
  const backs = anchors.oppoHand.querySelectorAll('.dt-oppo-back');
  const source: Element | null = backs.length > 0 ? backs[backs.length - 1] : anchors.oppoHand;
  const from = rectOf(source);
  if (!laidOut(from)) return;
  flyCard({
    from,
    to: slot,
    html: '<span class="dt-oppo-back"></span>',
    animate: animates(anchors.stage),
  });
}

/**
 * Both cards leaving the finished round for the discard piles.
 *
 * Fired on the `settle` beat, the moment the round is fully told. The plates,
 * the verdict and the caption stay up (the result is still being read); it is
 * the CARDS that are spent, and they end by shrinking into the pile that now
 * holds them rather than blinking out of existence.
 *
 * The stage is marked `data-swept` so the originals clear as their copies fly.
 * Without it the table would briefly show each card twice, which is worse than
 * showing it leave.
 */
export function flyStageToDiscard(anchors: DuelMotionAnchors): void {
  if (!animates(anchors.stage)) return;
  let swept = false;
  for (const side of ['mine', 'theirs'] as const) {
    const slot = slotIn(anchors.stage, side);
    const pile = discardPileFor(anchors.board, side);
    if (!slot || !pile) continue;
    const from = rectOf(slot);
    if (!laidOut(from)) continue;
    flyCard({
      from,
      to: pile,
      html: slot.innerHTML,
      animate: true,
      // Into the pile, not onto it: the pile shows a count, never the card.
      endOpacity: 0,
    });
    swept = true;
  }
  if (swept) anchors.stage.dataset.swept = 'yes';
}

/** Clears the swept mark, so the next round's cards are visible on the stage
 *  they are dealt to. Called by whatever repaints the stage. */
export function clearSweptMark(stage: HTMLElement): void {
  if (stage.dataset.swept) stage.removeAttribute('data-swept');
}
