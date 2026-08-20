// Saved Card Duel decks: the shape that goes in the character blob, and the
// one load path that sanitizes it.
//
// Persistence is additive by design (docs/prd/card-duel-v2.md section 8): the
// field is added now, so a later collection era is a data change rather than a
// schema migration. Absent means a fresh character and the default deck.
// Deliberately NOT added yet: an `owned` list. Adding one later is additive
// too, and absent will mean "every card", so there is no migration then either.
//
// Pure and rng-free; the orchestrator owns when this is read.

import type { CardDeckEntry } from './deck';
import { validateDeck } from './deck_rules';
import type { CardCatalog } from './match_state';
import type { CardValue } from './types';

/** How many decks one character may keep. A cap, not a feature: the blob must
 *  not grow without bound. */
export const MAX_SAVED_DECKS = 5;

/** Longest accepted deck NAME, which doubles as its key. */
export const MAX_DECK_NAME_LENGTH = 24;

export interface SavedCardDecks {
  /** Deck name to its twenty card ids, in slot order. */
  decks: Record<string, string[]>;
  /** Which of them a match uses. */
  activeDeck: string;
}

/** The live shape on PlayerMeta. Same as the saved one: there is nothing
 *  derived to keep in step. */
export type CardDeckState = SavedCardDecks;

export function emptyCardDeckState(): CardDeckState {
  return { decks: {}, activeDeck: '' };
}

/** A saved deck as card ids becomes engine entries by reading each card's
 *  PRINTED value from the catalog, never a stored value that could disagree. */
export function deckEntriesFrom(cardIds: readonly string[], catalog: CardCatalog): CardDeckEntry[] {
  const entries: CardDeckEntry[] = [];
  for (const cardId of cardIds) {
    const def = catalog.get(cardId);
    if (!def) continue;
    entries.push({ cardId, value: def.value as CardValue });
  }
  return entries;
}

/**
 * The ONE load path. Drops anything malformed rather than throwing, because
 * this runs against whatever a save happens to hold: a retired card id, a deck
 * that stopped being legal as the catalog changed, a name past the cap, or
 * more decks than a character may keep.
 */
export function sanitizeCardDeckState(raw: unknown, catalog: CardCatalog): CardDeckState {
  const state = emptyCardDeckState();
  if (!raw || typeof raw !== 'object') return state;
  const source = raw as Partial<SavedCardDecks>;
  const decks = source.decks;
  if (decks && typeof decks === 'object') {
    // Sorted so the cap keeps a deterministic subset rather than whichever
    // keys the host happened to enumerate first.
    for (const name of Object.keys(decks).sort()) {
      if (Object.keys(state.decks).length >= MAX_SAVED_DECKS) break;
      if (name.length === 0 || name.length > MAX_DECK_NAME_LENGTH) continue;
      const ids = decks[name];
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) continue;
      // A deck that is no longer legal is dropped, not repaired: the match
      // start already falls back to the default, and a half-fixed deck would
      // be a list the player never chose.
      if (!validateDeck(deckEntriesFrom(ids, catalog), catalog).ok) continue;
      state.decks[name] = [...ids];
    }
  }
  const active = source.activeDeck;
  if (typeof active === 'string' && state.decks[active]) state.activeDeck = active;
  else state.activeDeck = Object.keys(state.decks)[0] ?? '';
  return state;
}

/** The blob to persist, or undefined when there is nothing to write, so a
 *  character who never opened the deck builder stays byte-equal to before the
 *  system existed. */
export function serializeCardDeckState(state: CardDeckState): SavedCardDecks | undefined {
  if (Object.keys(state.decks).length === 0) return undefined;
  return { decks: { ...state.decks }, activeDeck: state.activeDeck };
}

/** The deck a match should deal for this player, as engine entries, or
 *  undefined when they have not built one. */
export function activeDeckEntries(
  state: CardDeckState | undefined,
  catalog: CardCatalog,
): CardDeckEntry[] | undefined {
  if (!state) return undefined;
  const ids = state.decks[state.activeDeck];
  return ids ? deckEntriesFrom(ids, catalog) : undefined;
}
