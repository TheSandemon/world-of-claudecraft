// The ClaudeStone deck builder window: the thin consumer of deck_builder_view.ts.
//
// The Book of Deeds and Reliquary windows are the family this copies: cold and
// event-driven off a refresh signature, a DOM-free view model, and no repeating
// driver of its own. It holds one piece of state the view core cannot own, the
// DRAFT the player is editing, which is deliberately client-side until they
// press Save: the server re-validates the shape on arrival, so an unsaved draft
// can never seat an illegal deck.

import { audio } from '../game/audio';
import { CARD_CATALOG, CARDS } from '../sim/content/cards';
import type { CardSetId } from '../sim/minigames/card_duel/types';
import type { IWorld } from '../world_api';
import { cardFaceHtml } from './cards/card_face_markup';
import { buildCardFaceModel } from './cards/card_face_view';
import {
  buildDeckBuilderView,
  type DeckBuilderRow,
  type DeckBuilderViewModel,
  deckBuilderRowSignature,
  deckBuilderShellSignature,
  draftCardIds,
  toggleDraftCard,
} from './deck_builder_view';
import { markDialogRoot } from './dialog_root';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import { svgIcon } from './ui_icons';

export interface DeckBuilderWindowDeps {
  root(): HTMLElement;
  world(): IWorld;
  closeOthers(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
}

export class DeckBuilderWindow {
  /** The SHELL signature: everything outside the ten value rows. Only a change
   *  here restructures the builder and costs a full rebuild. */
  private lastSig = '';
  /**
   * One signature per value row, and the element each row lives in.
   *
   * The builder used to rebuild every one of its two hundred card faces on
   * every click, because one whole-view signature moved the moment any card
   * was toggled. Measured, that was about 440 KB of markup and six thousand
   * nodes per press, to change a slot and one button's pressed state.
   *
   * Toggling a card can only ever change ONE row, so the rows carry their own
   * memos and only the row that moved is repainted. This is the same
   * per-region memo the duel window uses for exactly the same reason (see
   * src/ui/cards/CLAUDE.md, "Two cadences"); the builder simply has ten
   * regions of the same shape rather than several different ones.
   */
  private lastRowSigs: string[] = [];
  private rowEls: HTMLElement[] = [];
  private openerFocus: HTMLElement | null = null;
  /** The deck being edited. Loaded from the active saved deck on open. */
  private draft: string[] = [];
  private draftName = '';
  /** A deck the player asked the server to make active: the draft adopts its
   *  cards once the snapshot confirms the switch, so the builder never shows a
   *  name from one deck beside the cards of another. */
  private pendingLoad: string | null = null;
  /** Which design identity the card pools are narrowed to, or null for all of
   *  them. Purely a browsing aid, so it lives here rather than on the server:
   *  it never touches the deck. */
  private setFilter: CardSetId | null = null;

  constructor(private readonly deps: DeckBuilderWindowDeps) {}

  get isOpen(): boolean {
    return this.deps.root().style.display === 'block';
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.deps.closeOthers();
    this.openerFocus = this.deps.captureFocus();
    const decks = this.deps.world().cardMinigameInfo.decks;
    // Open on something real: the active deck if there is one, otherwise an
    // empty draft under a fresh name.
    this.draft = [...decks.activeCards];
    this.draftName = decks.active || t('cardDeck.defaultName');
    const root = this.deps.root();
    markDialogRoot(root, { labelledBy: 'deck-builder-title' });
    root.style.display = 'block';
    this.lastSig = '';
    this.render();
    (root.querySelector('[data-close]') as HTMLElement | null)?.focus();
  }

