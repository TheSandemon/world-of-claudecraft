import { describe, expect, it } from 'vitest';
import {
  BASIC_DECK_LIST,
  buildDeck,
  type CardHandState,
  createCardHand,
  drawOne,
  playCard,
  playCardByInstance,
  STARTING_HAND_SIZE,
  shuffle,
} from '../src/sim/minigames/card_duel/deck';
import { Rng } from '../src/sim/rng';

// Carried over from tests/card_hand.test.ts when the engine moved into
// src/sim/minigames/card_duel/deck.ts: the deal, shuffle, and reshuffle arms
// are the same assertions, now over CardInstance rather than plain numbers,
// which is what proves the move changed no behavior.
describe('card_duel deck', () => {
  it('shuffle is deterministic for a given seed and preserves the multiset', () => {
    const cards = [1, 1, 2, 2, 3, 3];
    const a = shuffle(new Rng(42), cards);
    const b = shuffle(new Rng(42), cards);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...cards].sort());
  });

  it('createCardHand deals a starting hand from a 20-card deck', () => {
    const state = createCardHand(new Rng(1), 'a');
    expect(state.hand.length).toBe(STARTING_HAND_SIZE);
    expect(state.deck.length + state.hand.length + state.discard.length).toBe(20);
  });

  it('the basic deck holds exactly two cards of every value 1 to 10', () => {
    const counts = new Map<number, number>();
    for (const entry of BASIC_DECK_LIST) {
      counts.set(entry.value, (counts.get(entry.value) ?? 0) + 1);
    }
    expect(BASIC_DECK_LIST.length).toBe(20);
    for (let v = 1; v <= 10; v++) expect(counts.get(v)).toBe(2);
    expect(new Set(BASIC_DECK_LIST.map((e) => e.cardId)).size).toBe(20);
  });

  it('mints distinct instance ids across both seats of a match', () => {
    const a = buildDeck('a', BASIC_DECK_LIST);
    const b = buildDeck('b', BASIC_DECK_LIST);
    const ids = new Set([...a, ...b].map((c) => c.iid));
    expect(ids.size).toBe(40);
  });

  it('playCard removes exactly one matching card and discards it', () => {
    const state = createCardHand(new Rng(1), 'a');
    const value = state.hand[0].value;
    const before = state.hand.length;
    const played = playCard(state, value);
    expect(played?.value).toBe(value);
    expect(state.hand.length).toBe(before - 1);
    expect(state.discard).toContain(played);
  });

  it('playCard returns null for a value not in hand', () => {
    const state = createCardHand(new Rng(1), 'a');
    const held: number[] = state.hand.map((c) => c.value);
    const notHeld = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((v) => !held.includes(v));
    expect(notHeld).toBeDefined();
    expect(playCard(state, notHeld as number)).toBeNull();
  });

  it('playCardByInstance plays the named card, not merely one of its value', () => {
    const rng = new Rng(7);
    const state = createCardHand(rng, 'a');
    // Force a hand holding BOTH copies of one value, the case the value-keyed
    // path cannot express: playing by instance must pick the exact card.
    const pool = [...state.deck, ...state.hand];
    const twins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map((v) => pool.filter((c) => c.value === v))
      .find((set) => set.length === 2);
    expect(twins).toBeDefined();
    const [first, second] = twins as [(typeof pool)[number], (typeof pool)[number]];
    state.hand = [first, second];
    const played = playCardByInstance(state, second.iid);
    expect(played).toBe(second);
    expect(state.hand).toEqual([first]);
    expect(playCardByInstance(state, second.iid)).toBeNull();
  });

  it('drawOne reshuffles the discard pile back into the deck once empty, and reports it', () => {
    const rng = new Rng(1);
    const state = createCardHand(rng, 'a');
    // Drain the deck entirely, discarding every drawn card so the pool stays
    // in deck+discard (never lost). None of these draws should report a
    // reshuffle: the deck still has cards left every time drawOne runs here.
    while (state.deck.length > 0) {
      expect(drawOne(rng, state)).toBe(false);
      const c = state.hand.pop();
      if (c !== undefined) state.discard.push(c);
    }
    expect(state.deck.length).toBe(0);
    const handCountBefore = state.hand.length;
    // This is the one draw that must trip the reshuffle: the deck is empty
    // going in, and the discard pile gets shuffled back into it.
    expect(drawOne(rng, state)).toBe(true);
    // The discard pile was reshuffled into the deck, then one card drawn from it:
    // the pool stays at 20 total, and the hand grew by exactly one card.
    expect(state.deck.length + state.discard.length + state.hand.length).toBe(20);
    expect(state.hand.length).toBe(handCountBefore + 1);
  });

  it('drawOne reports no reshuffle for an ordinary draw with cards left in the deck', () => {
    const rng = new Rng(2);
    const state = createCardHand(rng, 'a');
    expect(state.deck.length).toBeGreaterThan(0);
    expect(drawOne(rng, state)).toBe(false);
  });

  it('drawOne is a no-op (and reports no reshuffle) once deck and discard are both empty', () => {
    const rng = new Rng(3);
    const state: CardHandState = { deck: [], hand: [], discard: [] };
    expect(drawOne(rng, state)).toBe(false);
    expect(state.hand).toEqual([]);
  });

  it('never loses or duplicates a card across deck+hand+discard', () => {
    const rng = new Rng(9);
    const state = createCardHand(rng, 'a');
    for (let i = 0; i < 30; i++) {
      if (state.hand.length > 0) {
        playCard(state, state.hand[0].value);
      }
      drawOne(rng, state);
      expect(state.deck.length + state.hand.length + state.discard.length).toBe(20);
      const ids = new Set([...state.deck, ...state.hand, ...state.discard].map((c) => c.iid));
      expect(ids.size).toBe(20);
    }
  });
});
