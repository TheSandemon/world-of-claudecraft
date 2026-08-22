// The card inspector: hover, focus, or press-and-hold a card and the whole
// card is shown at a size you can actually read.
//
// Why it exists. A hand card is 68x96 (84x122 under a thumb): enough for the
// value, the name and the modifier chip, nowhere near enough for the art and
// the rules sentence. The sentence is IN the markup at every size, but the
// hand variant has to hide it, so a player choosing between two cards could
// see what each was WORTH and not what either DID.
//
// What it is not: a graphics feature. The popup is the same at every preset
// and on every device, it fires on focus as well as hover so a keyboard
// reaches it, and it is aria-hidden because the card's own button label
// already carries the same sentence for a screen reader. Nothing here gates
// information behind an animation, a tier, or a pointer type.
//
// The split: card_inspect_view.ts decides WHERE (pure, tested in Node); this
// module owns the element, the listeners and the one layout read per show.

import type { CardCatalog } from '../../sim/minigames/card_duel/match_state';
import { cardFaceHtml } from './card_face_markup';
import type { CardFaceModel } from './card_face_view';
import { placeCardInspect } from './card_inspect_view';

export interface CardInspectDeps {
  /** The face model for one inspectable card, by instance id, or null when the
   *  hovered card is no longer in the view that owns it. */
  resolve(iid: number): CardFaceModel | null;
  catalog: CardCatalog;
  /** How long a touch has to rest on a card before it peeks. */
  holdMs?: number;
}

/** The attribute an inspectable face carries (card_face_markup.ts). */
const INSPECT_SELECTOR = '[data-inspect]';

const DEFAULT_HOLD_MS = 350;

export class CardInspector {
  private root: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private shownFor: number | null = null;
  private holdTimer: number | null = null;
  /** Set when a press-and-hold opened the peek: the click that press ends with
   *  must not also play the card. */
  private swallowClick = false;
  private readonly onPointerOver = (ev: Event) => this.pointerOver(ev as PointerEvent);
  private readonly onPointerOut = (ev: Event) => this.pointerOut(ev as PointerEvent);
  private readonly onPointerDown = (ev: Event) => this.pointerDown(ev as PointerEvent);
  private readonly onPointerUp = () => this.clearHold();
  private readonly onFocusIn = (ev: Event) => this.focusIn(ev as FocusEvent);
  private readonly onFocusOut = () => this.hide();
  private readonly onClickCapture = (ev: Event) => this.clickCapture(ev as MouseEvent);
  private readonly onDismiss = () => this.hide();

  constructor(private readonly deps: CardInspectDeps) {}

