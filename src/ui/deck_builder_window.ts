// The Card Duel deck builder window: the thin consumer of deck_builder_view.ts.
//
// The Book of Deeds and Reliquary windows are the family this copies: cold and
// event-driven off a refresh signature, a DOM-free view model, and no repeating
// driver of its own. It holds one piece of state the view core cannot own, the
// DRAFT the player is editing, which is deliberately client-side until they
// press Save: the server re-validates the shape on arrival, so an unsaved draft
// can never seat an illegal deck.

import { CARD_CATALOG, CARDS } from '../sim/content/cards';
import type { IWorld } from '../world_api';
import { cardFaceHtml } from './cards/card_face_markup';
import { buildCardFaceModel } from './cards/card_face_view';
import {
  buildDeckBuilderView,
  type DeckBuilderViewModel,
  deckBuilderSignature,
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
  private lastSig = '';
  private openerFocus: HTMLElement | null = null;
  /** The deck being edited. Loaded from the active saved deck on open. */
  private draft: string[] = [];
  private draftName = '';
  /** A deck the player asked the server to make active: the draft adopts its
   *  cards once the snapshot confirms the switch, so the builder never shows a
   *  name from one deck beside the cards of another. */
  private pendingLoad: string | null = null;

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
    const sig = deckBuilderSignature(view);
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const el = this.deps.root();
    el.innerHTML = this.html(view);
    this.wire(el);
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
    });
  }

  private html(view: DeckBuilderViewModel): string {
    const count = t('cardDeck.progress', {
      filled: formatNumber(view.filled, { maximumFractionDigits: 0 }),
      required: formatNumber(view.required, { maximumFractionDigits: 0 }),
    });
    const rows = view.rows
      .map((row) => {
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
                buildCardFaceModel(
                  { iid: 0, cardId: option.cardId, value: row.value },
                  option.def,
                  { size: 'cell' },
                ),
                { catalog: CARD_CATALOG },
              ) +
              `</button>`,
          )
          .join('');
        return (
          `<section class="db-row${row.complete ? ' db-row-complete' : ''}">` +
          `<h3 class="db-row-title">${esc(t('cardDeck.rowTitle', { value: formatNumber(row.value, { maximumFractionDigits: 0 }) }))}</h3>` +
          `<div class="db-slots">${slots}</div>` +
          `<div class="db-options">${options}</div>` +
          `</section>`
        );
      })
      .join('');
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
      (view.savedNames.includes(view.draftName)
        ? `<button type="button" class="db-delete" data-delete>${esc(t('cardDeck.delete'))}</button>`
        : '') +
      `</div>` +
      (saved ? `<div class="db-saved-row">${saved}</div>` : '') +
      `<div class="db-rows">${rows}</div>` +
      `</div>`
    );
  }

  private wire(el: HTMLElement): void {
    el.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    const name = el.querySelector('[data-name]') as HTMLInputElement | null;
    name?.addEventListener('input', () => {
      // Held locally: the name only reaches the server on Save.
      this.draftName = name.value;
    });
    el.querySelectorAll('[data-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cardId = (btn as HTMLElement).dataset.card ?? '';
        this.draft = toggleDraftCard(this.draft, cardId, CARD_CATALOG);
        this.render();
      });
    });
    el.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const deckName = (btn as HTMLElement).dataset.load ?? '';
        // Selecting is authoritative (it decides what the next match deals),
        // so it goes to the server; the local draft follows the selection.
        this.deps.world().selectCardDeck(deckName);
        this.draftName = deckName;
        this.pendingLoad = deckName;
        this.lastSig = '';
      });
    });
    el.querySelector('[data-save]')?.addEventListener('click', () => {
      const view = this.model();
      if (!view.legal) return;
      this.deps.world().saveCardDeck(this.draftName, draftCardIds(view));
      this.lastSig = '';
    });
    el.querySelector('[data-delete]')?.addEventListener('click', () => {
      this.deps.world().deleteCardDeck(this.draftName);
      this.lastSig = '';
    });
  }
}
