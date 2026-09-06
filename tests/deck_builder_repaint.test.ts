// @vitest-environment happy-dom
//
// What the deck builder SHOWS, and what one click in it is allowed to cost.
//
// Two things this file holds, and they are the same fix seen from two sides.
// The window used to give every value row its own full pool, so it listed all
// two hundred cards in the game on one page: a wall to scroll past in order to
// fill twenty slots, and a full rebuild of every one of those faces on each
// click (measured at roughly 440 KB of markup and six thousand nodes). Typing a
// deck name did the same thing per keystroke, and destroyed the field being
// typed into on the way.
//
// It is a deck COLUMN (ten values, twenty slots, always in view) beside a POOL
// (one value's cards). These tests drive the real window over happy-dom and
// assert on the DOM's own identity: a node that was not replaced is the same
// object. That is the only check that distinguishes "repainted one region"
// from "repainted everything and happened to produce the same markup".

import { beforeEach, describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import { DeckBuilderWindow } from '../src/ui/deck_builder_window';
import type { CardMinigameInfo } from '../src/world_api';

function decks(over: Partial<CardMinigameInfo['decks']> = {}): CardMinigameInfo['decks'] {
  return { names: [], active: '', activeCards: [], ...over };
}

function makeWindow(deckState = decks()) {
  const root = document.createElement('div');
  root.id = 'deck-builder-window';
  document.body.appendChild(root);
  const saved: { name: string; cardIds: readonly string[] }[] = [];
  const world = {
    cardMinigameInfo: { decks: deckState } as CardMinigameInfo,
    saveCardDeck: (name: string, cardIds: string[]) => saved.push({ name, cardIds }),
    selectCardDeck: () => {},
    deleteCardDeck: () => {},
  };
  const win = new DeckBuilderWindow({
    root: () => root,
    world: () => world as never,
    closeOthers: () => {},
    captureFocus: () => null,
    restoreFocus: () => {},
  });
  return { win, root, world, saved };
}

/** A default-deck draft filled up to and including `through`, and no further. */
function firstValuesOf(through: number): string[] {
  return DEFAULT_DECK_LIST.map((entry) => entry.cardId).filter(
    (id) => (CARD_CATALOG.get(id)?.value ?? 0) <= through,
  );
}

/** The value the pool is currently showing. */
const focusOf = (root: HTMLElement) =>
  root.querySelector('[data-value][aria-pressed="true"]')?.getAttribute('data-value') ?? '';

describe('deck builder', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows ONE value at a time, never the whole catalog', () => {
    // The complaint this redesign answers. The pool is a slice; the deck
    // column carries the other nine values as slots, not as card faces.
    const { win, root } = makeWindow();
    win.toggle();
    const shown = root.querySelectorAll('[data-card]').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(CARDS.length / 4);
    expect(root.querySelectorAll('[data-value]')).toHaveLength(10);
    // And every card on offer really is the focused value's.
    for (const btn of root.querySelectorAll<HTMLElement>('[data-card]')) {
      expect(CARD_CATALOG.get(btn.dataset.card ?? '')?.value).toBe(Number(focusOf(root)));
    }
  });

  it('opens on the first value still missing a card, so it lands on the work', () => {
    const { win, root } = makeWindow(decks({ activeCards: firstValuesOf(2) }));
    win.toggle();
    expect(focusOf(root)).toBe('3');
  });

  it('points the pool at another value without rebuilding the window', () => {
    const { win, root } = makeWindow();
    win.toggle();
    const bar = root.querySelector('.db-bar');
    root.querySelector<HTMLElement>('[data-value="7"]')?.click();

    expect(focusOf(root)).toBe('7');
    expect(root.querySelector('.db-pool-title')?.textContent).toContain('7');
    for (const btn of root.querySelectorAll<HTMLElement>('[data-card]')) {
      expect(CARD_CATALOG.get(btn.dataset.card ?? '')?.value).toBe(7);
    }
    // The bar around the panes was not touched: only the regions moved.
    expect(root.querySelector('.db-bar')).toBe(bar);
  });

  it('a toggle repaints the two regions and nothing above them', () => {
    const { win, root } = makeWindow();
    win.toggle();
    const bar = root.querySelector('.db-bar');
    const rule = root.querySelector('.db-rule');

    root.querySelector<HTMLElement>('[data-card]')?.click();

    expect(root.querySelector('.db-bar')).toBe(bar);
    expect(root.querySelector('.db-rule')).toBe(rule);
  });

  it('actually took the click: the pip fills and the option reads as pressed', () => {
    // Teeth on the tests above. "Repainted nothing" would satisfy a node
    // identity check too, so the cheap path has to still be correct.
    const { win, root } = makeWindow();
    win.toggle();
    const btn = root.querySelector<HTMLElement>('[data-card]');
    const cardId = btn?.dataset.card ?? '';
    const value = CARD_CATALOG.get(cardId)?.value;
    btn?.click();

    const row = root.querySelector<HTMLElement>(`[data-value="${value}"]`);
    expect(row?.querySelectorAll('.db-pip-filled')).toHaveLength(1);
    const pressed = root.querySelector(`[data-card="${cardId}"]`);
    expect(pressed?.getAttribute('aria-pressed')).toBe('true');
    expect(pressed?.className).toContain('db-chosen');
  });

  it('keeps the click working after the pool it lives in has been repainted', () => {
    // The reason the wiring is delegated: a listener bound to a card button is
    // bound to a node the next toggle in that pool replaces.
    const { win, root } = makeWindow();
    win.toggle();
    const first = root.querySelector<HTMLElement>('[data-card]')?.dataset.card ?? '';
    root.querySelector<HTMLElement>('[data-card]')?.click();
    const second = [...root.querySelectorAll<HTMLElement>('[data-card]')].find(
      (el) => el.dataset.card !== first,
    );
    expect(second, 'the pool offers only one card').toBeDefined();
    second?.click();

    const value = CARD_CATALOG.get(first)?.value;
    const row = root.querySelector<HTMLElement>(`[data-value="${value}"]`);
    expect(row?.querySelectorAll('.db-pip-filled')).toHaveLength(2);
  });

  it('updates the progress readout in place', () => {
    // `filled` used to ride the repaint signature, so a count changing from
    // 0/20 to 1/20 cost the whole catalog.
    const { win, root } = makeWindow();
    win.toggle();
    const progressEl = root.querySelector('.db-progress');
    const beforeText = progressEl?.textContent ?? '';

    root.querySelector<HTMLElement>('[data-card]')?.click();

    expect(root.querySelector('.db-progress')).toBe(progressEl);
    expect(progressEl?.textContent).not.toBe(beforeText);
  });

  it('does not destroy the name field while it is being typed into', () => {
    // A bug rather than a cost: the draft name rode the repaint signature, so
    // the window rebuilt itself because the player typed, taking the field and
    // the caret with it.
    const { win, root } = makeWindow();
    win.toggle();
    const input = root.querySelector<HTMLInputElement>('[data-name]');
    expect(input).toBeTruthy();

    input?.focus();
    if (input) input.value = 'Wolves';
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    win.render();

    expect(root.querySelector('[data-name]')).toBe(input);
    expect(input?.value).toBe('Wolves');
    expect(document.activeElement).toBe(input);
  });

  it('narrows the pool by identity without touching the deck column', () => {
    // The filter narrows only the pool, which is why it rides the pool's
    // signature and not the shell's.
    const { win, root } = makeWindow();
    win.toggle();
    const deck = root.querySelector('[data-deck]');
    const before = root.querySelectorAll('[data-card]').length;
    const chip = [...root.querySelectorAll<HTMLElement>('[data-set]')].find(
      (el) => el.dataset.set !== '',
    );
    expect(chip).toBeDefined();
    chip?.click();

    expect(root.querySelectorAll('[data-card]').length).toBeLessThan(before);
    expect(root.querySelector('[data-deck]')).toBe(deck);
  });

  it('relocalize repaints both regions, not just the shell around them', () => {
    // The region memos are over structure and the draft, never over TEXT, so a
    // language switch cannot move them: the pool heading and every card name
    // would keep the old language behind signatures that still match. That is
    // safe only because `relocalize` clears the SHELL signature, and the shell
    // branch rebuilds everything and re-latches both region signatures from
    // the fresh markup (tests/language_fanout_registry.test.ts names this).
    const { win, root } = makeWindow();
    win.toggle();
    const deck = root.querySelector('[data-deck]');
    const pool = root.querySelector('[data-pool]');
    win.relocalize();
    expect(root.querySelector('[data-deck]')).not.toBe(deck);
    expect(root.querySelector('[data-pool]')).not.toBe(pool);
  });

  it('costs nothing at all on a poll with no change', () => {
    // The window is polled from Hud.update(), so an unchanged frame must not
    // touch the DOM.
    const { win, root } = makeWindow();
    win.toggle();
    const deck = root.querySelector('[data-deck]');
    const pool = root.querySelector('[data-pool]');
    const progress = root.querySelector('.db-progress');
    const text = progress?.textContent;

    for (let i = 0; i < 5; i++) win.render();

    expect(root.querySelector('[data-deck]')).toBe(deck);
    expect(root.querySelector('[data-pool]')).toBe(pool);
    expect(progress?.textContent).toBe(text);
  });
});
