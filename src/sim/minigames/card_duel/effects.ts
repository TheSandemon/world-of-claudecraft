// The effect applier: one handler per sanctioned primitive, and nothing else.
// A card is data over these; adding a card never adds code here.
//
// Effects mutate the round board (values, tribes, flags) and the match state
// (counters, zones, reveals), or PARK a modifier when their duration outlives
// the comparison. Rng reaches this module only to be handed to deck.ts (draw,
// reshuffle) and to selectors.ts; nothing here calls `.next()` itself, which
// is what keeps the two declared draw sites honest.

import { drawOne, shuffle } from './deck';
import { type CardEvalContext, evaluateAmount } from './expressions';
import { boardSide, counterValue, revealToOpponent, setCounter, sideOf } from './match_state';
import { addModifier, isParkedDuration, nextModifierId } from './modifiers';
import type { CardResolvedTarget } from './selectors';
import type {
  CardDuration,
  CardEffectDefinition,
  CardInstance,
  CardSeat,
  CardStackMode,
  CardTrigger,
} from './types';

/** How an effect hands work back to the resolver: a drawn or discarded card
 *  has its own lifecycle triggers, and those are what a resolution cycle is
 *  made of, so they go through the resolver's bounded queue rather than
 *  recursing here. */
export interface CardResolutionSink {
  queueCardTrigger(seat: CardSeat, card: CardInstance, trigger: CardTrigger): void;
}

/** Freezes every expression in an effect to the number it evaluates to NOW.
 *  A parked modifier is priced against the state that authored it, so a later
 *  round cannot silently re-price it. */
export function resolveAmounts(
  effect: CardEffectDefinition,
  ctx: CardEvalContext,
): CardEffectDefinition {
  if (!('amount' in effect)) return effect;
  return { ...effect, amount: { type: 'constant', value: evaluateAmount(effect.amount, ctx) } };
}

function amountValue(effect: CardEffectDefinition): number {
  return 'amount' in effect && effect.amount.type === 'constant' ? effect.amount.value : 0;
}

/** Applies one already-priced effect to a card sitting on the board. */
export function applyToBoard(
  effect: CardEffectDefinition,
  ctx: CardEvalContext,
  seat: CardSeat,
): void {
  const side = boardSide(ctx.board, seat);
  if (!side.card) return;
  switch (effect.type) {
    case 'modifyValue':
      side.effectiveValue += amountValue(effect);
      break;
    case 'setValue':
      side.effectiveValue = amountValue(effect);
      break;
    case 'minimumValue':
      side.floorValue =
        side.floorValue === null
          ? amountValue(effect)
          : Math.max(side.floorValue, amountValue(effect));
      break;
    case 'maximumValue':
      side.ceilValue =
        side.ceilValue === null
          ? amountValue(effect)
          : Math.min(side.ceilValue, amountValue(effect));
      break;
    case 'addTribe':
      if (!side.tribes.includes(effect.tribe)) side.tribes.push(effect.tribe);
      break;
    case 'removeTribe': {
      const idx = side.tribes.indexOf(effect.tribe);
      if (idx !== -1) side.tribes.splice(idx, 1);
      break;
    }
    case 'silence':
      side.silenced = true;
      break;
    case 'winTies':
      side.winTies = true;
      break;
    case 'reverseComparison':
      side.reverseComparison = true;
      break;
    case 'reveal':
      // A card on the board is already face up to both sides; recording it
      // keeps the revealed set complete for the snapshot builder.
      revealToOpponent(sideOf(ctx.state, seat), side.card.iid);
      break;
    default:
      // Zone/player primitives (draw, discard, counters, ...) are handled by
      // the target-kind switch below; a board target is not their shape.
      break;
  }
}

function moveCard(from: CardInstance[], to: CardInstance[], card: CardInstance): boolean {
  const idx = from.findIndex((c) => c.iid === card.iid);
  if (idx === -1) return false;
  to.push(from.splice(idx, 1)[0]);
  return true;
}

/**
 * Applies one effect to every resolved target.
 *
 * `duration` and `stackMode` come from the authored effect; a duration that
 * outlives the comparison parks a modifier instead of (or as well as) editing
 * the board.
 */
