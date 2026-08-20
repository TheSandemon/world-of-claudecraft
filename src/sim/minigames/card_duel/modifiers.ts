// Parked modifiers: the ones whose duration outlives the comparison that
// created them ("your next Beast gets +3", "your Humans get +1 for the rest of
// the match"). Effects that end this round are applied straight to the board
// and never land here.
//
// This module owns parking, stack-mode collapse, matching a parked modifier to
// a revealed card, and expiry. It never APPLIES an effect (effects.ts does),
// which is what keeps the two free of a cycle. Pure and rng-free.

import type { CardCatalog, CardMatchState } from './match_state';
import { cardMatches } from './selectors';
import type {
  CardDuration,
  CardEffectDefinition,
  CardInstance,
  CardModifier,
  CardSeat,
  CardStackMode,
} from './types';

/** Durations that park. Anything else is immediate. */
export function isParkedDuration(duration: CardDuration): boolean {
  return duration === 'nextRound' || duration === 'untilTriggered' || duration === 'untilMatchEnd';
}

/** The amount a stack-mode comparison ranks on, or null for an effect that
 *  carries no amount (silence, winTies, ...). */
function amountOf(effect: CardEffectDefinition): number | null {
  if ('amount' in effect && effect.amount.type === 'constant') return effect.amount.value;
  return null;
}

function sameSlot(a: CardModifier, b: CardModifier): boolean {
  return (
    a.seat === b.seat && a.source === b.source && a.effect.type === b.effect.type && a.iid === b.iid
  );
}

/**
 * Parks a modifier, honoring its stack mode:
 * - `stack` (the default): every application adds up.
 * - `replace`: the newest wins, the older one is dropped.
 * - `highest` / `lowest`: only the strongest / weakest of the matching
 *   modifiers survives.
 * - `unique`: only one may exist at a time, so a repeat is discarded (this is
 *   what stops "your next Beast gets +3" from becoming +9 when it triggers
 *   three times).
 *
 * Returns the modifier that ended up in the list, or null when the incoming
 * one was discarded.
 */
export function addModifier(state: CardMatchState, incoming: CardModifier): CardModifier | null {
  const mode: CardStackMode = incoming.stackMode;
  if (mode === 'stack') {
    state.modifiers.push(incoming);
    return incoming;
  }
  const existingIndex = state.modifiers.findIndex((m) => !m.consumed && sameSlot(m, incoming));
  if (existingIndex === -1) {
    state.modifiers.push(incoming);
    return incoming;
  }
  const existing = state.modifiers[existingIndex];
  if (mode === 'unique') return null;
  if (mode === 'replace') {
    state.modifiers.splice(existingIndex, 1, incoming);
    return incoming;
  }
  const a = amountOf(existing.effect);
  const b = amountOf(incoming.effect);
  // With no comparable amount, highest/lowest degrade to replace rather than
  // silently stacking: two flag modifiers are indistinguishable anyway.
  if (a === null || b === null) {
    state.modifiers.splice(existingIndex, 1, incoming);
    return incoming;
  }
  const keepIncoming = mode === 'highest' ? b > a : b < a;
  if (!keepIncoming) return null;
  state.modifiers.splice(existingIndex, 1, incoming);
  return incoming;
}

/** Is this modifier live for the given round? */
function inWindow(mod: CardModifier, round: number): boolean {
  if (mod.consumed) return false;
  if (mod.duration === 'nextRound') return round === mod.createdRound + 1;
  return true;
}

/**
 * The parked modifiers that fire for a card just revealed on the board, in a
 * stable order (creation id), never the array's incidental order.
 */
export function pendingModifiersFor(
  state: CardMatchState,
  seat: CardSeat,
  card: CardInstance,
  catalog: CardCatalog,
): CardModifier[] {
  const def = catalog.get(card.cardId);
  return state.modifiers
    .filter((mod) => {
      if (mod.seat !== seat) return false;
      if (!inWindow(mod, state.round)) return false;
      if (mod.iid !== null) return mod.iid === card.iid;
      return cardMatches(card, def, mod.match);
    })
    .sort((x, y) => x.id - y.id);
}

/** Marks the 'untilTriggered' members of a fired set as spent. */
export function consumeTriggered(fired: readonly CardModifier[]): void {
  for (const mod of fired) {
    if (mod.duration === 'untilTriggered') mod.consumed = true;
  }
}

/** Drops spent modifiers and ones whose window has closed. Called once per
 *  round end, so the list cannot grow without bound over a long match. */
export function expireModifiers(state: CardMatchState): void {
  state.modifiers = state.modifiers.filter((mod) => {
    if (mod.consumed) return false;
    // A nextRound modifier that never found a card is dead once its round is
    // behind us.
    if (mod.duration === 'nextRound' && state.round > mod.createdRound + 1) return false;
    return true;
  });
}

/** Mints the next creation id. Deterministic: it is a function of how many
 *  modifiers this match has already created, never a clock or a random. */
export function nextModifierId(state: CardMatchState): number {
  let max = 0;
  for (const mod of state.modifiers) max = Math.max(max, mod.id);
  return max + 1;
}
