// @vitest-environment happy-dom
//
// Two defects that share one cause: a window whose ROOT element outlives the
// markup inside it.
//
// Both of these windows rebuild by writing `root.innerHTML` and then wiring a
// delegated click handler to the root. The markup is new every time; the root
// is the same element from index.html for the life of the session. So a wire
// per rebuild is a listener per rebuild, and the Nth press of a button runs its
// arm N times. On the deck-builder button that is a toggle, so an even count
// opens and closes the window in one press and the button reads as dead; on the
// card arm it is N commands, and on every arm it is N click sounds.
//
// The second is the same shape one level up. The sim emits `cardDuelMatchEnd`
// in the same tick as the final `cardRoundResolved` and drops the match, so the
// very next HUD poll saw a projection that was no longer `inMatch`, computed a
// new shell, and rebuilt the root out from under the round that was still
// speaking (`cacheRegions` drops the theater with it). The match that ENDED was
// the one match a player never got to watch end.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDuelWindow } from '../src/ui/card_duel_window';
import { DeckBuilderWindow } from '../src/ui/deck_builder_window';
import type { CardMinigameInfo } from '../src/world_api';

const noDecks = { names: [], active: '', activeCards: [] };

function liveInfo(over: Partial<NonNullable<CardMinigameInfo['match']>> = {}): CardMinigameInfo {
  return {
    queued: false,
    available: true,
    decks: noDecks,
    match: {
      opponent: { pid: 2, name: 'Bo' },
      hand: [{ iid: 11, cardId: 'briarpack_wolves_howl', value: 3 }],
      deckCount: 14,
      discardCount: 2,
      myRounds: 0,
      opponentRounds: 0,
      myHp: 100,
      opponentHp: 100,
      maxHp: 100,
      myPlayedCard: null,
      resolving: false,
      resolveSecondsLeft: 0,
      round: 1,
      waitingOnOpponent: false,
      opponentCommitted: false,
      opponentHandCount: 4,
      activeEffects: [],
      secondsLeft: 45,
      myCounters: {},
      opponentCounters: {},
      opponentRevealed: [],
      opponentPlayedValues: [],
      ...over,
    },
  };
}

/** The projection once the match is over: the server keeps no finished match. */
function endedInfo(): CardMinigameInfo {
  return { queued: false, available: true, decks: noDecks, match: null };
}

function makeDuelWindow() {
  const root = document.createElement('div');
  document.body.append(root);
  root.style.display = 'block';
  let info: CardMinigameInfo = liveInfo();
  const calls = { openDeckBuilder: 0, play: [] as number[] };
  const world = {
    cardMinigameInfo: info,
    joinCardDuelQueue() {},
    leaveCardDuelQueue() {},
    forfeitCardDuel() {},
    playCardInDuel(iid: number) {
      calls.play.push(iid);
    },
    startCardDuelAgainstOpponent() {},
  };
  const win = new CardDuelWindow({
    root: () => root,
    world: () => world as never,
    openDeckBuilder() {
      calls.openDeckBuilder += 1;
    },
    closeOthers() {},
    captureFocus: () => null,
    restoreFocus() {},
  });
  return {
    win,
    root,
    calls,
    setInfo(next: CardMinigameInfo) {
      info = next;
      world.cardMinigameInfo = next;
    },
  };
}

/** A finished match, as the match-end event delivers it. */
const ending = {
  won: true,
  rounds: 3,
  myHp: 40,
  theirHp: 0,
  maxHp: 100,
  damageDealt: 100,
  damageTaken: 60,
  opponentName: 'Bo',
  opponentId: 'pell',
};

describe('the duel window wires its root once, not once per rebuild', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('runs one arm per press after the shell has been rebuilt several times', () => {
    // The exact sequence a match walks the shell through: available -> in a
    // match -> match over. Every one of those rebuilds the root's markup.
    const { win, root, calls, setInfo } = makeDuelWindow();
    setInfo(endedInfo());
    win.render();
    setInfo(liveInfo());
    win.render();
    setInfo(endedInfo());
    win.render();

    const decks = root.querySelector('[data-decks]') as HTMLElement | null;
    expect(decks).not.toBeNull();
    decks?.click();
    expect(calls.openDeckBuilder).toBe(1);
  });

  it('sends one play command per card press, not one per rebuild', () => {
    const { win, root, calls, setInfo } = makeDuelWindow();
    win.render();
    setInfo(endedInfo());
    win.render();
    setInfo(liveInfo());
    win.render();

    const card = root.querySelector('[data-cd-hand] [data-play]') as HTMLElement | null;
    expect(card).not.toBeNull();
    card?.click();
    expect(calls.play).toEqual([11]);
  });
});

