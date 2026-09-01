// Condition tree evaluator: the IF half of the card grammar. ALL / ANY / NOT
// compose the leaves, which is what keeps expressiveness high without minting
// new leaf kinds per card.
//
// Pure and rng-free. An empty ALL is true and an empty ANY is false, matching
// the usual algebra, so a card with no conditions always resolves.

import { type CardEvalContext, evaluateAmount } from './expressions';
import {
  boardSide,
  counterValue,
  countHistory,
  countHistoryWithTag,
  otherSeat,
  seatForOwner,
  sideOf,
  uniqueTribesPlayed,
} from './match_state';
import type { CardCompareOp, CardConditionTree, CardRef, CardSeat, CardTribe } from './types';

export function compare(op: CardCompareOp, left: number, right: number): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
  }
}

function seatOfRef(ctx: CardEvalContext, ref: CardRef): CardSeat {
  return ref === 'opponentCard' || ref === 'opponentPreviousCard' ? otherSeat(ctx.seat) : ctx.seat;
}

/** The tribes a card reference currently carries. A board card reads its LIVE
 *  tribe list (addTribe/removeTribe edit it this round); a previous card reads
 *  the tribes recorded in history for the round it was played, so a Beast that
 *  was only a Beast because of a modifier still counts as one afterwards. */
export function tribesOf(ctx: CardEvalContext, ref: CardRef): readonly CardTribe[] {
  const seat = seatOfRef(ctx, ref);
  if (ref !== 'myPreviousCard' && ref !== 'opponentPreviousCard') {
    return boardSide(ctx.board, seat).tribes;
  }
  const prev = sideOf(ctx.state, seat).previousCard;
  if (!prev) return [];
  for (let i = ctx.state.history.length - 1; i >= 0; i--) {
    const entry = ctx.state.history[i];
    if (entry.owner === seat && entry.iid === prev.iid) return entry.tribes;
  }
  return ctx.catalog.get(prev.cardId)?.tribes ?? [];
}

function tagsOf(ctx: CardEvalContext, ref: CardRef): readonly string[] {
  const seat = seatOfRef(ctx, ref);
  if (ref !== 'myPreviousCard' && ref !== 'opponentPreviousCard') {
    return boardSide(ctx.board, seat).tags;
  }
  const prev = sideOf(ctx.state, seat).previousCard;
  return prev ? (ctx.catalog.get(prev.cardId)?.tags ?? []) : [];
}

export function evaluateCondition(tree: CardConditionTree, ctx: CardEvalContext): boolean {
  switch (tree.type) {
    case 'all':
      return tree.of.every((c) => evaluateCondition(c, ctx));
    case 'any':
      return tree.of.some((c) => evaluateCondition(c, ctx));
    case 'not':
      return !evaluateCondition(tree.of, ctx);
    case 'hasTribe':
      return tribesOf(ctx, tree.card).includes(tree.tribe);
    case 'hasTag':
      return tagsOf(ctx, tree.card).includes(tree.tag);
    case 'valueCompare': {
      const ref = tree.card;
      const left =
        tree.value === 'base'
          ? // Deliberately routed through the expression layer so both value
            // kinds read exactly the same state a `cardValue` expression does.
            evaluateAmount({ type: 'cardValue', card: ref, value: 'base' }, ctx)
          : evaluateAmount({ type: 'cardValue', card: ref, value: 'effective' }, ctx);
      return compare(tree.op, left, evaluateAmount(tree.amount, ctx));
    }
    case 'previousResult': {
      const seat = seatForOwner(ctx.seat, tree.owner);
      return sideOf(ctx.state, seat).previousResult === tree.result;
    }
    case 'scoreCompare': {
      const mine = sideOf(ctx.state, ctx.seat).roundWins;
      const theirs = sideOf(ctx.state, otherSeat(ctx.seat)).roundWins;
      // With no amount the comparison is score against the OPPONENT's score
      // ("you are losing"); with one it is score against that number.
      const right = tree.amount === undefined ? theirs : evaluateAmount(tree.amount, ctx);
      return compare(tree.op, mine, right);
    }
    case 'roundCompare':
      return compare(tree.op, ctx.state.round, evaluateAmount(tree.amount, ctx));
    case 'historyCompare': {
      const ownerSeat =
        tree.filter.owner === undefined ? null : seatForOwner(ctx.seat, tree.filter.owner);
      const count =
        tree.filter.tag === undefined
          ? countHistory(ctx.state, tree.filter, ownerSeat)
          : countHistoryWithTag(ctx.state, tree.filter, ownerSeat, tree.filter.tag, ctx.catalog);
      return compare(tree.op, count, evaluateAmount(tree.amount, ctx));
    }
    case 'counterCompare': {
      const side = sideOf(ctx.state, seatForOwner(ctx.seat, tree.owner));
      return compare(tree.op, counterValue(side, tree.counter), evaluateAmount(tree.amount, ctx));
    }
    case 'uniqueTribesCompare': {
      const seat = seatForOwner(ctx.seat, tree.owner);
      return compare(
        tree.op,
        uniqueTribesPlayed(ctx.state, seat),
        evaluateAmount(tree.amount, ctx),
      );
    }
    case 'consecutive': {
      const side = sideOf(ctx.state, seatForOwner(ctx.seat, tree.owner));
      // A tie streak is not tracked (both streaks reset on a push), so the
      // 'tie' arm reads zero rather than inventing a third counter.
      const streak =
        tree.result === 'win'
          ? side.consecutiveWins
          : tree.result === 'lose'
            ? side.consecutiveLosses
            : 0;
      return compare(tree.op, streak, evaluateAmount(tree.amount, ctx));
    }
  }
}

/** An effect with no conditions always resolves. */
export function conditionsHold(tree: CardConditionTree | undefined, ctx: CardEvalContext): boolean {
  return tree === undefined ? true : evaluateCondition(tree, ctx);
}
