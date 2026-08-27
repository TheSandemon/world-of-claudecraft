// What a player can be TOLD about the board before the reveal.
//
// Two readouts, both pure and both derived from the parked modifier list
// (modifiers.ts). They exist because the rules engine had no way to answer two
// questions a player asks every round and the interface could not answer
// either: "what is still in play?" and "what would this card in my hand
// actually be worth?".
//
// Neither is a new rule. `activeCardEffects` reports the modifiers the engine
// is already holding, and `pendingValueDelta` sums exactly the modifiers
// `pendingModifiersFor` would fire, so a preview that disagreed with the round
// would be a bug in one of them rather than two competing implementations.
//
// The delta is a PREVIEW, not a promise: the true effective value also depends
// on the opponent's card, which is hidden until both seats commit. It answers
// "what do I already have riding on this card", which is the part that is
// knowable and the part a player is choosing on.
//
// TWO numbers live here on purpose, and they answer different questions.
// `pendingValueDelta` is "what do I already have riding on this card", the
// signed badge the card face paints. `projectCardValue` is "what would this
// card RESOLVE at", which additionally runs the card's own pre-comparison
// effects, its conditions, its clamps, and its spent trigger limits. The badge
// explains a modifier to a player; the projection is what a bot chooses on.
// Both read the same modifier list, so neither can drift from the other.

import { conditionsHold } from './conditions';
import { applyToBoard, resolveAmounts } from './effects';
import type { CardEvalContext } from './expressions';
import {
  buildBoardSide,
  type CardBoard,
  type CardCatalog,
  type CardMatchState,
  limitKey,
  sideOf,
} from './match_state';
import { isParkedDuration, pendingModifiersFor } from './modifiers';
import { clampedValue, EFFECT_PRIORITY } from './resolve';
import type {
  CardEffect,
  CardEffectType,
  CardId,
  CardInstance,
  CardModifier,
  CardSeat,
  HandInstanceId,
} from './types';

/**
 * The durations that can actually be PARKED, mirroring `isParkedDuration`.
 *
 * The other three ('instant', 'thisComparison', 'thisRound') are applied
 * straight to the board and never reach the modifier list, so a read surface
 * that quoted one would be describing a state the engine cannot be in. Written
 * as a positive list rather than an Exclude so adding a new duration to
 * `CardDuration` cannot silently widen it.
 */
export type CardParkedDuration = 'nextRound' | 'untilTriggered' | 'untilMatchEnd';

/** One parked modifier, flattened for a read surface. */
export interface CardActiveEffect {
  /** Whose card it rides. */
  readonly seat: CardSeat;
  /** The card that parked it: its name and rules sentence are the explanation,
   *  so the client needs no second copy of the wording. */
  readonly sourceCardId: CardId;
  readonly effect: CardEffectType;
  /** The signed constant it carries, or null for a flag effect (silence,
   *  winTies). Amounts are resolved at parking time, so this is always a
   *  concrete number when the effect has one. */
  readonly amount: number | null;
  readonly duration: CardParkedDuration;
  /** True when it waits for one SPECIFIC card rather than the next card
   *  matching a filter. */
  readonly targeted: boolean;
}

/** The signed constant an effect carries, or null when it carries none. */
function constantAmount(mod: CardModifier): number | null {
  const effect = mod.effect;
  if (!('amount' in effect)) return null;
  return effect.amount.type === 'constant' ? effect.amount.value : null;
}

/**
 * Every parked modifier still in play for `round`, in creation order.
 *
 * Deliberately the SAME liveness rule the resolver uses: a `nextRound`
 * modifier whose round has passed, and anything already consumed, are gone.
 * Reporting a dead modifier would put a line on the board that can never fire.
 */
export function activeCardEffects(state: CardMatchState, round: number): CardActiveEffect[] {
  return state.modifiers
    .filter((mod) => {
      if (mod.consumed) return false;
      // Belt and braces on the parked-only invariant: an instant duration
      // never reaches this list, and narrating one would be a lie about a
      // state the engine cannot reach.
      if (!isParkedDuration(mod.duration)) return false;
      if (mod.duration === 'nextRound') return round <= mod.createdRound + 1;
      return true;
    })
    .sort((x, y) => x.id - y.id)
    .map((mod) => ({
      seat: mod.seat,
      sourceCardId: mod.source,
      effect: mod.effect.type,
      amount: constantAmount(mod),
      duration: mod.duration as CardParkedDuration,
      targeted: mod.iid !== null,
    }));
}

/**
 * The value change parked modifiers would apply to `card` if it were played
 * this round: positive for a buff, negative for a debuff, zero for neither.
 *
 * Only `modifyValue` is summed. The clamps (`minimumValue`, `maximumValue`)
 * and `setValue` do not have a meaningful signed preview without the opponent's
 * card, and quoting one as a delta would be a number the round then contradicts.
 */