describe('the deck builder wires its root once, not once per rebuild', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('toggles one card per press after a saved-deck change rebuilt the shell', () => {
    const root = document.createElement('div');
    document.body.append(root);
    let deckState = { names: [] as string[], active: '', activeCards: [] as string[] };
    const world = {
      cardMinigameInfo: { decks: deckState },
      saveCardDeck() {},
      selectCardDeck() {},
      deleteCardDeck() {},
    };
    const win = new DeckBuilderWindow({
      root: () => root,
      world: () => world as never,
      closeOthers: () => {},
      captureFocus: () => null,
      restoreFocus: () => {},
    });
    win.toggle();
    // A saved deck appearing is the one change that rebuilds the shell.
    deckState = { names: ['Aggro'], active: '', activeCards: [] };
    world.cardMinigameInfo = { decks: deckState };
    win.render();

    const card = root.querySelector('[data-card]') as HTMLElement | null;
    expect(card).not.toBeNull();
    const id = card?.dataset.card ?? '';
    card?.click();
    // One press, one toggle: the card is now IN the deck. A second listener
    // would toggle it straight back out and the press would do nothing.
    expect(root.querySelector(`[data-card="${id}"]`)?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the health bars wait for the beat that shows the hit', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
  });

  /** What a seat band's bar currently reads. */
  const hpOf = (root: HTMLElement, side: 'mine' | 'theirs') =>
    (
      root.querySelector(`[data-cd-seats-${side === 'mine' ? 'mine' : 'them'}] .dt-hp-num`)
        ?.textContent ?? ''
    ).trim();

  it('holds the pre-round reading until the damage beat, then drops it', () => {
    const { win, root, setInfo } = makeDuelWindow();
    win.render();
    expect(hpOf(root, 'mine')).toContain('100');

    // The round resolved: the snapshot already carries the AFTER value, which
    // is exactly the problem. The viewer took 7.
    setInfo(liveInfo({ myHp: 93, round: 2 }));
    win.showReveal({
      mine: 2,
      theirs: 9,
      mineCardId: 'briarpack_wolves_howl',
      theirsCardId: 'briarpack_wolves_hunt',
      outcome: 'lose',
      reshuffled: false,
      damage: 7,
      damageTo: 'mine',
      myHp: 93,
      theirHp: 100,
      maxHp: 100,
    });
    win.render();
    // Mid-telling: the cards are still turning, so the bar has not moved.
    expect(hpOf(root, 'mine')).toContain('100');
    expect(hpOf(root, 'mine')).not.toContain('93');

    // Far enough in for the damage beat to have opened.
    vi.advanceTimersByTime(20_000);
    win.render();
    expect(hpOf(root, 'mine')).toContain('93');
  });

  it('never holds a round that took no health', () => {
    const { win, root, setInfo } = makeDuelWindow();
    win.render();
    setInfo(liveInfo({ myHp: 100, opponentHp: 100 }));
    win.showReveal({ mine: 4, theirs: 4, outcome: 'push', reshuffled: false, damage: 0 });
    win.render();
    expect(hpOf(root, 'mine')).toContain('100');
  });
});

describe('a match ending waits for the round that decided it', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
  });

  it('holds the table while the round is still being told', () => {
    const { win, root, setInfo } = makeDuelWindow();
    win.render();
    const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
    expect(stage).not.toBeNull();

    // The final round resolves and the match ends in the same tick, which is
    // exactly what the sim does.
    expect(
      win.showReveal({
        mine: 9,
        theirs: 2,
        mineCardId: 'briarpack_wolves_howl',
        theirsCardId: 'briarpack_wolves_hunt',
        outcome: 'win',
        reshuffled: false,
        damage: 7,
        damageTo: 'theirs',
        myHp: 100,
        theirHp: 0,
        maxHp: 100,
      }),
    ).toBe(true);
    expect(win.showMatchEnd(ending)).toBe(true);

    // The snapshot has already dropped the match. The poll that follows must
    // NOT rebuild the shell out of the round: the stage element survives, and
    // the summary has not taken the window.
    setInfo(endedInfo());
    win.render();
    expect(root.querySelector('[data-cd-stage]')).toBe(stage);
    expect(root.querySelector('.dt-sum')).toBeNull();

    // Once the round, the outro and its hold are done, the summary arrives.
    vi.advanceTimersByTime(60_000);
    win.render();
    expect(root.querySelector('.dt-sum')).not.toBeNull();
  });
});