  /** Binds one delegated listener set to the surface holding the cards. Safe to
   *  call again after a rebuild: the previous binding is dropped first. */
  attach(root: HTMLElement): void {
    this.detach();
    this.root = root;
    root.addEventListener('pointerover', this.onPointerOver);
    root.addEventListener('pointerout', this.onPointerOut);
    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerUp);
    root.addEventListener('focusin', this.onFocusIn);
    root.addEventListener('focusout', this.onFocusOut);
    // Capture, so a swallowed press-and-hold click never reaches the window's
    // own delegated handler and plays the card the player was only reading.
    root.addEventListener('click', this.onClickCapture, true);
    const view = root.ownerDocument.defaultView;
    // A peek is anchored to a rectangle that scrolling or resizing invalidates,
    // so it is dropped rather than left pointing at nothing.
    view?.addEventListener('scroll', this.onDismiss, true);
    view?.addEventListener('resize', this.onDismiss);
  }

  detach(): void {
    const root = this.root;
    if (!root) return;
    this.hide();
    this.clearHold();
    root.removeEventListener('pointerover', this.onPointerOver);
    root.removeEventListener('pointerout', this.onPointerOut);
    root.removeEventListener('pointerdown', this.onPointerDown);
    root.removeEventListener('pointerup', this.onPointerUp);
    root.removeEventListener('pointercancel', this.onPointerUp);
    root.removeEventListener('focusin', this.onFocusIn);
    root.removeEventListener('focusout', this.onFocusOut);
    root.removeEventListener('click', this.onClickCapture, true);
    const view = root.ownerDocument.defaultView;
    view?.removeEventListener('scroll', this.onDismiss, true);
    view?.removeEventListener('resize', this.onDismiss);
    this.root = null;
  }

  /** Takes the popup off the screen. Public so the window can drop it when it
   *  closes or rebuilds its shell. */
  hide(): void {
    this.shownFor = null;
    const popup = this.popup;
    if (!popup) return;
    popup.style.display = 'none';
    popup.replaceChildren();
  }

  /** The instance id currently being shown, or null. */
  get showing(): number | null {
    return this.shownFor;
  }

  /** Shows the enlarged card for one inspectable element. */
  show(el: HTMLElement): void {
    const iid = Number(el.dataset.inspect);
    if (!Number.isFinite(iid)) return;
    const model = this.deps.resolve(iid);
    if (!model) return;
    const popup = this.ensurePopup(el.ownerDocument);
    popup.innerHTML = cardFaceHtml({ ...model, size: 'inspect' }, { catalog: this.deps.catalog });
    // Painted before it is placed: the placement needs the size the card face
    // actually came out at, which only the document can answer.
    popup.style.display = 'block';
    popup.style.left = '0px';
    popup.style.top = '0px';
    const anchor = el.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    const view = el.ownerDocument.defaultView;
    const spot = placeCardInspect(
      { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height },
      { width: box.width, height: box.height },
      { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
    );
    popup.style.left = `${Math.round(spot.left)}px`;
    popup.style.top = `${Math.round(spot.top)}px`;
    popup.dataset.side = spot.side;
    this.shownFor = iid;
  }

  private ensurePopup(doc: Document): HTMLElement {
    if (this.popup?.isConnected) return this.popup;
    const el = doc.createElement('div');
    el.className = 'cf-inspect';
    // The card's own button label carries the same name, value and sentence, so
    // reading this too would say everything twice.
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    doc.body.append(el);
    this.popup = el;
    return el;
  }

  private target(ev: Event): HTMLElement | null {
    const node = ev.target as HTMLElement | null;
    return (node?.closest?.(INSPECT_SELECTOR) as HTMLElement | null) ?? null;
  }

  private pointerOver(ev: PointerEvent): void {
    // Touch gets the press-and-hold path instead: a tap is how a card is
    // played, so a tap must not also open a popup over the table.
    if (ev.pointerType === 'touch') return;
    const el = this.target(ev);
    if (!el) return;
    if (Number(el.dataset.inspect) === this.shownFor) return;
    this.show(el);
  }

  private pointerOut(ev: PointerEvent): void {
    if (ev.pointerType === 'touch') return;
    const el = this.target(ev);
    if (!el) return;
    const to = ev.relatedTarget as HTMLElement | null;
    // Moving between two children of the same card is not leaving it.
    if (to && el.contains(to)) return;
    this.hide();
  }

  private pointerDown(ev: PointerEvent): void {
    // A hold whose click never arrived (the finger slid off the window, the
    // press was cancelled) must not swallow somebody else's later click.
    this.swallowClick = false;
    const el = this.target(ev);
    if (ev.pointerType !== 'touch') {
      if (!el) this.hide();
      return;
    }
    // A press anywhere else on the table dismisses an open peek.
    if (!el) {
      this.hide();
      return;
    }
    this.clearHold();
    const view = el.ownerDocument.defaultView;
    if (!view) return;
    this.holdTimer = view.setTimeout(() => {
      this.holdTimer = null;
      this.swallowClick = true;
      this.show(el);
    }, this.deps.holdMs ?? DEFAULT_HOLD_MS) as unknown as number;
  }

  private focusIn(ev: FocusEvent): void {
    const el = this.target(ev);
    if (el) this.show(el);
    else this.hide();
  }

  private clickCapture(ev: MouseEvent): void {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    ev.preventDefault();
    ev.stopPropagation();
  }

  private clearHold(): void {
    if (this.holdTimer === null) return;
    this.root?.ownerDocument.defaultView?.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }
}
