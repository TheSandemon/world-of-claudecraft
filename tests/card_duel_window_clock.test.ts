// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardDuelWindow } from '../src/ui/card_duel_window';
import type { CardMinigameInfo } from '../src/world_api';

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_CSS = readFileSync(
  path.join(here, '..', 'src', 'styles', 'components.css'),
  'utf8',
);

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

/** No saved decks: the state a character starts in. */
const noDecks = { names: [], active: '', activeCards: [] };

describe('card duel window clock and reveal', () => {
  beforeEach(() => {
    document.body.replaceChildren();
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

  it('keeps ticking the clock while the rest of the window is unchanged', () => {
    // The clock sits OUTSIDE the repaint signature on purpose: folding it in
    // would rebuild the whole window every second, and leaving it INSIDE the
    // early return would freeze the one number the round is racing.
    const { win, root, setInfo } = makeWindow();
    win.render();
    const clock = root.querySelector('[data-cd-clock]') as HTMLElement;
    const handBefore = root.querySelector('.cd-hand')?.innerHTML;
    setInfo(liveInfo({ secondsLeft: 30 }));
    win.render();
    expect(clock.textContent).toContain('30');
    // Same element, so no rebuild happened.
    expect(root.querySelector('[data-cd-clock]')).toBe(clock);
    expect(root.querySelector('.cd-hand')?.innerHTML).toBe(handBefore);
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

  it('the reveal is driven by the round event, not by the snapshot', () => {
    const { win, root } = makeWindow();
    win.render();
    const reveal = root.querySelector('[data-cd-reveal]') as HTMLElement;
    expect(reveal.innerHTML).toBe('');
    win.showReveal({
      mine: 5,
      theirs: 3,
      mineBase: 3,
      theirsBase: 3,
      outcome: 'win',
      reshuffled: false,
    });
    expect(reveal.getAttribute('data-outcome')).toBe('win');
    expect(reveal.textContent).toContain('5');
    expect(reveal.textContent).toContain('3');

    // A later render must not wipe it: the snapshot signature has not moved,
    // so the narration of the round that just resolved survives.
    win.render();
    expect(reveal.textContent).toContain('5');
  });

  it('shows the printed value beside the effective one only when an effect moved it', () => {
    const { win, root } = makeWindow();
    win.render();
    const reveal = root.querySelector('[data-cd-reveal]') as HTMLElement;
    win.showReveal({
      mine: 3,
      theirs: 3,
      mineBase: 3,
      theirsBase: 3,
      outcome: 'push',
      reshuffled: false,
    });
    expect(reveal.querySelector('.cd-reveal-base')).toBeNull();
    win.showReveal({
      mine: 6,
      theirs: 3,
      mineBase: 3,
      theirsBase: 3,
      outcome: 'win',
      reshuffled: true,
    });
    expect(reveal.querySelector('.cd-reveal-base')).not.toBeNull();
    expect(reveal.querySelector('.cd-reveal-note')).not.toBeNull();
  });

  it('paints the hand as real card faces, with the instance id as the play target', () => {
    const { win, root } = makeWindow();
    win.render();
    const faces = [...root.querySelectorAll('.cf')];
    expect(faces.length).toBe(2);
    expect(faces.map((f) => f.getAttribute('data-play'))).toEqual(['11', '12']);
    expect(root.textContent).toContain('Forest Wolf');
  });

  it('fairness: the clock and the value plates are never gated on a tier or an animation', () => {
    // A tier may shed motion; it may never hide or delay a number the player
    // acts on. Pinned against the stylesheet, since that is where a tier rule
    // would be written.
    const gated = COMPONENTS_CSS.split('\n').filter((line) => {
      const tiered = line.includes('data-fx-level') || line.includes('prefers-reduced-motion');
      return tiered && /\.cd-clock|\.cf-value|\.cf-delta|\.cf-base|\.cd-reveal-value/.test(line);
    });
    expect(gated, `a tier rule targets an actionable number: ${gated.join(' | ')}`).toEqual([]);
    // And what the tiers DO target is motion only.
    const tierBlock = COMPONENTS_CSS.slice(
      COMPONENTS_CSS.indexOf(':root[data-fx-level="low"] .cf-frame'),
    );
    expect(tierBlock).toContain('transition: none');
    expect(tierBlock).toContain('animation: none');
  });
});