export function pendingValueDelta(
  state: CardMatchState,
  seat: CardSeat,
  card: CardInstance,
  catalog: CardCatalog,
): number {
  let delta = 0;
  for (const mod of pendingModifiersFor(state, seat, card, catalog)) {
    if (mod.effect.type !== 'modifyValue') continue;
    const amount = constantAmount(mod);
    if (amount !== null) delta += amount;
  }
  return delta;
}

/** The primitives that move a card's own number. Everything else changes the
 *  match rather than the card, and simulating it here would be a mutation. */
const VALUE_PRIMITIVES: ReadonlySet<CardEffectType> = new Set([
  'modifyValue',
  'setValue',
  'minimumValue',
  'maximumValue',
]);

/** The triggers that have already fired by the time the round is compared. A
 *  win/lose/tie effect pays out AFTER the comparison, so it is not part of what
 *  the card is worth going into one. */
const PRE_COMPARE_TRIGGERS: readonly CardEffect['trigger'][] = ['onReveal', 'beforeCompare'];

/** Has this effect already spent its authored allowance? Read-only: it reports
 *  the bookkeeping the resolver keeps, and never writes to it. */
function limitsAllow(
  state: CardMatchState,
  seat: CardSeat,
  cardId: string,
  effect: CardEffect,
  index: number,
): boolean {
  const limits = effect.limits;
  if (!limits) return true;
  const key = limitKey(seat, cardId, index);
  const fired = state.triggerCounts[key] ?? 0;
  const lastRound = state.lastTriggerRound[key];
  if (limits.oncePerMatch && fired >= 1) return false;
  if (limits.maxTriggers !== undefined && fired >= limits.maxTriggers) return false;
  if (limits.oncePerRound && lastRound === state.round) return false;
  if (
    limits.cooldownRounds !== undefined &&
    lastRound !== undefined &&
    state.round - lastRound < limits.cooldownRounds
  ) {
    return false;
  }
  return true;
}

/**
 * The value `card` would carry into this round's comparison if this seat
 * revealed it, with its own pre-comparison effects and any parked modifier
 * waiting for it already applied.
 *
 * Falls back to the printed value for a card the catalog does not know, which
 * is what the resolver would do with it too.
 */
export function projectCardValue(
  state: CardMatchState,
  seat: CardSeat,
  card: CardInstance,
  catalog: CardCatalog,
): number {
  const def = catalog.get(card.cardId);
  if (!def) return card.value;

  // A scratch board: this seat holds the candidate, the other seat is empty
  // because its card is genuinely unknown at selection time.
  const other: CardSeat = seat === 'a' ? 'b' : 'a';
  const board = {
    [seat]: buildBoardSide(seat, card, catalog),
    [other]: buildBoardSide(other, null, catalog),
  } as unknown as CardBoard;
  const ctx: CardEvalContext = { state, board, catalog, seat, thisCard: card };

  // Modifiers parked in an earlier round were priced then and ride this card
  // in regardless of what the opponent shows, so they come first, exactly as
  // resolveCardRound applies them.
  for (const mod of pendingModifiersFor(state, seat, card, catalog)) {
    if (VALUE_PRIMITIVES.has(mod.effect.type)) applyToBoard(mod.effect, ctx, seat);
  }

  // The card's own pre-comparison effects, in the resolver's priority order so
  // a floor or a cap lands after the addition it clamps.
  const queued = def.effects
    .map((effect, index) => ({ effect, index }))
    .filter(
      ({ effect }) =>
        PRE_COMPARE_TRIGGERS.includes(effect.trigger) && VALUE_PRIMITIVES.has(effect.effect.type),
    )
    .filter(({ effect }) => (effect.target?.type ?? 'thisCard') !== 'opponentCard')
    .sort(
      (x, y) =>
        EFFECT_PRIORITY[x.effect.effect.type] - EFFECT_PRIORITY[y.effect.effect.type] ||
        x.index - y.index,
    );
  for (const { effect, index } of queued) {
    if (!limitsAllow(state, seat, def.id, effect, index)) continue;
    if (!conditionsHold(effect.conditions, ctx)) continue;
    // Priced against the state that asked, exactly as applyEffect prices a live
    // one: an unpriced scaling expression would silently project as zero.
    applyToBoard(resolveAmounts(effect.effect, ctx), ctx, seat);
  }

  return clampedValue(board, seat);
}

/** Every card in a seat's hand, keyed by instance id. The shape a viewer
 *  projection carries, so a policy never has to hold the match state. */
export function projectHand(
  state: CardMatchState,
  seat: CardSeat,
  catalog: CardCatalog,
): Record<HandInstanceId, number> {
  const out: Record<HandInstanceId, number> = {};
  for (const card of sideOf(state, seat).cards.hand) {
    out[card.iid] = projectCardValue(state, seat, card, catalog);
  }
  return out;
}

/** Reads a projection, falling back to the printed value when the viewer was
 *  built without one (an older wire frame, or a test stub). */
export function projectedValueOf(
  projected: Readonly<Record<HandInstanceId, number>> | undefined,
  card: CardInstance,
): number {
  const value = projected?.[card.iid];
  return typeof value === 'number' ? value : card.value;
}
