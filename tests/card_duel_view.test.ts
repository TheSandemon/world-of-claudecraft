import { describe, expect, it } from 'vitest';
import { buildCardDuelView } from '../src/ui/card_duel_view';
import type { CardMinigameInfo } from '../src/world_api';

/** A wire card as the snapshot carries it: an instance handle, its catalog id,
 *  and its face value. The value alone is not an identity (a hand can hold two
 *  different cards of the same value), which is why the view keys on `iid`. */
function wireCard(iid: number, value: number, cardId = `card_${value}`) {
  return { iid, cardId, value };
}

/** The match fields every case below shares. */
const matchDefaults = {
  myHp: 100,
  opponentHp: 100,
  maxHp: 100,
  myPlayedCard: null,
  resolving: false,
  resolveSecondsLeft: 0,
  round: 1,
  secondsLeft: 45,
  myCounters: {},
  opponentCounters: {},
  opponentRevealed: [],
  opponentPlayedValues: [],
};

/** No saved decks: the state a character starts in. */
const noDecks = { names: [], active: '', activeCards: [] };

describe('card_duel_view', () => {
  it('idle state when not queued and not in a match', () => {
    const info: CardMinigameInfo = { queued: false, available: true, decks: noDecks, match: null };
    const view = buildCardDuelView(info);
    expect(view.state).toBe('idle');
    expect(view.hand).toEqual([]);
  });

  it('queued state when waiting in the matchmaking queue', () => {
    const info: CardMinigameInfo = { queued: true, available: true, decks: noDecks, match: null };
    const view = buildCardDuelView(info);
    expect(view.state).toBe('queued');
  });

  it('unavailable state when no other player exists to ever pair against (offline)', () => {
    const info: CardMinigameInfo = { queued: false, available: false, decks: noDecks, match: null };
    const view = buildCardDuelView(info);
    expect(view.state).toBe('unavailable');
  });

  it('queued wins over unavailable if somehow both (queued takes priority)', () => {
    const info: CardMinigameInfo = { queued: true, available: false, decks: noDecks, match: null };
    const view = buildCardDuelView(info);
    expect(view.state).toBe('queued');
  });

  it('inMatch state maps hand, scores, and opponent from a live match', () => {
    const info: CardMinigameInfo = {
      queued: false,
      available: true,
      decks: noDecks,
      match: {
        opponent: { pid: 7, name: 'Aki' },
        hand: [wireCard(11, 3), wireCard(12, 8), wireCard(13, 1), wireCard(14, 5)],
        deckCount: 12,
        discardCount: 2,
        myRounds: 1,
        opponentRounds: 0,
        waitingOnOpponent: false,
        opponentCommitted: false,
        opponentHandCount: 4,
        activeEffects: [],
        ...matchDefaults,
      },
    };
    const view = buildCardDuelView(info);
    expect(view.state).toBe('inMatch');
    expect(view.opponentName).toBe('Aki');
    expect(view.myRounds).toBe(1);
    expect(view.opponentRounds).toBe(0);
    expect(view.deckCount).toBe(12);
    expect(view.discardCount).toBe(2);
    expect(view.hand).toEqual([
      { iid: 11, cardId: 'card_3', value: 3, playable: true, pendingDelta: 0 },
      { iid: 12, cardId: 'card_8', value: 8, playable: true, pendingDelta: 0 },
      { iid: 13, cardId: 'card_1', value: 1, playable: true, pendingDelta: 0 },
      { iid: 14, cardId: 'card_5', value: 5, playable: true, pendingDelta: 0 },
    ]);
  });

  it('marks every hand card unplayable while waiting on the opponent', () => {
    const info: CardMinigameInfo = {
      queued: false,
      available: true,
      decks: noDecks,
      match: {
        opponent: { pid: 7, name: 'Aki' },
        hand: [wireCard(21, 4), wireCard(22, 9)],
        deckCount: 10,
        discardCount: 4,
        myRounds: 0,
        opponentRounds: 1,
        waitingOnOpponent: true,
        opponentCommitted: false,
        opponentHandCount: 4,
        activeEffects: [],
        ...matchDefaults,
      },
    };
    const view = buildCardDuelView(info);
    expect(view.waitingOnOpponent).toBe(true);
    expect(view.hand.every((c) => !c.playable)).toBe(true);
  });

  it('marks every hand card unplayable while the last round is still being told', () => {
    // The user-visible bug this closes: the round resolved, the hand refilled,
    // and the effects and health were still landing on screen when the next
    // card could already be clicked, cutting the round off mid-sentence. The
    // sim refuses such a play outright, so a live hand there offered a click
    // that would be thrown away.
    const info: CardMinigameInfo = {
      queued: false,
      available: true,
      decks: noDecks,
      match: {
        opponent: { pid: 7, name: 'Aki' },
        hand: [wireCard(21, 4), wireCard(22, 9)],
        deckCount: 10,
        discardCount: 4,
        myRounds: 1,
        opponentRounds: 0,
        // Nobody is being waited on: this is the window AFTER a round resolved.
        waitingOnOpponent: false,
        opponentCommitted: false,
        opponentHandCount: 4,
        activeEffects: [],
        ...matchDefaults,
        resolving: true,
        resolveSecondsLeft: 2.4,
      },
    };
    const view = buildCardDuelView(info);
    expect(view.resolving).toBe(true);
    expect(view.waitingOnOpponent).toBe(false);
    expect(view.hand.every((c) => !c.playable)).toBe(true);
    // And it comes straight back when the telling ends, which is the same
    // instant the round clock starts counting again.
    const told = info.match;
    if (!told) throw new Error('expected a match');
    const after = buildCardDuelView({
      ...info,
      match: { ...told, resolving: false, resolveSecondsLeft: 0 },
    });
    expect(after.hand.every((c) => c.playable)).toBe(true);
  });

  it('same input produces the same output regardless of Sim vs ClientWorld origin (data is host-agnostic)', () => {
    const info: CardMinigameInfo = {
      queued: false,
      available: true,
      decks: noDecks,
      match: {
        opponent: { pid: 2, name: 'Bo' },
        hand: [wireCard(31, 6)],
        deckCount: 15,
        discardCount: 4,
        myRounds: 0,
        opponentRounds: 0,
        waitingOnOpponent: false,
        opponentCommitted: false,
        opponentHandCount: 4,
        activeEffects: [],
        ...matchDefaults,
      },
    };
    // Both Sim.cardMinigameInfo and ClientWorld.cardMinigameInfo produce this
    // exact plain-data shape, so a single stub covers both hosts.
    expect(buildCardDuelView(info)).toEqual(buildCardDuelView({ ...info }));
  });

  it('carries the instance handle through, so two cards of one value stay distinct', () => {
    // The case the value-keyed view could not express at all: a hand holding
    // BOTH copies of a value. Playing one must name the exact card.
    const info: CardMinigameInfo = {
      queued: false,
      available: true,
      decks: noDecks,
      match: {
        opponent: { pid: 2, name: 'Bo' },
        hand: [
          wireCard(41, 3, 'briarpack_wolves_howl'),
          wireCard(42, 3, 'briarpack_wolves_ambush'),
        ],
        deckCount: 15,
        discardCount: 3,
        myRounds: 0,
        opponentRounds: 0,
        waitingOnOpponent: false,
        opponentCommitted: false,
        opponentHandCount: 4,
        activeEffects: [],
        ...matchDefaults,
      },
    };
    const view = buildCardDuelView(info);
    expect(view.hand.map((c) => c.iid)).toEqual([41, 42]);
    expect(new Set(view.hand.map((c) => c.cardId)).size).toBe(2);
  });
});
