// @vitest-environment happy-dom
//
// What one click in the deck builder is allowed to COST.
//
// The builder paints a card face for every card in the catalog: ten value rows
// of two slots plus the whole pool at that value, about two hundred faces,
// measured at roughly 440 KB of markup and six thousand nodes. It used to
// rebuild all of it behind one whole-view signature, so toggling a single card
// repainted two hundred faces to change one slot and one button's pressed
// state, and typing a deck name did the same thing PER KEYSTROKE while
// destroying the field being typed into.
//
// These tests drive the real window over happy-dom and assert on the DOM's own
// identity: a node that was not replaced is the same object. That is the only
// check that actually distinguishes "repainted one row" from "repainted
// everything and happened to produce the same markup".

import { beforeEach, describe, expect, it } from 'vitest';
import { CARDS } from '../src/sim/content/cards';
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

/** Every value row element, in order. */
const rowsOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-row]')];

/** The first option button in a given value row. */
function optionIn(root: HTMLElement, value: number): HTMLElement {
  const row = root.querySelector<HTMLElement>(`[data-row="${value}"]`);
  const btn = row?.querySelector<HTMLElement>('[data-card]');
  if (!btn) throw new Error(`no option button in row ${value}`);
  return btn;
}

describe('deck builder repaint cost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('paints a face for every card in the catalog, which is why the cost matters', () => {
    // Anchors the premise the rest of this file is about. If the builder ever
    // stops showing the whole pool, these tests are measuring something else.
    const { win, root } = makeWindow();
    win.toggle();
    expect(root.querySelectorAll('[data-card]').length).toBe(CARDS.length);
    expect(rowsOf(root)).toHaveLength(10);
  });

  it('repaints ONLY the row a toggled card belongs to', () => {
    const { win, root } = makeWindow();
    win.toggle();
    const before = rowsOf(root);
    const target = optionIn(root, 5);
    target.click();

    const after = rowsOf(root);
    expect(after).toHaveLength(before.length);
    // Row 5 is a new node; every other row is the SAME object it was. Node
    // identity is the point: comparing markup would pass even if all ten had
    // been rebuilt, which is exactly the defect this replaced.
    const replaced = after.filter((el, i) => el !== before[i]);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].dataset.row).toBe('5');
  });

  it('actually took the click: the slot fills and the option reads as pressed', () => {
    // Teeth on the test above. "Repainted nothing" would satisfy a
    // node-identity check too, so the cheap path has to still be correct.
    const { win, root } = makeWindow();
    win.toggle();
    const cardId = optionIn(root, 5).dataset.card;
    optionIn(root, 5).click();

    const row = root.querySelector<HTMLElement>('[data-row="5"]');
    expect(row?.querySelectorAll('.db-slot:not(.db-slot-empty)')).toHaveLength(1);
    const pressed = row?.querySelector(`[data-card="${cardId}"]`);
    expect(pressed?.getAttribute('aria-pressed')).toBe('true');
    expect(pressed?.className).toContain('db-chosen');
  });

  it('keeps the click working after the row it lives in has been repainted', () => {
    // The reason the wiring is delegated: a listener bound to an option button
    // is bound to a node the next toggle in that row replaces.
    const { win, root } = makeWindow();
    win.toggle();
    const first = optionIn(root, 5).dataset.card;
    optionIn(root, 5).click();
    // A DIFFERENT card in the same row, reached through the rebuilt subtree.
    const second = [...root.querySelectorAll<HTMLElement>('[data-row="5"] [data-card]')].find(
      (el) => el.dataset.card !== first,
    );
    expect(second, 'row 5 offers only one card').toBeDefined();
    second?.click();
    const row = root.querySelector<HTMLElement>('[data-row="5"]');
    expect(row?.querySelectorAll('.db-slot:not(.db-slot-empty)')).toHaveLength(2);
  });

  it('updates the progress readout without rebuilding a single row', () => {
    // `filled` used to ride the repaint signature, so a count changing from
    // 0/20 to 1/20 cost two hundred card faces.
    const { win, root } = makeWindow();
    win.toggle();
    const before = rowsOf(root);
    const progressEl = root.querySelector('.db-progress');
    const beforeText = progressEl?.textContent ?? '';

    optionIn(root, 3).click();

    expect(root.querySelector('.db-progress')).toBe(progressEl);
    expect(progressEl?.textContent).not.toBe(beforeText);
    // Nine of the ten rows are untouched by a count change.
    expect(rowsOf(root).filter((el, i) => el !== before[i])).toHaveLength(1);
  });

  it('does not destroy the name field while it is being typed into', () => {
    // The bug the narrowed signature fixes, and it is a bug rather than a
    // cost: the draft name rode the repaint signature, so the window rebuilt
    // itself because the player typed, taking the field and the caret with it.
    const { win, root } = makeWindow();
    win.toggle();
    const input = root.querySelector<HTMLInputElement>('[data-name]');
    expect(input).toBeTruthy();
    const rows = rowsOf(root);

    input?.focus();
    if (input) input.value = 'Wolves';
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    win.render();

    // The same field, still holding what was typed, still focused.
    expect(root.querySelector('[data-name]')).toBe(input);
    expect(input?.value).toBe('Wolves');
    expect(document.activeElement).toBe(input);
    // And it cost no row repaints at all.
    expect(rowsOf(root).filter((el, i) => el !== rows[i])).toHaveLength(0);
  });

  it('still rebuilds everything when the SET FILTER changes, which restructures every row', () => {
    // The other half of the split: a filter change really does change what all
    // ten rows offer, so a full rebuild is the correct answer there.
    const { win, root } = makeWindow();
    win.toggle();
    const before = rowsOf(root);
    const chip = [...root.querySelectorAll<HTMLElement>('[data-set]')].find(
      (el) => el.dataset.set !== '',
    );
    expect(chip).toBeDefined();
    chip?.click();

    const after = rowsOf(root);
    expect(after.filter((el, i) => el !== before[i])).toHaveLength(after.length);
    // And it narrowed the pool rather than merely churning nodes.
    expect(root.querySelectorAll('[data-card]').length).toBeLessThan(CARDS.length);
  });

  it('relocalize repaints every row, not just the shell around them', () => {
    // The per-row memos are over structure and the draft, never over TEXT, so
    // a language switch cannot move them: the value row titles and every card
    // name would keep the old language behind a row signature that still
    // matches. That is safe only because `relocalize` clears the SHELL
    // signature, and the shell branch is the one that rebuilds all ten rows
    // and re-latches their signatures from the fresh markup. This is the test
    // that claim rests on (tests/language_fanout_registry.test.ts names it).
    const { win, root } = makeWindow();
    win.toggle();
    const before = rowsOf(root);
    win.relocalize();
    const after = rowsOf(root);
    expect(after).toHaveLength(before.length);
    expect(after.filter((el, i) => el !== before[i])).toHaveLength(after.length);
  });

  it('costs nothing at all on a poll with no change', () => {
    // The window is polled from Hud.update(), so an unchanged frame must not
    // touch the DOM.
    const { win, root } = makeWindow();
    win.toggle();
    const rows = rowsOf(root);
    const progress = root.querySelector('.db-progress');
    const text = progress?.textContent;

    for (let i = 0; i < 5; i++) win.render();

    expect(rowsOf(root).filter((el, i) => el !== rows[i])).toHaveLength(0);
    expect(root.querySelector('.db-progress')).toBe(progress);
    expect(progress?.textContent).toBe(text);
  });
});
