import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import type { CardDeckEntry } from '../src/sim/minigames/card_duel';
import { deckBasePower, isLegalDeck, validateDeck } from '../src/sim/minigames/card_duel';
import { CARD_VALUES } from '../src/sim/minigames/card_duel/types';

/** A legal deck built from the live catalog: two distinct cards per value. */
function legalDeck(): CardDeckEntry[] {
  return CARD_VALUES.flatMap((value) =>
    CARDS.filter((def) => def.value === value)
      .slice(0, 2)
      .map((def) => ({ cardId: def.id, value: def.value })),
  );
}

describe('card_duel deck rules', () => {
  it('accepts the shipped default deck', () => {
    expect(validateDeck(DEFAULT_DECK_LIST, CARD_CATALOG)).toEqual({ ok: true });
    expect(isLegalDeck(DEFAULT_DECK_LIST, CARD_CATALOG)).toBe(true);
  });

  it('rejects a deck that is not exactly twenty cards', () => {
    const short = legalDeck().slice(0, 19);
    expect(validateDeck(short, CARD_CATALOG)).toMatchObject({ ok: false, reason: 'size' });
    const long = [...legalDeck(), legalDeck()[0]];
    expect(validateDeck(long, CARD_CATALOG)).toMatchObject({ ok: false, reason: 'size' });
  });

  it('rejects the degenerate all-high-value deck outright, rather than discouraging it', () => {
    // The whole point of the shape rule: a twenty-card pile of tens is not
    // merely weak, it is unbuildable, so no budget or cap has to exist.
    const tens = CARDS.filter((def) => def.value === 10);
    const allHigh: CardDeckEntry[] = Array.from({ length: 20 }, (_, i) => ({
      cardId: tens[i % tens.length].id,
      value: 10,
    }));
    expect(validateDeck(allHigh, CARD_CATALOG).ok).toBe(false);
  });

  it('rejects a deck missing a value, even at the right size', () => {
    const deck = legalDeck();
    // Swap one value-1 slot for a second copy of a value-2 card's sibling.
    const spareTwo = CARDS.filter((def) => def.value === 2)[2];
    expect(spareTwo).toBeDefined();
    deck[0] = { cardId: spareTwo.id, value: 2 };
    expect(validateDeck(deck, CARD_CATALOG)).toMatchObject({
      ok: false,
      reason: 'value_histogram',
    });
  });

  it('rejects a repeated card id: one copy of any unique card', () => {
    const deck = legalDeck();
    const twin = deck.find((entry) => entry.value === 3);
    expect(twin).toBeDefined();
    const other = deck.findIndex((entry) => entry.value === 3 && entry.cardId !== twin?.cardId);
    deck[other] = { ...(twin as CardDeckEntry) };
    expect(validateDeck(deck, CARD_CATALOG)).toMatchObject({
      ok: false,
      reason: 'duplicate_card',
    });
  });

  it('rejects an unknown card id (a retired card in a saved deck)', () => {
    const deck = legalDeck();
    deck[5] = { cardId: 'a_card_that_was_retired', value: deck[5].value };
    expect(validateDeck(deck, CARD_CATALOG)).toMatchObject({
      ok: false,
      reason: 'unknown_card',
      detail: 'a_card_that_was_retired',
    });
  });

  it('rejects a list claiming a value the card does not print', () => {
    // The slot a card occupies IS its printed value; a mismatch would quietly
    // break the histogram the whole rule rests on.
    const deck = legalDeck();
    const three = deck.findIndex((entry) => entry.value === 3);
    deck[three] = { cardId: deck[three].cardId, value: 9 };
    expect(validateDeck(deck, CARD_CATALOG).ok).toBe(false);
  });

  it('checks ids without a catalog, so a client preview can validate shape alone', () => {
    const deck = legalDeck();
    expect(validateDeck(deck)).toEqual({ ok: true });
    deck[4] = { cardId: 'not_a_real_card', value: deck[4].value };
    // No catalog: the id is unknown but unchecked, and the shape still holds.
    expect(validateDeck(deck)).toEqual({ ok: true });
    expect(validateDeck(deck, CARD_CATALOG).ok).toBe(false);
  });

  it('every legal deck totals the same base power, as a consequence of the shape', () => {
    // 2 * (1 + 2 + ... + 10). Validation never checks this sum: it cannot be
    // wrong while the histogram is right, which is exactly why no separate
    // power budget exists.
    expect(deckBasePower(DEFAULT_DECK_LIST)).toBe(110);
    expect(deckBasePower(legalDeck())).toBe(110);
  });
});
