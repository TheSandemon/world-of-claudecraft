import { describe, expect, it } from 'vitest';
import {
  applyRoundResult,
  buildBoard,
  counterValue,
  countHistory,
  createMatchState,
  limitKey,
  otherSeat,
  recordHistory,
  revealToOpponent,
  seatForOwner,
  setCounter,
  sideOf,
  uniqueTribesPlayed,
} from '../src/sim/minigames/card_duel/match_state';
import { defineCard, emptyHand, instanceOf, makeCatalog } from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'] });
const ranger = defineCard('ranger', { value: 5, tribes: ['Human'] });
const catalog = makeCatalog([wolf, ranger]);

const freshMatch = () => createMatchState(emptyHand(), emptyHand());

describe('card_duel match state', () => {
  it('owner references resolve relative to the reading seat', () => {
    expect(otherSeat('a')).toBe('b');
    expect(seatForOwner('a', 'self')).toBe('a');
    expect(seatForOwner('a', 'opponent')).toBe('b');
    expect(seatForOwner('b', 'self')).toBe('b');
    expect(seatForOwner('b', 'opponent')).toBe('a');
  });

  it('builds a board side per seat, effective starting equal to base', () => {
    const state = freshMatch();
    state.a.playedThisRound = instanceOf(wolf);
    const board = buildBoard(state, catalog);
    expect(board.a.baseValue).toBe(3);
    expect(board.a.effectiveValue).toBe(3);
    expect(board.a.tribes).toEqual(['Beast']);
    // A seat with no card still gets a readable entry rather than a null hole.
    expect(board.b.card).toBeNull();
    expect(board.b.effectiveValue).toBe(0);
  });

  it('a board tribe edit never writes back into the catalog definition', () => {
    const state = freshMatch();
    state.a.playedThisRound = instanceOf(wolf);
    const board = buildBoard(state, catalog);
    board.a.tribes.push('Undead');
    expect(wolf.tribes).toEqual(['Beast']);
    expect(buildBoard(state, catalog).a.tribes).toEqual(['Beast']);
  });

  it('counters clamp at zero and read zero when unset', () => {
    const state = freshMatch();
    expect(counterValue(state.a, 'Pack')).toBe(0);
    setCounter(state.a, 'Pack', 3);
    expect(counterValue(state.a, 'Pack')).toBe(3);
    setCounter(state.a, 'Pack', -5);
    expect(counterValue(state.a, 'Pack')).toBe(0);
  });

  it('the revealed set is idempotent and sorted, so both hosts serialize it identically', () => {
    const state = freshMatch();
    revealToOpponent(state.b, 44);
    revealToOpponent(state.b, 11);
    revealToOpponent(state.b, 44);
    expect(state.b.revealedToOpponent).toEqual([11, 44]);
  });

  it('a win advances the winner streak and resets the loser one, a tie resets both', () => {
    const state = freshMatch();
    applyRoundResult(state, 'a');
    applyRoundResult(state, 'a');
    expect(state.a.roundWins).toBe(2);
    expect(state.a.consecutiveWins).toBe(2);
    expect(state.b.consecutiveLosses).toBe(2);
    expect(state.b.roundWins).toBe(0);

    applyRoundResult(state, 'b');
    expect(state.a.consecutiveWins).toBe(0);
    expect(state.b.consecutiveWins).toBe(1);
    expect(state.a.previousResult).toBe('lose');

    applyRoundResult(state, null);
    expect(state.a.consecutiveWins).toBe(0);
    expect(state.a.consecutiveLosses).toBe(0);
    expect(state.b.consecutiveWins).toBe(0);
    expect(state.a.previousResult).toBe('tie');
    // A push scores for nobody.
    expect(state.a.roundWins + state.b.roundWins).toBe(3);
  });

  it('history counts by owner and round window', () => {
    const state = freshMatch();
    recordHistory(state, 'a', instanceOf(wolf), 3, ['Beast'], 'win');
    state.round = 2;
    recordHistory(state, 'a', instanceOf(ranger), 5, ['Human'], 'lose');
    recordHistory(state, 'b', instanceOf(wolf), 3, ['Beast'], 'win');
    expect(countHistory(state, {}, null)).toBe(3);
    expect(countHistory(state, {}, 'a')).toBe(2);
    expect(countHistory(state, { fromRound: 2 }, 'a')).toBe(1);
    expect(countHistory(state, { toRound: 1 }, 'a')).toBe(1);
    expect(uniqueTribesPlayed(state, 'a')).toBe(2);
    expect(uniqueTribesPlayed(state, 'b')).toBe(1);
  });

  it('sideOf returns the live seat object, not a copy', () => {
    const state = freshMatch();
    sideOf(state, 'b').roundWins = 4;
    expect(state.b.roundWins).toBe(4);
  });

  it('limit keys separate the seats and the effects of one card', () => {
    expect(limitKey('a', 'wolf', 0)).not.toBe(limitKey('b', 'wolf', 0));
    expect(limitKey('a', 'wolf', 0)).not.toBe(limitKey('a', 'wolf', 1));
  });
});
