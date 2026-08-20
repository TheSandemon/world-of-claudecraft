import { describe, expect, it } from 'vitest';
import {
  bothCommitted,
  commitBot,
  commitCard,
  createSlice,
  resolveSliceRound,
  runToCompletion,
  stepMatch,
  viewFor,
} from '../src/cards/slice_core';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import { defineCard, effect, makeCatalog } from './helpers/card_duel_fixtures';

describe('cards slice core', () => {
  it('the same seed reproduces the exact same deal', () => {
    const first = createSlice({ seed: 1234 });
    const second = createSlice({ seed: 1234 });
    expect(first.match.a.cards.hand).toEqual(second.match.a.cards.hand);
    expect(first.match.b.cards.hand).toEqual(second.match.b.cards.hand);
    const other = createSlice({ seed: 4321 });
    expect(other.match.a.cards.hand).not.toEqual(first.match.a.cards.hand);
  });

  it('deals both seats a four-card hand from a twenty-card deck', () => {
    const slice = createSlice({ seed: 7 });
    for (const side of [slice.match.a, slice.match.b]) {
      expect(side.cards.hand.length).toBe(4);
      expect(side.cards.hand.length + side.cards.deck.length + side.cards.discard.length).toBe(20);
    }
  });

  it("the per-seat view never carries the opponent's hand", () => {
    const slice = createSlice({ seed: 9 });
    const view = viewFor(slice, 'a');
    const opponentIds = new Set(slice.match.b.cards.hand.map((c) => c.iid));
    for (const card of view.hand) expect(opponentIds.has(card.iid)).toBe(false);
    expect(view.opponentRevealed).toEqual([]);
    expect(view.deckCount).toBe(16);
  });

  it('a revealed opponent card DOES reach the view, and only that card', () => {
    const slice = createSlice({ seed: 11 });
    const revealed = slice.match.b.cards.hand[1];
    slice.match.b.revealedToOpponent.push(revealed.iid);
    const view = viewFor(slice, 'a');
    expect(view.opponentRevealed.map((c) => c.iid)).toEqual([revealed.iid]);
  });

  it('commit rejects a card the hand does not hold and a second commit in one round', () => {
    const slice = createSlice({ seed: 13 });
    const mine = slice.match.a.cards.hand[0];
    expect(commitCard(slice, 'a', 999999)).toBe(false);
    expect(commitCard(slice, 'a', mine.iid)).toBe(true);
    const another = slice.match.a.cards.hand[0];
    expect(commitCard(slice, 'a', another.iid)).toBe(false);
    expect(bothCommitted(slice)).toBe(false);
  });

  it('resolves only once both seats are in, and logs the round', () => {
    const slice = createSlice({ seed: 15 });
    commitCard(slice, 'a', slice.match.a.cards.hand[0].iid);
    expect(resolveSliceRound(slice)).toBeNull();
    commitCard(slice, 'b', slice.match.b.cards.hand[0].iid);
    const round = resolveSliceRound(slice);
    expect(round).not.toBeNull();
    expect(slice.log.length).toBe(1);
    expect(round?.round).toBe(1);
    expect(slice.match.round).toBe(2);
    // Hands are refilled back to four between rounds.
    expect(slice.match.a.cards.hand.length).toBe(4);
  });

  it('a bot seat commits on its own and a human seat does not', () => {
    const slice = createSlice({ seed: 17, bots: { b: 'novice' } });
    expect(commitBot(slice, 'a')).toBe(false);
    expect(commitBot(slice, 'b')).toBe(true);
    expect(slice.match.b.playedThisRound).not.toBeNull();
    expect(slice.match.a.playedThisRound).toBeNull();
    // stepMatch cannot finish the round while a human seat is outstanding.
    expect(stepMatch(slice)).toBe(false);
  });

  it('a fully botted session plays itself to a winner', () => {
    const slice = runToCompletion(createSlice({ seed: 21, bots: { a: 'novice', b: 'novice' } }));
    expect(slice.over).toBe(true);
    expect(slice.winner === 'a' || slice.winner === 'b').toBe(true);
    expect(slice.log.length).toBeGreaterThanOrEqual(2);
    const winnerWins = slice.winner === 'a' ? slice.match.a.roundWins : slice.match.b.roundWins;
    expect(winnerWins).toBe(slice.roundsToWin);
  });

  it('the same seed replays a botted session move for move', () => {
    const run = () =>
      runToCompletion(createSlice({ seed: 99, bots: { a: 'novice', b: 'novice' } })).log;
    expect(run()).toEqual(run());
  });

  it('a session over the closed pool never loses or duplicates a card', () => {
    const slice = runToCompletion(
      createSlice({ seed: 33, bots: { a: 'novice', b: 'novice' }, roundsToWin: 6 }),
    );
    for (const side of [slice.match.a, slice.match.b]) {
      const all = [...side.cards.hand, ...side.cards.deck, ...side.cards.discard];
      expect(all.length).toBe(20);
      expect(new Set(all.map((c) => c.iid)).size).toBe(20);
    }
  });

  it('runs authored cards through the REAL engine, not a slice-local copy', () => {
    // A card with a real effect must behave here exactly as it does in the sim:
    // the slice composes resolve.ts rather than reimplementing a comparison.
    const bruiser = defineCard('bruiser', {
      value: 4,
      effects: [effect({ effect: { type: 'modifyValue', amount: constant(5) } })],
    });
    const catalog = makeCatalog([bruiser]);
    const deck = Array.from({ length: 20 }, () => ({ cardId: 'bruiser', value: 4 as const }));
    const slice = createSlice({ seed: 5, catalog, deckA: deck });
    commitCard(slice, 'a', slice.match.a.cards.hand[0].iid);
    commitCard(slice, 'b', slice.match.b.cards.hand[0].iid);
    const round = resolveSliceRound(slice);
    expect(round?.aValue).toBe(9);
  });

  it('records an engine overflow to the dev-channel note list', () => {
    const churn = defineCard('churn', {
      value: 6,
      effects: [
        effect({
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
        effect({
          trigger: 'onDraw',
          target: { type: 'zone', owner: 'self', zone: 'hand', select: 'first' },
          effect: { type: 'discard' },
        }),
        effect({
          trigger: 'onDiscard',
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
      ],
    });
    const deck = Array.from({ length: 20 }, () => ({ cardId: 'churn', value: 6 as const }));
    const slice = createSlice({ seed: 3, catalog: makeCatalog([churn]), deckA: deck, deckB: deck });
    commitCard(slice, 'a', slice.match.a.cards.hand[0].iid);
    commitCard(slice, 'b', slice.match.b.cards.hand[0].iid);
    const round = resolveSliceRound(slice);
    expect(round?.overflow).toBe(true);
    expect(slice.notes.length).toBe(1);
  });
});
