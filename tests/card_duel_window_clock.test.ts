// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDuelWindow } from '../src/ui/card_duel_window';
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
        { iid: 11, cardId: 'forest_wolf', value: 3 },
        { iid: 12, cardId: 'pack_alpha', value: 6 },
      ],
      deckCount: 14,
      discardCount: 2,
      myRounds: 0,
      opponentRounds: 0,
      roundsToWin: 2,
      round: 1,
      waitingOnOpponent: false,
      opponentCommitted: false,
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

  it('shows the score as pips, one per round the match needs', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    const pips = (sel: string) => [...root.querySelectorAll(`${sel} .dt-pip`)];
    expect(pips('[data-cd-seats-mine]').length).toBe(2);
    expect(
      pips('[data-cd-seats-mine]').filter((p) => p.classList.contains('dt-pip-on')).length,
    ).toBe(0);
    setInfo(liveInfo({ myRounds: 1 }));
    win.render();
    expect(
      pips('[data-cd-seats-mine]').filter((p) => p.classList.contains('dt-pip-on')).length,
    ).toBe(1);
  });

  it('puts the viewer own pile counts on the viewer own band, and none on the opponent', () => {
    // The projection deliberately never carries the opponent's counts, so a
    // pile shown on their band would be a number the client invented.
    const { win, root } = makeWindow();
    win.render();
    const mine = [...root.querySelectorAll('[data-cd-seats-mine] .dt-pile-count')];
    expect(mine.map((el) => el.textContent)).toEqual(['14', '2']);
    expect(root.querySelectorAll('[data-cd-seats-them] .dt-pile').length).toBe(0);
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

  it('shows opponent cards a reveal effect entitled the viewer to see', () => {
    const { win, root, setInfo } = makeWindow();
    win.render();
    expect(root.querySelector('.dt-revealed')).toBeNull();
    setInfo(liveInfo({ opponentRevealed: [{ iid: 90, cardId: 'grave_rat', value: 2 }] }));
    win.render();
    const revealed = root.querySelector('.dt-revealed') as HTMLElement;
    expect(revealed).not.toBeNull();
    expect(revealed.textContent).toContain('Grave Rat');
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
        mineCardId: 'forest_wolf',
        theirsCardId: 'grave_rat',
        outcome: 'win',
        reshuffled: false,
      }),
    ).toBe(true);
    expect(stage.getAttribute('data-outcome')).toBe('win');
    expect(stage.textContent).toContain('5');
    expect(stage.textContent).toContain('3');
    // The two cards that actually clashed, not two bare numbers.
    expect(stage.textContent).toContain('Forest Wolf');
    expect(stage.textContent).toContain('Grave Rat');

    // A later render must not wipe it: the shell signature has not moved, so
    // the narration of the round that just resolved survives.
    win.render();
    expect(stage.textContent).toContain('Forest Wolf');
  });

  it('a hand refill repaints the hand without touching the stage mid-timeline', () => {
    // The regression this pins: the window used to rebuild its whole subtree on
    // any snapshot change, which wiped a playing round out from under itself.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const stage = root.querySelector('[data-cd-stage]') as HTMLElement;
    win.showReveal({ mine: 5, theirs: 3, outcome: 'win', reshuffled: false });
    setInfo(liveInfo({ hand: [{ iid: 21, cardId: 'grave_rat', value: 2 }], deckCount: 13 }));
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
      { iid: 11, cardId: 'grave_rat', value: 2, textValues: { amount } },
    ];
    setInfo(liveInfo({ hand: scaling(1) }));
    win.render();
    const rules = () =>
      (root.querySelector('[data-cd-hand] .cf-rules') as HTMLElement).textContent ?? '';
    expect(rules()).toContain('-1');
    setInfo(liveInfo({ hand: scaling(3) }));
    win.render();
    expect(rules()).toContain('-3');
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
      vi.advanceTimersByTime(300);
      expect(stage.dataset.beat).toBe('reveal');
      expect(cues).toEqual(['reveal']);
      vi.advanceTimersByTime(3000);
      expect(stage.dataset.beat).toBe('settle');
      // The push cue rides the verdict and the shuffle rides the settle, so a
      // round no longer sounds like one undifferentiated noise.
      expect(cues).toEqual(['reveal', 'push', 'shuffle']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('collapses the whole timeline at the lowest graphics preset, cues and all', () => {
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
        },
      );
      // Settled at once, with no timer left to fire: a tier that sheds motion
      // shows the same result at the same instant, and still owes every cue.
      expect(stage.dataset.beat).toBe('settle');
      expect(cues).toEqual(['reveal', 'shuffle']);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      document.documentElement.removeAttribute('data-fx-level');
      vi.useRealTimers();
    }
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
    expect(root.textContent).toContain('Forest Wolf');
  });

  it('fairness: no tier rule touches a number the player acts on', () => {
    // A tier may shed motion; it may never hide or delay a number the player
    // acts on. Pinned against the stylesheet, since that is where a tier rule
    // would be written.
    const actionable =
      /\.dt-clock-num|\.dt-plate-value|\.dt-plate-base|\.dt-chip|\.dt-pip|\.dt-token|\.cf-value|\.cf-delta|\.cf-base/;
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