  close(): void {
    const el = this.deps.root();
    if (el.style.display !== 'block') return;
    el.style.display = 'none';
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  // Re-localize after an in-game language switch: clearing the sig forces
  // exactly one rebuild with fresh t(), and the draft rides through untouched.
  relocalize(): void {
    if (!this.isOpen) return;
    this.lastSig = '';
    this.render();
  }

  render(): void {
    if (!this.isOpen) return;
    const decks = this.deps.world().cardMinigameInfo.decks;
    if (this.pendingLoad !== null && decks.active === this.pendingLoad) {
      this.draft = [...decks.activeCards];
      this.pendingLoad = null;
    }
    const view = this.model();
    const el = this.deps.root();
    const sig = deckBuilderShellSignature(view);
    if (sig !== this.lastSig) {
      // A shell change RESTRUCTURES the builder (the set filter changes what
      // every row offers; a save or a load changes the name, the deck list and
      // the progress at once), so it rebuilds everything and re-resolves the
      // row elements.
      this.lastSig = sig;
      el.innerHTML = this.html(view);
      // Collected from the fresh subtree once, rather than re-queried per row
      // on every later toggle (src/ui/CLAUDE.md, "Resolve element refs ONCE").
      this.rowEls = [...el.querySelectorAll<HTMLElement>('[data-row]')];
      this.lastRowSigs = view.rows.map(deckBuilderRowSignature);
      this.wire(el);
      this.syncBar(el, view);
      return;
    }
    // The three readouts that track the DRAFT rather than the structure. They
    // are why `filled` and the name are out of the shell signature: keeping
    // them there cost a two-hundred-face rebuild to change a count.
    this.syncBar(el, view);
    // Otherwise only the rows can have moved, and a toggle moves exactly one.
    // Repainting the other nine would be the whole cost this split removes.
    if (this.rowEls.length !== view.rows.length) return;
    for (let i = 0; i < view.rows.length; i++) {
      const rowSig = deckBuilderRowSignature(view.rows[i]);
      if (rowSig === this.lastRowSigs[i]) continue;
      this.lastRowSigs[i] = rowSig;
      this.rowEls[i].outerHTML = this.rowHtml(view.rows[i]);
      // outerHTML REPLACES the node, so the ref is stale the instant it is
      // written: re-resolve this one row's element, never the whole list.
      const fresh = el.querySelector<HTMLElement>(`[data-row="${view.rows[i].value}"]`);
      if (fresh) this.rowEls[i] = fresh;
    }
  }

  private model(): DeckBuilderViewModel {
    const decks = this.deps.world().cardMinigameInfo.decks;
    return buildDeckBuilderView({
      draft: this.draft,
      catalog: CARD_CATALOG,
      cards: CARDS,
      savedNames: decks.names,
      activeName: decks.active,
      draftName: this.draftName,
      setFilter: this.setFilter,
    });
  }

  /**
   * The bar's derived readouts, written in place: how many slots are filled,
   * whether the deck can be saved, and whether Delete applies to the name in
   * the field.
   *
   * Three writes, each elided against what is already there, in place of the
   * full rebuild these used to force by riding the repaint signature. Elided
   * because this runs on the HUD's poll, so an unchanged frame must cost
   * nothing (src/ui/CLAUDE.md, the per-frame contract).
   */
  private syncBar(el: HTMLElement, view: DeckBuilderViewModel): void {
    const progress = el.querySelector('.db-progress');
    if (progress) {
      const text = t('cardDeck.progress', {
        filled: formatNumber(view.filled, { maximumFractionDigits: 0 }),
        required: formatNumber(view.required, { maximumFractionDigits: 0 }),
      });
      if (progress.textContent !== text) progress.textContent = text;
    }
    const save = el.querySelector('[data-save]') as HTMLButtonElement | null;
    if (save && save.disabled === view.legal) save.disabled = !view.legal;
    const del = el.querySelector('[data-delete]') as HTMLButtonElement | null;
    const deletable = view.savedNames.includes(view.draftName);
    if (del && del.hidden === deletable) del.hidden = !deletable;
  }

  /**
   * One value row: its title, its two slots, and the pool it offers.
   *
   * Its own method because it is the unit of REPAINT, not just of layout: a
   * toggle rebuilds exactly this much (about twenty faces) instead of the two
   * hundred a whole-view rebuild costs. The full build below composes the same
   * function ten times, so the two paths cannot drift into painting a row two
   * different ways.
   *
   * `data-row` is the value, which is what makes the row findable again after
   * `outerHTML` replaces the node the caller was holding.
   */
  private rowHtml(row: DeckBuilderRow): string {
    const slots = row.slots
      .map((slot) =>
        slot === null
          ? `<div class="db-slot db-slot-empty" aria-label="${esc(t('cardDeck.emptySlot', { value: formatNumber(row.value, { maximumFractionDigits: 0 }) }))}"></div>`
          : `<div class="db-slot">${cardFaceHtml(
              buildCardFaceModel(
                { iid: 0, cardId: slot, value: row.value },
                CARD_CATALOG.get(slot),
                { size: 'hand' },
              ),
              { catalog: CARD_CATALOG },
            )}</div>`,
      )
      .join('');
    const options = row.options
      .map(
        (option) =>
          `<button type="button" class="db-option${option.chosen ? ' db-chosen' : ''}" data-card="${esc(option.cardId)}" aria-pressed="${option.chosen}">` +
          cardFaceHtml(
            buildCardFaceModel({ iid: 0, cardId: option.cardId, value: row.value }, option.def, {
              size: 'cell',
            }),
            { catalog: CARD_CATALOG },
          ) +
          `</button>`,
      )
      .join('');
    return (
      `<section class="db-row${row.complete ? ' db-row-complete' : ''}" data-row="${row.value}">` +
      `<h3 class="db-row-title">${esc(t('cardDeck.rowTitle', { value: formatNumber(row.value, { maximumFractionDigits: 0 }) }))}</h3>` +
      `<div class="db-slots">${slots}</div>` +
      `<div class="db-options">${options}</div>` +
      `</section>`
    );
  }

  private html(view: DeckBuilderViewModel): string {
    const count = t('cardDeck.progress', {
      filled: formatNumber(view.filled, { maximumFractionDigits: 0 }),
      required: formatNumber(view.required, { maximumFractionDigits: 0 }),
    });
    const rows = view.rows.map((row) => this.rowHtml(row)).join('');
    const setChip = (id: CardSetId | null, label: string) => {
      const active = view.setFilter === id;
      return (
        `<button type="button" class="db-set${active ? ' db-set-active' : ''}"` +
        ` data-set="${esc(id ?? '')}" aria-pressed="${active}">${esc(label)}</button>`
      );
    };
    const setChips = [
      setChip(null, t('cardDeck.allSets')),
      ...view.sets.map((id) => setChip(id, t(`cardDeck.set.${id}` as Parameters<typeof t>[0]))),
    ].join('');
    const saved = view.savedNames
      .map(
        (name) =>
          `<button type="button" class="db-saved${name === view.activeName ? ' db-active' : ''}" data-load="${esc(name)}">${esc(name)}</button>`,
      )
      .join('');
    return (
      `<div class="panel-title"><span id="deck-builder-title">${esc(t('cardDeck.title'))}</span>` +
      `<button type="button" class="x-btn" data-close aria-label="${esc(t('cardDeck.close'))}">${svgIcon('close')}</button></div>` +
      `<div class="db-body">` +
      `<p class="db-rule">${esc(t('cardDeck.rule'))}</p>` +
      `<div class="db-bar">` +
      `<label class="db-name"><span>${esc(t('cardDeck.nameLabel'))}</span>` +
      `<input type="text" data-name value="${esc(view.draftName)}" maxlength="24" /></label>` +
      `<span class="db-progress">${esc(count)}</span>` +
      `<button type="button" class="db-save" data-save${view.legal ? '' : ' disabled'}>${esc(t('cardDeck.save'))}</button>` +
      // ALWAYS rendered and hidden when it does not apply, rather than added
      // and removed. Whether it applies depends on the name the player is
      // typing, and adding a node for that would put the name back into the
      // rebuild path this split exists to keep it out of.
      `<button type="button" class="db-delete" data-delete${view.savedNames.includes(view.draftName) ? '' : ' hidden'}>${esc(t('cardDeck.delete'))}</button>` +
      `</div>` +
      (saved ? `<div class="db-saved-row">${saved}</div>` : '') +
      `<div class="db-set-row" role="group" aria-label="${esc(t('cardDeck.setFilterLabel'))}">${setChips}</div>` +
      `<div class="db-rows">${rows}</div>` +
      `</div>`
    );
  }

  /**
   * One delegated click handler for the whole window, plus the name field.
   *
   * Delegation rather than per-control listeners, for the reason the duel
   * window gives: the value rows are now rebuilt on their OWN signatures, so a
   * listener attached to a card button is attached to a node the next toggle
   * replaces. That is both wasted re-wiring and a leak waiting to happen, and
   * with two hundred option buttons it is the larger half of what a rebuild
   * used to cost after the markup itself.
   *
   * Everything is read from the event target at CLICK time, so a handler bound
   * once at the shell rebuild stays correct across every row repaint under it.
   */
  private wire(el: HTMLElement): void {
    el.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      // Every control here answers audibly. Building a deck is twenty separate
      // presses on cards that look identical until the slot above them fills,
      // so a press that makes no sound is the one place a player genuinely
      // cannot tell a refusal (a full value row) from a miss.
      if (target.closest('button')) audio.click();

      if (target.closest('[data-close]')) {
        this.close();
        return;
      }
      const card = target.closest('[data-card]') as HTMLElement | null;
      if (card) {
        this.draft = toggleDraftCard(this.draft, card.dataset.card ?? '', CARD_CATALOG);
        this.render();
        return;
      }
      const set = target.closest('[data-set]') as HTMLElement | null;
      if (set) {
        const id = set.dataset.set ?? '';
        this.setFilter = id === '' ? null : (id as CardSetId);
        this.render();
        return;
      }
      const load = target.closest('[data-load]') as HTMLElement | null;
      if (load) {
        const deckName = load.dataset.load ?? '';
        // Selecting is authoritative (it decides what the next match deals),
        // so it goes to the server; the local draft follows the selection.
        this.deps.world().selectCardDeck(deckName);
        this.draftName = deckName;
        this.pendingLoad = deckName;
        this.lastSig = '';
        return;
      }
      if (target.closest('[data-save]')) {
        const view = this.model();
        if (!view.legal) return;
        this.deps.world().saveCardDeck(this.draftName, draftCardIds(view));
        this.lastSig = '';
        return;
      }
      if (target.closest('[data-delete]')) {
        this.deps.world().deleteCardDeck(this.draftName);
        this.lastSig = '';
      }
    });
    const name = el.querySelector('[data-name]') as HTMLInputElement | null;
    name?.addEventListener('input', () => {
      // Held locally: the name only reaches the server on Save.
      this.draftName = name.value;
    });
  }
}
