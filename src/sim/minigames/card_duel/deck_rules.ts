// Deck legality: exactly twenty cards, exactly two of each value 1 to 10, and
// no two cards sharing a card id.
//
// The singleton rule is the important half. It resolves the degenerate-deck
// problem completely rather than discouraging it: an all-high-value deck is not
// merely weak, it is UNBUILDABLE. No budget, cap, or tunable is needed, and
// every legal deck totals the same 110 base power as a CONSEQUENCE of the shape.
// Validation therefore checks the shape and never a sum.
//
// Pure and rng-free. The authoritative host validates at every match start, not
// on save alone: a deck that was legal when saved can become illegal as the
// catalog changes.

import { type CardDeckEntry, COPIES_PER_VALUE, DECK_SIZE } from './deck';
import type { CardCatalog } from './match_state';
import { CARD_VALUES } from './types';

export type CardDeckRejection =
  | 'size'
  | 'value_histogram'
  | 'duplicate_card'
  | 'unknown_card'
  | 'value_mismatch';

export interface CardDeckVerdict {
  ok: boolean;
  reason?: CardDeckRejection;
  /** The offending card id or value, for the dev-channel log. */
  detail?: string;
}

/**
 * Checks a deck list against the shape rule. `catalog` is optional: without it
 * the card ids are checked for uniqueness but not for existence, which is what
 * a client-side preview can do; the server always passes one.
 */
export function validateDeck(
  entries: readonly CardDeckEntry[],
  catalog?: CardCatalog,
): CardDeckVerdict {
  if (entries.length !== DECK_SIZE) {
    return { ok: false, reason: 'size', detail: String(entries.length) };
  }
  const seen = new Set<string>();
  const perValue = new Map<number, number>();
  for (const entry of entries) {
    if (seen.has(entry.cardId)) {
      return { ok: false, reason: 'duplicate_card', detail: entry.cardId };
    }
    seen.add(entry.cardId);
    perValue.set(entry.value, (perValue.get(entry.value) ?? 0) + 1);
    if (!catalog) continue;
    const def = catalog.get(entry.cardId);
    if (!def) return { ok: false, reason: 'unknown_card', detail: entry.cardId };
    // The slot a card occupies is its printed value, so a list claiming a
    // different one would quietly break the histogram the rule rests on.
    if (def.value !== entry.value) {
      return { ok: false, reason: 'value_mismatch', detail: entry.cardId };
    }
  }
  for (const value of CARD_VALUES) {
    if ((perValue.get(value) ?? 0) !== COPIES_PER_VALUE) {
      return { ok: false, reason: 'value_histogram', detail: String(value) };
    }
  }
  return { ok: true };
}

export function isLegalDeck(entries: readonly CardDeckEntry[], catalog?: CardCatalog): boolean {
  return validateDeck(entries, catalog).ok;
}

/** Total printed power of a deck. Always 110 for a legal one: a CONSEQUENCE of
 *  the shape, never a rule of its own. */
export function deckBasePower(entries: readonly CardDeckEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0);
}
