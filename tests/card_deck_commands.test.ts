import { describe, expect, it, vi } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import {
  emptyCardDeckState,
  MAX_DECK_NAME_LENGTH,
  MAX_SAVED_DECKS,
} from '../src/sim/minigames/card_duel';
import type { SimContext } from '../src/sim/sim_context';
import { deleteCardDeck, saveCardDeck, selectCardDeck } from '../src/sim/social/card_deck_commands';

const legalIds = DEFAULT_DECK_LIST.map((entry) => entry.cardId);

function altIds(): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((value) => {
    const pool = CARDS.filter((def) => def.value === value);
    return [pool[pool.length - 1].id, pool[pool.length - 2].id];
  });
}

/** The narrow ctx these command bodies actually touch. */
function makeCtx() {
  const error = vi.fn();
  const meta = { entityId: 1, name: 'Aleph', cards: emptyCardDeckState() };
  const ctx = {
    error,
    emit: vi.fn(),
    resolve: () => ({ meta, e: { dead: false } }),
  } as unknown as SimContext;
  return { ctx, error, meta };
}

describe('card deck commands', () => {
  it('saves a legal deck and makes it active when it is the first', () => {
    const { ctx, meta, error } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    expect(error).not.toHaveBeenCalled();
    expect(meta.cards.decks.Wolves).toEqual(legalIds);
    expect(meta.cards.activeDeck).toBe('Wolves');
  });

  it('replacing a deck does not move the active pointer', () => {
    const { ctx, meta } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    saveCardDeck(ctx, 'Bones', altIds(), 1);
    expect(meta.cards.activeDeck).toBe('Wolves');
    saveCardDeck(ctx, 'Wolves', altIds(), 1);
    expect(meta.cards.decks.Wolves).toEqual(altIds());
    expect(meta.cards.activeDeck).toBe('Wolves');
  });

  it('refuses an illegal deck server-side, whatever the client sent', () => {
    const { ctx, meta, error } = makeCtx();
    // The client is a renderer: a hand-built command with nineteen cards, or
    // twenty of the same card, is refused here.
    saveCardDeck(ctx, 'Short', legalIds.slice(0, 19), 1);
    saveCardDeck(
      ctx,
      'Stacked',
      Array.from({ length: 20 }, () => legalIds[0]),
      1,
    );
    expect(meta.cards.decks).toEqual({});
    expect(error).toHaveBeenCalledWith(
      1,
      'A deck is twenty cards: two of each value, and no card twice.',
    );
  });

  it('a rejected save leaves every stored deck untouched', () => {
    const { ctx, meta } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    saveCardDeck(ctx, 'Wolves', legalIds.slice(0, 5), 1);
    expect(meta.cards.decks.Wolves).toEqual(legalIds);
  });

  it('refuses a name that is empty or past the cap', () => {
    const { ctx, meta, error } = makeCtx();
    saveCardDeck(ctx, '   ', legalIds, 1);
    saveCardDeck(ctx, 'x'.repeat(MAX_DECK_NAME_LENGTH + 1), legalIds, 1);
    expect(meta.cards.decks).toEqual({});
    expect(error).toHaveBeenCalledWith(1, 'That deck name will not fit on the card box.');
  });

  it('trims the name it stores, so two decks cannot differ by whitespace alone', () => {
    const { ctx, meta } = makeCtx();
    saveCardDeck(ctx, '  Wolves  ', legalIds, 1);
    expect(Object.keys(meta.cards.decks)).toEqual(['Wolves']);
  });

  it('caps how many decks one character may keep', () => {
    const { ctx, meta, error } = makeCtx();
    for (let i = 0; i < MAX_SAVED_DECKS; i++) saveCardDeck(ctx, `deck${i}`, legalIds, 1);
    expect(Object.keys(meta.cards.decks).length).toBe(MAX_SAVED_DECKS);
    saveCardDeck(ctx, 'one-too-many', legalIds, 1);
    expect(Object.keys(meta.cards.decks).length).toBe(MAX_SAVED_DECKS);
    expect(error).toHaveBeenCalledWith(1, 'You have no room for another deck.');
    // Replacing an existing one is still allowed at the cap.
    saveCardDeck(ctx, 'deck0', altIds(), 1);
    expect(meta.cards.decks.deck0).toEqual(altIds());
  });

  it('selects a saved deck and refuses one that does not exist', () => {
    const { ctx, meta, error } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    saveCardDeck(ctx, 'Bones', altIds(), 1);
    selectCardDeck(ctx, 'Bones', 1);
    expect(meta.cards.activeDeck).toBe('Bones');
    selectCardDeck(ctx, 'Ghosts', 1);
    expect(meta.cards.activeDeck).toBe('Bones');
    expect(error).toHaveBeenCalledWith(1, 'You have no deck by that name.');
  });

  it('deleting the active deck moves the pointer to what is left', () => {
    const { ctx, meta } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    saveCardDeck(ctx, 'Bones', altIds(), 1);
    selectCardDeck(ctx, 'Bones', 1);
    deleteCardDeck(ctx, 'Bones', 1);
    expect(meta.cards.decks.Bones).toBeUndefined();
    expect(meta.cards.activeDeck).toBe('Wolves');
  });

  it('deleting the last deck leaves no active deck, so matches deal the default', () => {
    const { ctx, meta } = makeCtx();
    saveCardDeck(ctx, 'Wolves', legalIds, 1);
    deleteCardDeck(ctx, 'Wolves', 1);
    expect(meta.cards.decks).toEqual({});
    expect(meta.cards.activeDeck).toBe('');
  });

  it('refuses to delete a deck that does not exist', () => {
    const { ctx, error } = makeCtx();
    deleteCardDeck(ctx, 'Ghosts', 1);
    expect(error).toHaveBeenCalledWith(1, 'You have no deck by that name.');
  });

  it('validates against the live catalog, so a retired card cannot be saved', () => {
    const { ctx, meta } = makeCtx();
    const withRetired = [...legalIds.slice(0, 19), 'a_card_that_was_retired'];
    expect(CARD_CATALOG.get('a_card_that_was_retired')).toBeUndefined();
    saveCardDeck(ctx, 'Stale', withRetired, 1);
    expect(meta.cards.decks).toEqual({});
  });
});
