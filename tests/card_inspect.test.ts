// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_CATALOG, cardById } from '../src/sim/content/cards';
import { cardFaceHtml } from '../src/ui/cards/card_face_markup';
import { buildCardFaceModel } from '../src/ui/cards/card_face_view';
import { CardInspector } from '../src/ui/cards/card_inspect';

const WOLF = 'forest_wolf';

function model(iid = 7, over: Parameters<typeof buildCardFaceModel>[2] = {}) {
  const def = cardById(WOLF);
  return buildCardFaceModel({ iid, cardId: WOLF, value: def?.value ?? 3 }, def, {
    size: 'hand',
    playable: true,
    ...over,
  });
}

/** A hand of one inspectable, playable card in a root the inspector watches. */
function rig(resolve: (iid: number) => ReturnType<typeof model> | null = () => model()) {
  const root = document.createElement('div');
  root.innerHTML = cardFaceHtml(model(), {
    catalog: CARD_CATALOG,
    playAttribute: 'data-play',
    inspect: true,
  });
  document.body.append(root);
  const inspector = new CardInspector({ resolve, catalog: CARD_CATALOG, holdMs: 300 });
  inspector.attach(root);
  const card = root.querySelector('[data-inspect]') as HTMLElement;
  const popup = () => document.querySelector('.cf-inspect') as HTMLElement | null;
  return { root, inspector, card, popup };
}

/** happy-dom has no PointerEvent constructor, and a MouseEvent init drops the
 *  unknown `pointerType` key, so the field is defined onto the event. */
function pointer(type: string, init: { pointerType: string; relatedTarget?: EventTarget }) {
  const ev = new window.MouseEvent(type, {
    bubbles: true,
    relatedTarget: (init.relatedTarget ?? null) as EventTarget | null,
  });
  Object.defineProperty(ev, 'pointerType', { value: init.pointerType });
  return ev as unknown as PointerEvent;
}

describe('card inspector', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('shows the whole card, rules sentence and all, on hover', () => {
    // The complaint this answers: a hand card is too small to carry its own
    // rules text, so a player could see what a card was worth and not what it
    // did.
    const { card, popup } = rig();
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    const box = popup() as HTMLElement;
    expect(box.style.display).toBe('block');
    expect(box.querySelector('.cf-size-inspect')).not.toBeNull();
    expect(box.textContent).toContain('Forest Wolf');
    // The rules sentence is the whole point: it is present, and at a size the
    // stylesheet shows rather than hides.
    expect(box.querySelector('.cf-rules')?.textContent).toBeTruthy();
  });

  it('never eats the click that plays the card', () => {
    const { card, popup } = rig();
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    expect((popup() as HTMLElement).style.pointerEvents).toBe('');
    // The popup is a sibling of the window, not a child of the card.
    expect(card.contains(popup())).toBe(false);
  });

  it('hides again when the pointer leaves the card', () => {
    const { card, popup } = rig();
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    card.dispatchEvent(pointer('pointerout', { pointerType: 'mouse' }));
    expect(popup()?.style.display).toBe('none');
  });

  it('opens on keyboard focus too, so the peek is not a mouse feature', () => {
    const { card, popup } = rig();
    card.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    expect(popup()?.style.display).toBe('block');
    card.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
    expect(popup()?.style.display).toBe('none');
  });

  it('peeks on a touch press-and-hold, and swallows the click that press ends with', () => {
    // A tap plays the card, so the peek has to be a different gesture, and the
    // release must not then play the card the player was only reading.
    vi.useFakeTimers();
    try {
      const { root, card, popup } = rig();
      const played: string[] = [];
      root.addEventListener('click', () => played.push('play'));
      card.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
      expect(popup()?.style.display ?? 'none').toBe('none');
      vi.advanceTimersByTime(400);
      expect((popup() as HTMLElement).style.display).toBe('block');
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(played).toEqual([]);
      // Only the one click: an ordinary tap after it still plays.
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(played).toEqual(['play']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a quick tap plays the card and never opens a peek', () => {
    vi.useFakeTimers();
    try {
      const { root, card, popup } = rig();
      const played: string[] = [];
      root.addEventListener('click', () => played.push('play'));
      card.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
      card.dispatchEvent(pointer('pointerup', { pointerType: 'touch' }));
      vi.advanceTimersByTime(400);
      expect(popup()?.style.display ?? 'none').toBe('none');
      card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(played).toEqual(['play']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows nothing for a card the view no longer holds', () => {
    // A card played out of the hand between the hover and the resolve must not
    // paint a stale picture.
    const { card, popup } = rig(() => null);
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    expect(popup()).toBeNull();
  });

  it('drops the peek when the surface it was anchored to stops being watched', () => {
    const { card, popup, inspector } = rig();
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    expect(inspector.showing).toBe(7);
    inspector.detach();
    expect(popup()?.style.display).toBe('none');
    expect(inspector.showing).toBeNull();
    // Detached means detached: a later hover paints nothing.
    card.dispatchEvent(pointer('pointerover', { pointerType: 'mouse' }));
    expect(popup()?.style.display).toBe('none');
  });
});
