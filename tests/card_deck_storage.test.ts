import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import {
  activeDeckEntries,
  deckEntriesFrom,
  emptyCardDeckState,
  MAX_DECK_NAME_LENGTH,
  MAX_SAVED_DECKS,
  sanitizeCardDeckState,
  serializeCardDeckState,
  validateDeck,
} from '../src/sim/minigames/card_duel';

const legalIds = DEFAULT_DECK_LIST.map((entry) => entry.cardId);

/** A second legal deck, distinct from the default where the catalog allows. */
function altIds(): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((value) => {
    const pool = CARDS.filter((def) => def.value === value);
    return [pool[pool.length - 1].id, pool[pool.length - 2].id];
  });
}

describe('card deck storage', () => {
  it('an absent blob is a fresh character, not an error', () => {
    expect(sanitizeCardDeckState(undefined, CARD_CATALOG)).toEqual(emptyCardDeckState());
    expect(sanitizeCardDeckState(null, CARD_CATALOG)).toEqual(emptyCardDeckState());
    expect(sanitizeCardDeckState('nonsense', CARD_CATALOG)).toEqual(emptyCardDeckState());
  });

  it('round-trips a saved deck', () => {
    const saved = { decks: { Wolves: legalIds }, activeDeck: 'Wolves' };
    const state = sanitizeCardDeckState(saved, CARD_CATALOG);
    expect(state.decks.Wolves).toEqual(legalIds);
    expect(state.activeDeck).toBe('Wolves');
    expect(serializeCardDeckState(state)).toEqual(saved);
  });

  it('writes nothing at all for a character who never built a deck', () => {
    // The omit-empty rule: a pre-system save stays byte-equal until the player
    // actually uses the builder.
    expect(serializeCardDeckState(emptyCardDeckState())).toBeUndefined();
  });

  it('drops a deck that stopped being legal as the catalog changed', () => {
    const stale = {
      decks: { Old: [...legalIds.slice(0, 19), 'a_card_that_was_retired'] },
      activeDeck: 'Old',
    };
    const state = sanitizeCardDeckState(stale, CARD_CATALOG);
    expect(state.decks).toEqual({});
    expect(state.activeDeck).toBe('');
  });

  it('drops a malformed deck without throwing, whatever the save happens to hold', () => {
    const junk = {
      decks: { Good: legalIds, Bad: 'not-an-array', Numbers: [1, 2, 3] },
      activeDeck: 'Bad',
    };
    const state = sanitizeCardDeckState(junk as never, CARD_CATALOG);
    expect(Object.keys(state.decks)).toEqual(['Good']);
    // The active pointer falls back to something that exists.
    expect(state.activeDeck).toBe('Good');
  });

  it('caps the number of saved decks so the blob cannot grow without bound', () => {
    const decks: Record<string, string[]> = {};
    for (let i = 0; i < MAX_SAVED_DECKS + 3; i++) decks[`deck${i}`] = legalIds;
    const state = sanitizeCardDeckState({ decks, activeDeck: 'deck0' }, CARD_CATALOG);
    expect(Object.keys(state.decks).length).toBe(MAX_SAVED_DECKS);
    // Deterministic subset: sorted keys, never whichever the host enumerated.
    expect(Object.keys(state.decks)).toEqual(Object.keys(decks).sort().slice(0, MAX_SAVED_DECKS));
  });

  it('refuses a name past the cap', () => {
    const long = 'x'.repeat(MAX_DECK_NAME_LENGTH + 1);
    const state = sanitizeCardDeckState(
      { decks: { [long]: legalIds }, activeDeck: long },
      CARD_CATALOG,
    );
    expect(state.decks).toEqual({});
  });

  it('reads each card value from the CATALOG, never from a stored number', () => {
    const entries = deckEntriesFrom(legalIds, CARD_CATALOG);
    for (const entry of entries) {
      expect(entry.value).toBe(CARD_CATALOG.get(entry.cardId)?.value);
    }
    expect(validateDeck(entries, CARD_CATALOG)).toEqual({ ok: true });
  });

  it('skips a card id the catalog no longer knows rather than inventing a value', () => {
    const real = CARDS[0].id;
    const entries = deckEntriesFrom([real, 'a_card_that_was_retired'], CARD_CATALOG);
    expect(entries.map((e) => e.cardId)).toEqual([real]);
  });

  it('hands the active deck to a match, and undefined when there is none', () => {
    const state = sanitizeCardDeckState(
      { decks: { A: legalIds, B: altIds() }, activeDeck: 'B' },
      CARD_CATALOG,
    );
    const entries = activeDeckEntries(state, CARD_CATALOG);
    expect(entries?.map((e) => e.cardId)).toEqual(altIds());
    expect(activeDeckEntries(emptyCardDeckState(), CARD_CATALOG)).toBeUndefined();
    expect(activeDeckEntries(undefined, CARD_CATALOG)).toBeUndefined();
  });
});
