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

import type { CardCatalog, CardMatchState } from './match_state';
import { isParkedDuration, pendingModifiersFor } from './modifiers';
import type {
  CardDuration,
  CardEffectType,
  CardId,
  CardInstance,
  CardModifier,
  CardSeat,
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
