// Numeric expression evaluator: turns a CardNumericExpr into the number an
// effect amount, a condition threshold, or a rules-text placeholder needs.
//
// Pure and rng-free. Division evaluates EXACTLY (so an authored floor() or
// ceil() means what it says), and `evaluateAmount` truncates at the boundary
// where a number becomes an effect amount or a comparison threshold: card
// values are integers, and a fractional modifier would render as a number no
// tooltip could state.

import {
  boardSide,
  type CardBoard,
  type CardCatalog,
  type CardMatchState,
  counterValue,
  countHistory,
  countHistoryWithTag,
  otherSeat,
  seatForOwner,
  sideOf,
  uniqueTribesPlayed,
} from './match_state';
import type { CardInstance, CardNumericExpr, CardRef, CardSeat, CardZone } from './types';

/** Everything an expression, condition, selector, or effect reads. Built once
 *  per effect application by resolve.ts. */
export interface CardEvalContext {
  state: CardMatchState;
  board: CardBoard;
  catalog: CardCatalog;
  /** The seat that OWNS the effect being evaluated. */
  seat: CardSeat;
  /** The card the effect is authored on, when there is one. */
  thisCard: CardInstance | null;
}

/** Which board side a card reference reads, or null when the reference names a
 *  card that is not on the board this round (a previous card). */
function refSeat(ctx: CardEvalContext, ref: CardRef): CardSeat {
  switch (ref) {
    case 'thisCard':
    case 'myCard':
    case 'myPreviousCard':
      return ctx.seat;
    case 'opponentCard':
    case 'opponentPreviousCard':
      return otherSeat(ctx.seat);
  }
}

function isPreviousRef(ref: CardRef): boolean {
  return ref === 'myPreviousCard' || ref === 'opponentPreviousCard';
}

/** The base value behind a card reference: the face number, unmodified. */
export function baseValueOf(ctx: CardEvalContext, ref: CardRef): number {
  const seat = refSeat(ctx, ref);
  if (isPreviousRef(ref)) return sideOf(ctx.state, seat).previousCard?.value ?? 0;
  if (ref === 'thisCard' && ctx.thisCard) return ctx.thisCard.value;
  return boardSide(ctx.board, seat).baseValue;
}

/** The effective value behind a card reference: every modifier applied so far
 *  this round. A previous card has no live board entry, so its effective value
 *  is the one recorded in history for the round it was played. */
export function effectiveValueOf(ctx: CardEvalContext, ref: CardRef): number {
  const seat = refSeat(ctx, ref);
  if (!isPreviousRef(ref)) return boardSide(ctx.board, seat).effectiveValue;
  const prev = sideOf(ctx.state, seat).previousCard;
  if (!prev) return 0;
  for (let i = ctx.state.history.length - 1; i >= 0; i--) {
    const entry = ctx.state.history[i];
    if (entry.owner === seat && entry.iid === prev.iid) return entry.effectiveValue;
  }
  return prev.value;
}

function zoneCount(ctx: CardEvalContext, seat: CardSeat, zone: CardZone): number {
  const cards = sideOf(ctx.state, seat).cards;
  if (zone === 'hand') return cards.hand.length;
  if (zone === 'deck') return cards.deck.length;
  return cards.discard.length;
}

/** Evaluates one expression to an integer. */
export function evaluateExpr(expr: CardNumericExpr, ctx: CardEvalContext): number {
  switch (expr.type) {
    case 'constant':
      return Math.trunc(expr.value);
    case 'historyCount': {
      const ownerSeat =
        expr.filter.owner === undefined ? null : seatForOwner(ctx.seat, expr.filter.owner);
      return expr.filter.tag === undefined
        ? countHistory(ctx.state, expr.filter, ownerSeat)
        : countHistoryWithTag(ctx.state, expr.filter, ownerSeat, expr.filter.tag, ctx.catalog);
    }
    case 'counter':
      return counterValue(sideOf(ctx.state, seatForOwner(ctx.seat, expr.owner)), expr.counter);
    case 'zoneCount':
      return zoneCount(ctx, seatForOwner(ctx.seat, expr.owner), expr.zone);
    case 'roundNumber':
      return ctx.state.round;
    case 'score':
      return sideOf(ctx.state, seatForOwner(ctx.seat, expr.owner)).roundWins;
    case 'cardValue':
      return expr.value === 'base' ? baseValueOf(ctx, expr.card) : effectiveValueOf(ctx, expr.card);
    case 'uniqueTribesPlayed':
      return uniqueTribesPlayed(ctx.state, seatForOwner(ctx.seat, expr.owner));
    case 'add':
      return expr.terms.reduce((sum, t) => sum + evaluateExpr(t, ctx), 0);
    case 'subtract':
      return evaluateExpr(expr.left, ctx) - evaluateExpr(expr.right, ctx);
    case 'multiply':
      return expr.terms.reduce((product, t) => product * evaluateExpr(t, ctx), 1);
    case 'divide': {
      const right = evaluateExpr(expr.right, ctx);
      // A zero divisor is an authoring mistake, not a runtime state: answer 0
      // rather than minting Infinity or NaN into a card's effective value,
      // which would poison every later comparison in the round.
      if (right === 0) return 0;
      return evaluateExpr(expr.left, ctx) / right;
    }
    case 'min':
      return expr.terms.length === 0 ? 0 : Math.min(...expr.terms.map((t) => evaluateExpr(t, ctx)));
    case 'max':
      return expr.terms.length === 0 ? 0 : Math.max(...expr.terms.map((t) => evaluateExpr(t, ctx)));
    case 'floor':
      return Math.floor(evaluateExpr(expr.of, ctx));
    case 'ceil':
      return Math.ceil(evaluateExpr(expr.of, ctx));
    case 'negate':
      return -evaluateExpr(expr.of, ctx);
  }
}

/** The boundary evaluation: what an effect amount or a condition threshold
 *  actually uses. Truncates toward zero so a card can never carry a fractional
 *  modifier into a comparison. */
export function evaluateAmount(expr: CardNumericExpr, ctx: CardEvalContext): number {
  return Math.trunc(evaluateExpr(expr, ctx));
}

/** Shorthand every card author reaches for. */
export function constant(value: number): CardNumericExpr {
  return { type: 'constant', value };
}
