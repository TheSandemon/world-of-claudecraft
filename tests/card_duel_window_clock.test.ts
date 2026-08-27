// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDuelWindow } from '../src/ui/card_duel_window';
import { DUEL_BEAT_GAP_MS } from '../src/ui/cards/duel_beats_core';
import { resolveDuelMotion } from '../src/ui/cards/duel_theater_host';
import type { CardMinigameInfo } from '../src/world_api';

const here = path.dirname(fileURLToPath(import.meta.url));
const CARDS_CSS = readFileSync(path.join(here, '..', 'src', 'styles', 'cards.css'), 'utf8');

/** No saved decks: the state a character starts in. */
const noDecks = { names: [], active: '', activeCards: [] };

function liveInfo(over: Partial<NonNullable<CardMinigameInfo['match']>> = {}): CardMinigameInfo {
  return {
    queued: false,
    available: true,
    decks: noDecks,
    match: {
      opponent: { pid: 2, name: 'Bo' },
      hand: [
        { iid: 11, cardId: 'briarpack_wolves_howl', value: 3 },
        { iid: 12, cardId: 'briarpack_wolves_moonrun', value: 6 },
      ],
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

/** A window over a real (happy-dom) root, with a settable snapshot. */
function makeWindow() {
  const root = document.createElement('div');
  document.body.append(root);
  root.style.display = 'block';
  let info = liveInfo();
  const world = {
    cardMinigameInfo: info,
    joinCardDuelQueue() {},
    leaveCardDuelQueue() {},
    forfeitCardDuel() {},
    playCardInDuel() {},
  };
  const win = new CardDuelWindow({
    root: () => root,
    // The window only reads the card-minigame facet off IWorld.
    world: () => world as never,
    openDeckBuilder() {},
    closeOthers() {},
    captureFocus: () => null,
    restoreFocus() {},
  });
  return {
    win,
    root,
    setInfo(next: CardMinigameInfo) {
      info = next;
      world.cardMinigameInfo = next;
    },
  };
}

describe('card duel window clock and round theater', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-fx-level');
  });

  it('paints the round clock from the snapshot deadline', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    const clock = root.querySelector('[data-cd-clock]') as HTMLElement;
    expect(clock).not.toBeNull();
    expect(clock.textContent).toContain('45');

    setInfo(liveInfo({ secondsLeft: 12.4 }));
    win.render();
    // Ceil, so a player never reads a second they no longer have.
    expect(clock.textContent).toContain('13');
  });

  it('drains the clock ring from the same deadline, and names the urgency band', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    const ring = root.querySelector('[data-cd-clockring]') as HTMLElement;
    expect(ring.style.getPropertyValue('--dt-clock-ratio')).toBe('1.00');
    expect(ring.dataset.band).toBe('calm');

    setInfo(liveInfo({ secondsLeft: 9 }));
    win.render();
    expect(ring.style.getPropertyValue('--dt-clock-ratio')).toBe('0.20');
    expect(ring.dataset.band).toBe('urgent');

    setInfo(liveInfo({ secondsLeft: 0 }));
    win.render();
    expect(ring.dataset.band).toBe('out');
  });

  it('keeps ticking the clock while the rest of the window is unchanged', () => {
    // The clock sits OUTSIDE every region signature on purpose: folding it in
    // would rebuild that region every second, and leaving it INSIDE an early
    // return would freeze the one number the round is racing.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const clock = root.querySelector('[data-cd-clock]') as HTMLElement;
    const handBefore = root.querySelector('[data-cd-hand]')?.innerHTML;
    setInfo(liveInfo({ secondsLeft: 30 }));
    win.render();
    expect(clock.textContent).toContain('30');
    // Same element, so no rebuild happened.
    expect(root.querySelector('[data-cd-clock]')).toBe(clock);
    expect(root.querySelector('[data-cd-hand]')?.innerHTML).toBe(handBefore);
  });

  it('reads out of time rather than a negative number', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    const clock = root.querySelector('[data-cd-clock]') as HTMLElement;
    setInfo(liveInfo({ secondsLeft: 0 }));
    win.render();
    expect(clock.textContent).toBe('Time is up');
    expect(clock.textContent).not.toContain('-');
  });

  it('says whose commit the round is waiting on, and lamps both seats', () => {
    // The complaint this answers: a pause used to be indistinguishable from a
    // stalled client. Both halves are snapshot-driven and never animated in.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const waiting = root.querySelector('[data-cd-waiting]') as HTMLElement;
    expect(waiting.textContent).toBe('Both players are choosing');
    const seatState = (sel: string) =>
      (root.querySelector(sel) as HTMLElement).getAttribute('data-commit');
    expect(seatState('[data-cd-seats-mine] .dt-seat')).toBe('choosing');
    expect(seatState('[data-cd-seats-them] .dt-seat')).toBe('choosing');

    setInfo(liveInfo({ waitingOnOpponent: true }));
    win.render();
    expect(waiting.textContent).toBe('Waiting on your opponent');
    expect(seatState('[data-cd-seats-mine] .dt-seat')).toBe('locked');
    expect(seatState('[data-cd-seats-them] .dt-seat')).toBe('choosing');

    setInfo(liveInfo({ opponentCommitted: true }));
    win.render();
    expect(waiting.textContent).toBe('Your opponent is ready');
    expect(seatState('[data-cd-seats-them] .dt-seat')).toBe('locked');
  });

  it('names one of the Card Master regulars from its content id, not from an empty player name', () => {
    // A regular has no player meta at all, so its seat arrives with an empty
    // `name` and a content id. Before this, every bot match showed a nameless
    // opponent, which is most of the matches a single-player world can have.
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ opponent: { pid: -9000, name: '', opponentId: 'gravedigger_ossa' } }));
    win.render();
    const band = root.querySelector('[data-cd-seats-them] .dt-seat-name') as HTMLElement;
    expect(band.textContent).toBe('Ossa');
  });

  it('shows health as a bar carrying its own numbers, on both seats', () => {
    // Health decides the match, so it is the one thing on the band that must
    // read at a glance AND state the exact figure: "can that card finish me"
    // is not a question a bar alone can answer.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const bar = (sel: string) => root.querySelector(`${sel} .dt-hp`) as HTMLElement;
    expect(bar('[data-cd-seats-mine]').textContent).toBe('100/100');
    expect(bar('[data-cd-seats-mine]').dataset.band).toBe('healthy');

    setInfo(liveInfo({ myHp: 42, opponentHp: 88 }));
    win.render();
    expect(bar('[data-cd-seats-mine]').textContent).toBe('42/100');
    expect(bar('[data-cd-seats-mine]').dataset.band).toBe('hurt');
    expect(
      (bar('[data-cd-seats-mine]').querySelector('.dt-hp-fill') as HTMLElement).style.width,
    ).toBe('42.0%');
    expect(bar('[data-cd-seats-them]').textContent).toBe('88/100');

    setInfo(liveInfo({ myHp: 7 }));
    win.render();
    expect(bar('[data-cd-seats-mine]').dataset.band).toBe('critical');
  });

  it('keeps the round score as a readout beside the bar', () => {
    // Cards still read the round score (scoreCompare, the score expression), so
    // it stays on the table; it just stopped being what ends the match.
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ myRounds: 2 }));
    win.render();
    const rounds = root.querySelector('[data-cd-seats-mine] .dt-rounds') as HTMLElement;
    expect(rounds.textContent).toBe('Rounds won: 2');
  });

  it('puts the viewer own pile counts on the viewer own band, and no figures on the opponent', () => {
    // The projection deliberately never carries the opponent's counts, so a
    // pile COUNT on their band would be a number the client invented. Their
    // discard is still a PLACE (their spent cards are swept to it at the end
    // of a round), just one that claims nothing about what is in it.
    const { win, root } = makeWindow();
    win.render();
    const mine = [...root.querySelectorAll('[data-cd-seats-mine] .dt-pile-count')];
    expect(mine.map((el) => el.textContent)).toEqual(['14', '2']);
    const theirs = [...root.querySelectorAll('[data-cd-seats-them] .dt-pile')];
    expect(theirs.map((el) => (el as HTMLElement).dataset.pile)).toEqual(['discard']);
    expect(root.querySelectorAll('[data-cd-seats-them] .dt-pile-count').length).toBe(0);
  });

  it('shows counters as tokens, and drops one spent back to zero', () => {
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ myCounters: { Web: 2 }, opponentCounters: { Dread: 1, Web: 0 } }));
    win.render();
    const mine = root.querySelector('[data-cd-seats-mine] .dt-token') as HTMLElement;
    expect(mine.dataset.counter).toBe('Web');
    expect(mine.textContent).toContain('2');
    const theirs = [...root.querySelectorAll('[data-cd-seats-them] .dt-token')];
    expect(theirs.map((el) => (el as HTMLElement).dataset.counter)).toEqual(['Dread']);
  });

  it('gives the opponent hand a place on the table, and reveals INTO it', () => {
    // The complaint this answers: a revealed card used to arrive in a strip of
    // its own with no opponent hand anywhere, so there was nothing to read it
    // against and no way to tell how much of their hand it was.
    const { win, root, setInfo } = makeWindow();
    win.render();
    expect(root.querySelectorAll('[data-cd-oppohand] .dt-oppo-back').length).toBe(4);
    expect(root.querySelector('[data-cd-oppohand] .cf')).toBeNull();

    setInfo(
      liveInfo({ opponentRevealed: [{ iid: 90, cardId: 'briarpack_wolves_hunt', value: 2 }] }),
    );
    win.render();
    const row = root.querySelector('[data-cd-oppohand]') as HTMLElement;
    // One of the four places is now a real card; the other three stay down.
    expect(row.querySelectorAll('.cf').length).toBe(1);
    expect(row.querySelectorAll('.dt-oppo-back').length).toBe(3);
    expect(row.textContent).toContain('Hunt');
  });

  it('shrinks the opponent hand as they commit, so the row is their real hand', () => {
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ opponentHandCount: 3 }));
    win.render();
    expect(root.querySelectorAll('[data-cd-oppohand] .dt-oppo-back').length).toBe(3);
  });

  it('never grows the opponent hand past the count the server reported', () => {
    // A card revealed and then PLAYED is no longer held: the revealed set can
    // outrun the hand, and the row must not invent a place for it.
    const { win, root, setInfo } = makeWindow();
    setInfo(
      liveInfo({
        opponentHandCount: 1,
        opponentRevealed: [
          { iid: 90, cardId: 'briarpack_wolves_hunt', value: 2 },
          { iid: 91, cardId: 'briarpack_wolves_howl', value: 3 },
        ],
      }),
    );
    win.render();
    const row = root.querySelector('[data-cd-oppohand]') as HTMLElement;
    expect(row.querySelectorAll('.cf').length).toBe(1);
    expect(row.querySelectorAll('.dt-oppo-back').length).toBe(0);
  });

  it('lists what is still in play, the viewer own effects first', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    expect(root.querySelector('.dt-fx')).toBeNull();
    setInfo(
      liveInfo({
        activeEffects: [
          { mine: false, cardId: 'grave_candle', amount: 2, duration: 'untilTriggered' },
          {
            mine: true,
            cardId: 'eastbrook_company_rangers_stable_shift',
            amount: 2,
            duration: 'untilTriggered',
          },
        ],
      }),
    );
    win.render();
    const chips = [...root.querySelectorAll('.dt-fx')] as HTMLElement[];
    expect(chips.map((c) => c.dataset.side)).toEqual(['mine', 'theirs']);
    expect(chips[0].textContent).toContain('Stable Shift');
    expect(chips[0].textContent).toContain('+2');
    // The source card's own sentence is the explanation, so it is the chip's
    // accessible name rather than a second copy of the wording.
    expect(chips[0].getAttribute('aria-label')).toContain('Beast');
  });

  it('lets a player read what a hand card DOES, and follows it across a repaint', () => {
    // The complaint this answers: a hand card is too small to show its rules
    // sentence, so a player could see what a card was worth and not what it did.
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ hand: [{ iid: 11, cardId: 'briarpack_wolves_moonrun', value: 6 }] }));
    win.render();
    const card = root.querySelector('[data-cd-hand] [data-inspect]') as HTMLElement;
    expect(card.dataset.inspect).toBe('11');
    const hover = new window.MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
    card.dispatchEvent(hover);
    const peek = () => document.querySelector('.cf-inspect') as HTMLElement | null;
    expect(peek()?.textContent).toContain('Moonrun');
    expect(peek()?.querySelector('.cf-rules')?.textContent).toContain('Pack');

    // A repricing repaints the hand under the peek: it must follow the card,
    // with the new numbers, rather than describe a node that is gone.
    setInfo(
      liveInfo({
        hand: [{ iid: 11, cardId: 'briarpack_wolves_moonrun', value: 6, pendingDelta: 2 }],
      }),
    );
    win.render();
    expect(peek()?.style.display).toBe('block');
    expect(peek()?.querySelector('.cf-value')?.textContent).toBe('8');

    // Played out of the hand: nothing to describe, so nothing is shown.
    setInfo(liveInfo({ hand: [{ iid: 12, cardId: 'briarpack_wolves_howl', value: 3 }] }));
    win.render();
    expect(peek()?.style.display).toBe('none');
  });

  it('shows a hand card at what it is worth, with the printed value beside it', () => {
    // What a player asked for: the real number big, and a small chip saying how
    // far it moved.
    const { win, root, setInfo } = makeWindow();
    setInfo(
      liveInfo({ hand: [{ iid: 11, cardId: 'briarpack_wolves_howl', value: 3, pendingDelta: 2 }] }),
    );
    win.render();
    const face = root.querySelector('[data-cd-hand] .cf') as HTMLElement;
    expect(face.querySelector('.cf-value')?.textContent).toBe('5');
    expect(face.querySelector('.cf-base')?.textContent).toBe('3');
    expect(face.querySelector('.cf-delta')?.textContent).toBe('+2');
  });

  it('leaves a hand card alone when nothing is parked on it', () => {
    const { win, root } = makeWindow();
    win.render();
    const face = root.querySelector('[data-cd-hand] .cf') as HTMLElement;
    expect(face.querySelector('.cf-value')?.textContent).toBe('3');
    expect(face.querySelector('.cf-delta')).toBeNull();
  });

  it('the stage is driven by the round event, not by the snapshot', () => {
    const { win, root } = makeWindow();
    win.render();
    const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
    expect(stage.dataset.beat).toBe('idle');
    expect(stage.textContent).toContain('The table is empty');

    expect(
      win.showReveal({
        mine: 5,
        theirs: 3,
        mineBase: 3,
        theirsBase: 3,
        mineCardId: 'briarpack_wolves_howl',
        theirsCardId: 'briarpack_wolves_hunt',
        outcome: 'win',
        reshuffled: false,
      }),
    ).toBe(true);
    expect(stage.getAttribute('data-outcome')).toBe('win');
    expect(stage.textContent).toContain('5');
    expect(stage.textContent).toContain('3');
    // The two cards that actually clashed, not two bare numbers.
    expect(stage.textContent).toContain('Howl');
    expect(stage.textContent).toContain('Hunt');

    // A later render must not wipe it: the shell signature has not moved, so
    // the narration of the round that just resolved survives.
    win.render();
    expect(stage.textContent).toContain('Howl');
  });

  it('a hand refill repaints the hand without touching the stage mid-timeline', () => {
    // The regression this pins: the window used to rebuild its whole subtree on
    // any snapshot change, which wiped a playing round out from under itself.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
    win.showReveal({ mine: 5, theirs: 3, outcome: 'win', reshuffled: false });
    setInfo(
      liveInfo({ hand: [{ iid: 21, cardId: 'briarpack_wolves_hunt', value: 2 }], deckCount: 13 }),
    );
    win.render();
    expect(root.querySelectorAll('[data-cd-hand] .cf').length).toBe(1);
    expect(root.querySelector('[data-cd-stage]')).toBe(stage);
    expect(stage.getAttribute('data-outcome')).toBe('win');
  });

  it('repaints a hand whose rules numbers re-priced, with every other field identical', () => {
    // A scaling card's sentence moves between rounds while its iid, id, value
    // and playability all stay put, so it has to ride the hand signature.
    const { win, root, setInfo } = makeWindow();
    const scaling = (amount: number) => [
      { iid: 11, cardId: 'briarpack_wolves_hunt', value: 2, textValues: { amount } },
    ];
    setInfo(liveInfo({ hand: scaling(1) }));
    win.render();
    const rules = () =>
      (root.querySelector('[data-cd-hand] .cf-rules') as HTMLElement).textContent ?? '';
    expect(rules()).toContain('+1');
    setInfo(liveInfo({ hand: scaling(3) }));
    win.render();
    expect(rules()).toContain('+3');
    expect(rules()).not.toContain('-1');
  });

  it('walks the beats and hands each cue to the beat it belongs on', () => {
    vi.useFakeTimers();
    try {
      const { win } = makeWindow();
      win.render();
      const cues: string[] = [];
      const audio = {
        cardReveal: () => cues.push('reveal'),
        cardRoundPush: () => cues.push('push'),
        cardShuffle: () => cues.push('shuffle'),
        cardEffect: () => cues.push('effect'),
        cardHit: () => cues.push('hit'),
      };
      const root = document.body.firstElementChild as HTMLElement;
      const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
      win.showReveal(
        { mine: 4, theirs: 4, mineBase: 2, theirsBase: 4, outcome: 'push', reshuffled: true },
        audio,
      );
      // The first beat opens synchronously: the cards land face-down.
      expect(stage.dataset.beat).toBe('deal');
      expect(cues).toEqual([]);
      // Taken from the beat itself: the pacing is retuned from one constant,
      // and a literal here would pin the old numbers instead of the rule.
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.deal);
      expect(stage.dataset.beat).toBe('reveal');
      expect(cues).toEqual(['reveal']);
      vi.advanceTimersByTime(10000);
      expect(stage.dataset.beat).toBe('settle');
      // The push cue rides the verdict and the shuffle rides the settle, so a
      // round no longer sounds like one undifferentiated noise.
      expect(cues).toEqual(['reveal', 'push', 'shuffle']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still plays every beat at the lowest graphics preset, sheds only the motion', () => {
    // The complaint this answers: at the low preset the whole round used to
    // land in one frame, so the cheapest machine was the only one that never
    // got to watch the round happen. The preset sheds ANIMATION (the CSS tier
    // block does that); the PACING is how a round is read, so it stays.
    vi.useFakeTimers();
    try {
      document.documentElement.dataset.fxLevel = 'low';
      const { win, root } = makeWindow();
      win.render();
      const cues: string[] = [];
      const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
      win.showReveal(
        { mine: 6, theirs: 2, outcome: 'win', reshuffled: true },
        {
          cardReveal: () => cues.push('reveal'),
          cardRoundPush: () => cues.push('push'),
          cardShuffle: () => cues.push('shuffle'),
          cardEffect: () => cues.push('effect'),
          cardHit: () => cues.push('hit'),
        },
      );
      expect(stage.dataset.beat).toBe('deal');
      // Taken from the beat itself: the pacing is retuned from one constant,
      // and a literal here would pin the old numbers instead of the rule.
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.deal);
      expect(stage.dataset.beat).toBe('reveal');
      expect(cues).toEqual(['reveal']);
      vi.advanceTimersByTime(10000);
      expect(stage.dataset.beat).toBe('settle');
      expect(cues).toEqual(['reveal', 'shuffle']);
    } finally {
      document.documentElement.removeAttribute('data-fx-level');
      vi.useRealTimers();
    }
  });

  it('still plays every beat under reduced motion, and marks the round calm', () => {
    // Reduced motion used to collapse the whole round into one frame, and that
    // was the bug: both cards, the effects, the hit and the winner arrived
    // together, so the player was left with a result and no idea what produced
    // it. What reduced motion is owed is the absence of MOVEMENT, not the
    // absence of being told what happened. So the beats stay, at their own
    // times, and the stylesheet keys the quiet version off data-motion.
    vi.useFakeTimers();
    try {
      document.body.classList.add('reduce-motion');
      const { win, root } = makeWindow();
      win.render();
      const cues: string[] = [];
      const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
      const board = root.querySelector('[data-cd-board]') as HTMLElement;
      win.showReveal(
        { mine: 6, theirs: 2, outcome: 'win', reshuffled: true },
        {
          cardReveal: () => cues.push('reveal'),
          cardRoundPush: () => cues.push('push'),
          cardShuffle: () => cues.push('shuffle'),
          cardEffect: () => cues.push('effect'),
          cardHit: () => cues.push('hit'),
        },
      );
      expect(board.dataset.motion).toBe('calm');
      expect(stage.dataset.beat).toBe('deal');
      expect(cues).toEqual([]);
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.deal);
      expect(stage.dataset.beat).toBe('reveal');
      expect(board.dataset.spot).toBe('both');
      expect(cues).toEqual(['reveal']);
      vi.advanceTimersByTime(10000);
      expect(stage.dataset.beat).toBe('settle');
      expect(cues).toEqual(['reveal', 'shuffle']);
    } finally {
      document.body.classList.remove('reduce-motion');
      vi.useRealTimers();
    }
  });

  it('says what each beat is doing, in words, one line at a time', () => {
    // At the low preset nothing animates, so this line is the only thing that
    // tells a clash apart from the beat before it. It also names the CARD that
    // moved a number, which is the complaint that started all of this.
    vi.useFakeTimers();
    try {
      const { win, root } = makeWindow();
      win.render();
      const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
      win.showReveal({
        mine: 6,
        theirs: 2,
        mineBase: 4,
        theirsBase: 2,
        mineCardId: 'briarpack_wolves_howl',
        theirsCardId: 'briarpack_wolves_hunt',
        outcome: 'win',
        reshuffled: false,
        steps: [
          {
            side: 'mine',
            cardId: 'eastbrook_company_rangers_stable_shift',
            effect: 'modifyValue',
            target: 'mine',
            amount: 2,
            valueAfter: 6,
          },
        ],
        damage: 4,
        damageTo: 'theirs',
        myHp: 100,
        theirHp: 96,
        maxHp: 100,
      });
      const line = () => (stage.querySelector('[data-cd-beatline]') as HTMLElement).textContent;
      expect(line()).toBe('Cards down');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.deal);
      expect(line()).toBe('Cards turn');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.reveal);
      // The step beat: the card that did it, the number it moved, and whose
      // card it moved it on.
      expect(line()).toBe("6 Rangers' Stable Shift: +2 to your card");
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.step);
      expect(line()).toBe('The cards clash');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.clash);
      expect(line()).toBe('Your opponent takes 4');
      // Not read aloud: the announce line already says the whole round once.
      expect((stage.querySelector('.dt-beats') as HTMLElement).getAttribute('aria-hidden')).toBe(
        'true',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('puts a committed card face-down on the table, on the side that played it', () => {
    // Where a played card GOES. Before this it left the hand and ceased to
    // exist until the round resolved, so the table could not answer "have I
    // played, and have they?" with anything but a lamp on a band.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const slot = (side: string) =>
      root.querySelector(`[data-cd-stage] [data-cd-slot="${side}"]`)?.parentElement as HTMLElement;
    expect(slot('mine').classList.contains('dt-slot-empty')).toBe(true);

    setInfo(
      liveInfo({
        waitingOnOpponent: true,
        myPlayedCard: { iid: 11, cardId: 'briarpack_wolves_howl', value: 3 },
      }),
    );
    win.render();
    expect(slot('mine').classList.contains('dt-slot-empty')).toBe(false);
    expect(slot('theirs').classList.contains('dt-slot-empty')).toBe(true);

    setInfo(
      liveInfo({
        waitingOnOpponent: true,
        opponentCommitted: true,
        myPlayedCard: { iid: 11, cardId: 'briarpack_wolves_howl', value: 3 },
      }),
    );
    win.render();
    expect(slot('theirs').classList.contains('dt-slot-empty')).toBe(false);
  });

  it('leaves the finished round on the table until the next card is played', () => {
    // The snapshot flips to "round 2, nobody has committed" the instant a round
    // resolves. Repainting the stage on that would wipe the result out from
    // under the player mid-glance.
    vi.useFakeTimers();
    try {
      const { win, root, setInfo } = makeWindow();
      win.render();
      const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
      win.showReveal({
        mine: 6,
        theirs: 2,
        mineCardId: 'briarpack_wolves_howl',
        theirsCardId: 'briarpack_wolves_hunt',
        outcome: 'win',
        reshuffled: false,
      });
      // Past the whole timeline: the stage belongs to the theater while it
      // plays, so the "does the result survive" question is only meaningful
      // once it has finished telling the round.
      vi.advanceTimersByTime(20000);
      expect(stage.textContent).toContain('Howl');

      setInfo(liveInfo({ round: 2 }));
      win.render();
      expect(stage.textContent).toContain('Howl');

      // Playing the next card is what clears it.
      setInfo(
        liveInfo({
          round: 2,
          waitingOnOpponent: true,
          myPlayedCard: { iid: 12, cardId: 'briarpack_wolves_moonrun', value: 6 },
        }),
      );
      win.render();
      expect(stage.textContent).not.toContain('Howl');
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds the clock, in words, while the round is being told', () => {
    // The sim really has stopped the clock for the narration. A number frozen
    // with no explanation is what a stalled client looks like.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const clock = root.querySelector('[data-cd-clock]') as HTMLElement;
    const ring = root.querySelector('[data-cd-clockring]') as HTMLElement;
    setInfo(liveInfo({ resolving: true, resolveSecondsLeft: 1.4 }));
    win.render();
    expect(clock.textContent).toBe('Resolving the round');
    expect(ring.dataset.band).toBe('held');

    setInfo(liveInfo({ resolving: false, secondsLeft: 45 }));
    win.render();
    expect(clock.textContent).toContain('45');
    expect(ring.dataset.band).toBe('calm');
  });

  it('ends the match on the table, and holds it there', () => {
    // The complaint this answers: the projection's match goes null the instant
    // a match ends, so the window used to flip to the Join screen mid-thought
    // with no statement of what had happened.
    const { win, root, setInfo } = makeWindow();
    win.render();
    win.showMatchEnd({
      won: true,
      rounds: 9,
      myHp: 34,
      theirHp: 0,
      maxHp: 100,
      damageDealt: 100,
      damageTaken: 66,
      bestHit: { round: 4, cardId: 'briarpack_wolves_moonrun', amount: 14 },
      opponentId: 'gravedigger_ossa',
    });
    const panel = () => root.querySelector('.dt-sum') as HTMLElement | null;
    expect(panel()).not.toBeNull();
    expect(panel()?.textContent).toContain('You win the duel');
    expect(panel()?.textContent).toContain('Ossa');
    expect(panel()?.textContent).toContain('34/100');
    expect(panel()?.textContent).toContain("14 with 6 Wolves' Moonrun, round 4");

    // The snapshot has already gone back to "no match", and the summary
    // survives it.
    setInfo({ queued: false, available: true, decks: noDecks, match: null });
    win.render();
    expect(panel()).not.toBeNull();

    // Leaving the table is what dismisses it.
    (root.querySelector('[data-sumclose]') as HTMLElement).click();
    expect(panel()).toBeNull();
    expect(root.querySelector('[data-join]')).not.toBeNull();
  });

  it('a closed window hands the cues back rather than eating them', () => {
    const { win, root } = makeWindow();
    win.render();
    root.style.display = 'none';
    expect(win.showReveal({ mine: 1, theirs: 2, outcome: 'lose', reshuffled: false })).toBe(false);
  });

  it('shows the printed value beside the effective one only when an effect moved it', () => {
    const { win, root } = makeWindow();
    win.render();
    const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
    win.showReveal({
      mine: 3,
      theirs: 3,
      mineBase: 3,
      theirsBase: 3,
      outcome: 'push',
      reshuffled: false,
    });
    expect(stage.querySelector('.dt-plate-base')).toBeNull();
    win.showReveal({
      mine: 6,
      theirs: 3,
      mineBase: 3,
      theirsBase: 3,
      outcome: 'win',
      reshuffled: true,
    });
    expect(stage.querySelector('.dt-plate-base')).not.toBeNull();
    expect(stage.querySelector('.dt-chip-up')?.textContent).toBe('+3');
    expect(stage.querySelector('.dt-note')).not.toBeNull();
  });

  it('paints the hand as real card faces, with the instance id as the play target', () => {
    const { win, root } = makeWindow();
    win.render();
    const faces = [...root.querySelectorAll('[data-cd-hand] .cf')];
    expect(faces.length).toBe(2);
    expect(faces.map((f) => f.getAttribute('data-play'))).toEqual(['11', '12']);
    expect(root.textContent).toContain('Howl');
  });

  it('lights the one thing each beat is about, on the board that spans both seats', () => {
    // The complaint this answers: the beats played in the right order and a
    // player still could not tell WHICH card a number had just moved on.
    vi.useFakeTimers();
    try {
      const { win, root } = makeWindow();
      win.render();
      const board = root.querySelector('[data-cd-board]') as HTMLElement;
      win.showReveal({
        mine: 6,
        theirs: 2,
        mineBase: 4,
        theirsBase: 2,
        outcome: 'win',
        reshuffled: false,
        steps: [
          {
            side: 'mine',
            cardId: 'eastbrook_company_rangers_stable_shift',
            effect: 'modifyValue',
            target: 'mine',
            amount: 2,
            valueAfter: 6,
          },
        ],
        damage: 4,
        damageTo: 'theirs',
        myHp: 100,
        theirHp: 96,
        maxHp: 100,
      });
      // The deal points at nothing: nothing is known yet.
      expect(board.dataset.spot).toBe('');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.deal);
      expect(board.dataset.spot).toBe('both');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.reveal);
      // The effect moved THIS viewer's value, so it is this viewer's card that
      // lights, whichever side's card did it.
      expect(board.dataset.spot).toBe('mine');
      vi.advanceTimersByTime(DUEL_BEAT_GAP_MS.step + DUEL_BEAT_GAP_MS.clash);
      // The hit points at the bar that drained, which is why the attribute
      // lives on the BOARD: the health bars are not inside the stage.
      expect(board.dataset.spot).toBe('theirs-hp');
      vi.advanceTimersByTime(10000);
      expect(board.dataset.spot).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('locks the hand while the last round is still being told', () => {
    // The playability bug: the round resolved, the hand refilled, and the next
    // card could be clicked while the effects and the health were still
    // landing. The sim refuses such a play outright, so a live hand here
    // offered a click that would be thrown away.
    const { win, root, setInfo } = makeWindow();
    setInfo(liveInfo({ resolving: true, resolveSecondsLeft: 2.4 }));
    win.render();
    const cards = [...root.querySelectorAll('[data-cd-hand] [data-play]')] as HTMLButtonElement[];
    expect(cards.length).toBe(2);
    expect(cards.every((c) => c.disabled)).toBe(true);
    // Back the instant the telling ends, which is when the clock restarts.
    setInfo(liveInfo({ resolving: false, resolveSecondsLeft: 0 }));
    win.render();
    const after = [...root.querySelectorAll('[data-cd-hand] [data-play]')] as HTMLButtonElement[];
    expect(after.every((c) => !c.disabled)).toBe(true);
  });

  it('shines the spotlight at every level, swapping the pop for a fade when calm', () => {
    // The ring is what says WHICH card or bar a beat is about, so it is the one
    // thing that never goes quiet. It is driven through a custom property
    // because the lit selector is specific (0,3,1) and a tier rule trying to
    // override its animation would lose the cascade silently: the sheet would
    // claim a calm state it never produced. The variable sidesteps specificity.
    const lit = CARDS_CSS.slice(CARDS_CSS.indexOf('.dt-board[data-spot="mine"]'));
    const ring = lit.slice(0, lit.indexOf('}'));
    expect(ring).toContain('opacity: 1');
    expect(ring).toContain('animation: var(--dt-spot-anim');
    // It PULSES for the whole beat rather than flashing once and holding: a
    // single pop is over long before a two-second beat is, and two beats in a
    // row on the same card would not restart it at all (same animation-name,
    // so CSS never re-runs it).
    expect(CARDS_CSS).toContain('dt-spot-pulse 1200ms ease-in-out 420ms infinite');
    // Calm swaps the value rather than cancelling the animation: it drops the
    // scale pop and keeps pulsing.
    const calmVar = CARDS_CSS.slice(CARDS_CSS.indexOf('.dt-board[data-motion="calm"] {'));
    expect(calmVar.slice(0, calmVar.indexOf('}'))).toContain('dt-spot-pulse');
    expect(calmVar.slice(0, calmVar.indexOf('}'))).not.toContain('dt-spot-flash');
    // And the pulse moves nothing: opacity keyframes only, at either level.
    const pulse = CARDS_CSS.slice(CARDS_CSS.indexOf('@keyframes dt-spot-pulse'));
    expect(pulse.slice(0, pulse.indexOf('}'))).not.toContain('transform');
    // The tier blocks must NOT name the rings any more: a rule that cancelled
    // the ring would be cancelling the beat's subject.
    const tierBlock = CARDS_CSS.slice(CARDS_CSS.indexOf(':root[data-fx-level="low"] .cf-frame'));
    expect(tierBlock).not.toContain('.dt-slot-card::after');
    expect(tierBlock).not.toContain('.dt-hp::after');
  });

  it('keeps a calm round moving in the cheap channel only: fades, never travel', () => {
    // The level exists so a player on the lowest preset (or one who asked for
    // reduced motion) still SEES one thing happen per beat. What it may spend
    // is a composited opacity; what it may not spend is layout or travel.
    const calm = CARDS_CSS.slice(
      CARDS_CSS.indexOf('.dt-board[data-motion="calm"] .dt-slot-theirs'),
      CARDS_CSS.indexOf('/* The end of the round'),
    );
    expect(calm).toContain('animation: none');
    expect(calm).toContain('transition: opacity');
    // No movement of any kind in the calm block.
    expect(calm).not.toContain('transform');
    expect(calm).not.toMatch(/translate|scale\(/);
  });

  it('never resolves to a collapsed round, whatever the player has asked for', () => {
    // The rule this whole level ladder exists to keep: a round is told beat by
    // beat at EVERY performance level and under every comfort setting. Nothing
    // a player can configure may drop them into a table that shows both cards,
    // the effects, the hit and the winner in one frame. 'none' remains only as
    // the driver's own catch-up path for a stage nobody is watching.
    expect(resolveDuelMotion(document)).toBe('full');
    document.body.classList.add('reduce-motion');
    expect(resolveDuelMotion(document)).toBe('calm');
    document.body.classList.remove('reduce-motion');
    document.documentElement.dataset.fxLevel = 'low';
    expect(resolveDuelMotion(document)).toBe('calm');
    document.documentElement.dataset.fxLevel = 'ultra';
    expect(resolveDuelMotion(document)).toBe('full');
    document.documentElement.removeAttribute('data-fx-level');
  });

  it('fairness: no tier rule touches a number the player acts on', () => {
    // A tier may shed motion; it may never hide or delay a number the player
    // acts on. Pinned against the stylesheet, since that is where a tier rule
    // would be written.
    const actionable =
      /\.dt-clock-num|\.dt-plate-value|\.dt-plate-base|\.dt-chip|\.dt-hp-num|\.dt-token|\.cf-value|\.cf-delta|\.cf-base/;
    const gated = CARDS_CSS.split('\n').filter((line) => {
      const tiered = line.includes('data-fx-level') || line.includes('prefers-reduced-motion');
      return tiered && actionable.test(line);
    });
    expect(gated, `a tier rule targets an actionable number: ${gated.join(' | ')}`).toEqual([]);
    // And what the tiers DO target is motion only.
    const tierBlock = CARDS_CSS.slice(CARDS_CSS.indexOf(':root[data-fx-level="low"] .cf-frame'));
    expect(tierBlock).toContain('transition: none');
    expect(tierBlock).toContain('animation: none');
  });
});