export function applyEffect(
  effect: CardEffectDefinition,
  duration: CardDuration,
  stackMode: CardStackMode,
  targets: readonly CardResolvedTarget[],
  ctx: CardEvalContext,
  rng: { next(): number },
  sink: CardResolutionSink,
): void {
  const priced = resolveAmounts(effect, ctx);
  const sourceId = ctx.thisCard?.cardId ?? '';

  // swapValues is a board-global operation: it exchanges the two effective
  // values whatever the declared target, because "swap both current card
  // values" has no per-target reading.
  if (priced.type === 'swapValues') {
    const a = ctx.board.a.effectiveValue;
    ctx.board.a.effectiveValue = ctx.board.b.effectiveValue;
    ctx.board.b.effectiveValue = a;
    return;
  }

  for (const target of targets) {
    switch (target.kind) {
      case 'board': {
        if (duration === 'untilMatchEnd' || !isParkedDuration(duration)) {
          applyToBoard(priced, ctx, target.seat);
        }
        if (isParkedDuration(duration) && ctx.board[target.seat].card) {
          addModifier(ctx.state, {
            id: nextModifierId(ctx.state),
            seat: target.seat,
            iid: ctx.board[target.seat].card?.iid ?? null,
            source: sourceId,
            effect: priced,
            duration,
            stackMode,
            createdRound: ctx.state.round,
            consumed: false,
          });
        }
        break;
      }
      case 'nextCard': {
        addModifier(ctx.state, {
          id: nextModifierId(ctx.state),
          seat: target.seat,
          iid: null,
          source: sourceId,
          effect: priced,
          duration: isParkedDuration(duration) ? duration : 'untilTriggered',
          stackMode,
          createdRound: ctx.state.round,
          match: target.match,
          consumed: false,
        });
        break;
      }
      case 'player': {
        const side = sideOf(ctx.state, target.seat);
        switch (priced.type) {
          case 'addCounter':
            setCounter(
              side,
              priced.counter,
              counterValue(side, priced.counter) + amountValue(priced),
            );
            break;
          case 'removeCounter':
            setCounter(
              side,
              priced.counter,
              counterValue(side, priced.counter) - amountValue(priced),
            );
            break;
          case 'setCounter':
            setCounter(side, priced.counter, amountValue(priced));
            break;
          case 'draw': {
            const n = Math.max(0, amountValue(priced));
            for (let i = 0; i < n; i++) {
              const before = side.cards.hand.length;
              drawOne(rng, side.cards);
              const drawn = side.cards.hand[side.cards.hand.length - 1];
              if (side.cards.hand.length > before && drawn) {
                sink.queueCardTrigger(target.seat, drawn, 'onDraw');
              }
            }
            break;
          }
          case 'reveal':
            for (const card of side.cards.hand) revealToOpponent(side, card.iid);
            break;
          case 'shuffleDiscardIntoDeck': {
            if (side.cards.discard.length > 0) {
              side.cards.deck = shuffle(rng, [...side.cards.deck, ...side.cards.discard]);
              side.cards.discard = [];
            }
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'zoneCard': {
        const side = sideOf(ctx.state, target.seat);
        switch (priced.type) {
          case 'reveal':
            revealToOpponent(side, target.card.iid);
            break;
          case 'discard':
            if (target.zone === 'hand' || target.zone === 'deck') {
              const from = target.zone === 'hand' ? side.cards.hand : side.cards.deck;
              if (moveCard(from, side.cards.discard, target.card)) {
                sink.queueCardTrigger(target.seat, target.card, 'onDiscard');
              }
            }
            break;
          case 'returnToHand':
            if (target.zone === 'discard')
              moveCard(side.cards.discard, side.cards.hand, target.card);
            else if (target.zone === 'deck')
              moveCard(side.cards.deck, side.cards.hand, target.card);
            break;
          default:
            // Anything else aimed at a card in a zone is a modifier waiting for
            // that exact instance to be played (a +2 sitting on a card in hand).
            addModifier(ctx.state, {
              id: nextModifierId(ctx.state),
              seat: target.seat,
              iid: target.card.iid,
              source: sourceId,
              effect: priced,
              duration: isParkedDuration(duration) ? duration : 'untilTriggered',
              stackMode,
              createdRound: ctx.state.round,
              consumed: false,
            });
            break;
        }
        break;
      }
    }
  }
}
