// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSweptMark,
  flyOpponentCommit,
  flyOwnCommit,
  flyStageToDiscard,
} from '../src/ui/cards/duel_card_motion';

/**
 * A table with the anchors the flights look for: both stage slots, both seats'
 * discard piles, and the opponent's hand of backs. The real markup
 * (duel_table_markup.ts) mints exactly these hooks.
 */
function makeTable(): { stage: HTMLElement; board: HTMLElement; oppoHand: HTMLElement } {
  document.body.innerHTML =
    '<div class="dt-board" data-cd-board>' +
    '<div class="dt-seat dt-seat-theirs"><div class="dt-piles">' +
    '<span class="dt-pile" data-pile="discard"></span></div></div>' +
    '<div data-cd-oppohand><div class="dt-oppo-row">' +
    '<span class="dt-oppo-back"></span><span class="dt-oppo-back"></span></div></div>' +
    '<div class="dt-stage" data-cd-stage>' +
    '<div class="dt-slot dt-slot-theirs"><div class="dt-slot-card" data-cd-slot="theirs">T</div></div>' +
    '<div class="dt-slot dt-slot-mine"><div class="dt-slot-card" data-cd-slot="mine">M</div></div>' +
    '</div>' +
    '<div class="dt-seat dt-seat-mine"><div class="dt-piles">' +
    '<span class="dt-pile" data-pile="discard"></span></div></div>' +
    '</div>';
  const pick = (sel: string) => document.querySelector(sel) as HTMLElement;
  return {
    stage: pick('[data-cd-stage]'),
    board: pick('[data-cd-board]'),
    oppoHand: pick('[data-cd-oppohand]'),
  };
}

const ORIGINAL_RECT = Element.prototype.getBoundingClientRect;

/** happy-dom lays nothing out, so every rectangle is zero and every flight
 *  would correctly skip itself. A real box per element is what makes the
 *  module's own decisions (not the environment's) the thing under test. */
function layOutEverything(): void {
  Element.prototype.getBoundingClientRect = function fake(this: Element) {
    return {
      left: 10,
      top: 20,
      width: 60,
      height: 90,
      right: 70,
      bottom: 110,
      x: 10,
      y: 20,
    } as unknown as DOMRect;
  };
}

/** Waits out n animation frames: the flight sets its end state on the second
 *  one. */
async function nextFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
}

function flights(): HTMLElement[] {
  return [...document.querySelectorAll('.cf-flight')] as HTMLElement[];
}

const handCard = { from: { left: 4, top: 300, width: 40, height: 60 }, html: '<b>card</b>' };

beforeEach(() => {
  layOutEverything();
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = ORIGINAL_RECT;
  document.body.innerHTML = '';
  document.body.className = '';
  document.documentElement.removeAttribute('data-fx-level');
});

describe('duel card motion', () => {
  it('flies the viewer own card from where it was clicked to its place on the stage', () => {
    const anchors = makeTable();
    flyOwnCommit(anchors, handCard);
    const [node] = flights();
    expect(node).toBeTruthy();
    // Positioned at the ORIGIN, then transformed: the hand cell it came from is
    // already gone by the time the stage shows the card, so the rectangle is
    // the caller's, not one this module could re-measure.
    expect(node.style.left).toBe('4px');
    expect(node.style.top).toBe('300px');
    expect(node.innerHTML).toContain('card');
  });

  it('flies the opponent commit as a face-down back out of their hand', () => {
    const anchors = makeTable();
    flyOpponentCommit(anchors);
    const [node] = flights();
    expect(node).toBeTruthy();
    // A back, never a face: this client is not told which card they played
    // until the round turns, so anything else would be an invention.
    expect(node.innerHTML).toContain('dt-oppo-back');
    expect(node.innerHTML).not.toContain('cf-size');
  });

  it('sends both spent cards to their own discard pile and clears the stage as they go', async () => {
    const anchors = makeTable();
    flyStageToDiscard(anchors);
    // One per seat: the opponent's spent card leaves the table too, which is
    // the half that used to simply cease to exist.
    expect(flights().length).toBe(2);
    // The end state is set two frames after the node mounts (transitioning
    // from a style set in the same frame is the classic silently-instant
    // animation), so the assertion has to wait the same two frames.
    await nextFrames(2);
    // Into the pile rather than onto it: the pile shows a count, not a card.
    expect(flights().every((n) => n.style.opacity === '0')).toBe(true);
    expect(anchors.stage.dataset.swept).toBe('yes');
    clearSweptMark(anchors.stage);
    expect(anchors.stage.hasAttribute('data-swept')).toBe(false);
  });

  it('flies nothing below FULL motion, and leaves the stage showing its cards', () => {
    // A flight is the one part of a round that is pure travel, and the one part
    // a player loses nothing by not seeing: the card is already on the table
    // (or already in the pile) the instant the snapshot says so. So both calm
    // authorities drop them while the beats themselves keep playing.
    for (const quiet of ['reduce-motion', 'low-preset'] as const) {
      const anchors = makeTable();
      if (quiet === 'reduce-motion') document.body.classList.add('reduce-motion');
      else document.documentElement.dataset.fxLevel = 'low';
      flyOwnCommit(anchors, handCard);
      flyOpponentCommit(anchors);
      flyStageToDiscard(anchors);
      expect(flights().length, quiet).toBe(0);
      // And nothing is swept away either: with no card flying to the pile,
      // clearing the stage would just delete the round the player is reading.
      expect(anchors.stage.hasAttribute('data-swept'), quiet).toBe(false);
      document.body.classList.remove('reduce-motion');
      document.documentElement.removeAttribute('data-fx-level');
    }
  });

  it('skips a flight whose anchor is missing rather than throwing', () => {
    // A surface with no opponent hand, no piles, or a stage that has not been
    // painted yet: the card is already where it belongs, so there is nothing
    // to animate and nothing to fail.
    const anchors = makeTable();
    anchors.stage.innerHTML = '';
    flyOwnCommit({ ...anchors, oppoHand: null }, handCard);
    flyOpponentCommit({ ...anchors, oppoHand: null });
    flyStageToDiscard({ ...anchors, board: null });
    expect(flights().length).toBe(0);
    expect(anchors.stage.hasAttribute('data-swept')).toBe(false);
  });
});
