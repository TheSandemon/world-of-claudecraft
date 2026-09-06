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
import type { CardSetId, CardValue } from '../sim/minigames/card_duel/types';
import type { IWorld } from '../world_api';
import { cardName } from './card_i18n';
import { cardFaceHtml } from './cards/card_face_markup';
import { buildCardFaceModel } from './cards/card_face_view';
import {
  buildDeckBuilderView,
  type DeckBuilderViewModel,
  deckBuilderDeckSignature,
  deckBuilderPoolSignature,
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
  /**
   * Three regions, three memos, and the split is the whole design.
   *
   * The window is a DECK COLUMN (all ten values, twenty slots, always in view)
   * beside a POOL (the cards on offer at the ONE value being worked on). It
   * used to be ten stacked rows each carrying its own full pool, which meant
   * the page listed every card in the game: two hundred faces to scroll past
   * to fill twenty slots, and a full rebuild of all of them on every click.
   *
   * `lastSig` is the shell (the saved-deck list), the only change that costs a
   * rebuild. `lastDeck` is the column, `lastPool` is the pool, and the bar's
   * three readouts are written in place. A toggle repaints the column and one
   * value's pool; choosing another value repaints the same two.
   */
  private lastSig = '';
  private lastDeck = '';
  private lastPool = '';
  private deckEl: HTMLElement | null = null;
  private poolEl: HTMLElement | null = null;
  private openerFocus: HTMLElement | null = null;
  /** The deck being edited. Loaded from the active saved deck on open. */
  private draft: string[] = [];
  private draftName = '';
  /** A deck the player asked the server to make active: the draft adopts its
   *  cards once the snapshot confirms the switch, so the builder never shows a
   *  name from one deck beside the cards of another. */
  private pendingLoad: string | null = null;
  /** Which design identity the pool is narrowed to, or null for all of them.
   *  Purely a browsing aid, so it lives here rather than on the server: it
   *  never touches the deck. */
  private setFilter: CardSetId | null = null;
  /**
   * Which value the pool is showing.
   *
   * Null until the player picks one, which lets the view core answer with the
   * first value still missing a card: opening the builder lands on the work.
   * Once they choose, the choice STICKS, because a focus that re-derived
   * itself would jump to another value the moment they filled the one they
   * were looking at.
   */
  private focusValue: CardValue | null = null;

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
    // Cleared so the core re-derives it: a builder opened fresh should land on
    // the first gap, not on wherever the last session happened to stop.
    this.focusValue = null;
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
      // A shell change RESTRUCTURES the window (a deck saved, deleted or
      // loaded changes the name, the deck list and the whole draft at once),
      // so it rebuilds and re-resolves the two region elements.
      this.lastSig = sig;
      el.innerHTML = this.html(view);
      // Collected from the fresh subtree once, rather than re-queried on every
      // later toggle (src/ui/CLAUDE.md, "Resolve element refs ONCE").
      this.deckEl = el.querySelector('[data-deck]');
      this.poolEl = el.querySelector('[data-pool]');
      this.lastDeck = deckBuilderDeckSignature(view);
      this.lastPool = deckBuilderPoolSignature(view);
      this.wire(el);
      this.syncBar(el, view);
      return;
    }
    // Otherwise only the two regions can have moved. A toggle moves both (a
    // slot fills, and that card reads as taken); choosing a value moves both
    // too (the column's selection, and which cards the pool offers).
    const deck = deckBuilderDeckSignature(view);
    if (this.deckEl && deck !== this.lastDeck) {
      this.lastDeck = deck;
      this.deckEl.innerHTML = this.deckHtml(view);
    }
    const pool = deckBuilderPoolSignature(view);
    if (this.poolEl && pool !== this.lastPool) {
      this.lastPool = pool;
      this.poolEl.innerHTML = this.poolHtml(view);
    }
    // The three readouts that track the DRAFT rather than the structure. They
    // are why `filled` and the name are out of every signature: keeping them
    // there cost a rebuild to change a count.
    this.syncBar(el, view);
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
      // Null lets the core answer with the first unfilled value; once the
      // player has chosen, their choice is the answer.
      focusValue: this.focusValue ?? undefined,
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
   * The DECK column: all ten values at once, twenty slots, no card faces.
   *
   * It is two things deliberately. It is the deck AT A GLANCE, which is what a
   * player actually wants while choosing (how far along am I, what did I put
   * at seven), and it is the NAVIGATOR: each row is the button that points the
   * pool at that value. Making it both is what lets the pool show one value
   * without hiding the deck, which is the trade the old all-cards-on-one-page
   * layout got wrong in the other direction.
   *
   * Slots are plain marks rather than card faces: twenty faces here would put
   * the window back to scrolling, and the face belongs where the choosing
   * happens. A filled slot carries the card's NAME so the column still says
   * what is in the deck.
   */
  private deckHtml(view: DeckBuilderViewModel): string {
    return view.rows
      .map((row) => {
        const label = t('cardDeck.rowTitle', {
          value: formatNumber(row.value, { maximumFractionDigits: 0 }),
        });
        const slots = row.slots
          .map((slot) => {
            if (slot === null) {
              const empty = t('cardDeck.emptySlot', {
                value: formatNumber(row.value, { maximumFractionDigits: 0 }),
              });
              return `<span class="db-pip db-pip-empty" title="${esc(empty)}"></span>`;
            }
            const def = CARD_CATALOG.get(slot);
            return `<span class="db-pip db-pip-filled" title="${esc(def ? cardName(def) : slot)}"></span>`;
          })
          .join('');
        const selected = row.value === view.focusValue;
        // The label is the button's NAME rather than visible text: beside a
        // 16px numeral, "Value 7" is the same word ten times down the column
        // and says nothing the number has not. A reader still hears it.
        return (
          `<button type="button" class="db-value${row.complete ? ' db-value-done' : ''}"` +
          ` data-value="${row.value}" aria-pressed="${selected}" aria-label="${esc(label)}">` +
          `<span class="db-value-n">${esc(formatNumber(row.value, { maximumFractionDigits: 0 }))}</span>` +
          `<span class="db-pips">${slots}</span>` +
          `</button>`
        );
      })
      .join('');
  }

  /**
   * The POOL: the cards on offer at the focused value, and the identity chips
   * that narrow them.
   *
   * ONE value's worth. The window used to render every value's pool at once,
   * which is how it came to list all two hundred cards in the game on a single
   * page: a wall to scroll rather than a choice to make. A player fills one
   * value at a time, so the window shows one value at a time.
   *
   * The chips live here rather than in the shell because the filter narrows
   * only this pane, which is also why a filter change repaints only this pane.
   */
  private poolHtml(view: DeckBuilderViewModel): string {
    const chip = (id: CardSetId | null, label: string) => {
      const active = view.setFilter === id;
      return (
        `<button type="button" class="db-set${active ? ' db-set-active' : ''}"` +
        ` data-set="${esc(id ?? '')}" aria-pressed="${active}">${esc(label)}</button>`
      );
    };
    const chips = [
      chip(null, t('cardDeck.allSets')),
      ...view.sets.map((id) => chip(id, t(`cardDeck.set.${id}` as Parameters<typeof t>[0]))),
    ].join('');
    const cards = view.pool
      .map(
        (option) =>
          `<button type="button" class="db-option${option.chosen ? ' db-chosen' : ''}" data-card="${esc(option.cardId)}" aria-pressed="${option.chosen}">` +
          cardFaceHtml(
            buildCardFaceModel(
              { iid: 0, cardId: option.cardId, value: view.focusValue },
              option.def,
              { size: 'cell' },
            ),
            { catalog: CARD_CATALOG },
          ) +
          `</button>`,
      )
      .join('');
    const heading = t('cardDeck.rowTitle', {
      value: formatNumber(view.focusValue, { maximumFractionDigits: 0 }),
    });
    return (
      `<h3 class="db-pool-title">${esc(heading)}</h3>` +
      `<div class="db-set-row" role="group" aria-label="${esc(t('cardDeck.setFilterLabel'))}">${chips}</div>` +
      `<div class="db-options">${cards}</div>`
    );
  }

  private html(view: DeckBuilderViewModel): string {
    const count = t('cardDeck.progress', {
      filled: formatNumber(view.filled, { maximumFractionDigits: 0 }),
      required: formatNumber(view.required, { maximumFractionDigits: 0 }),
    });
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
      `<div class="db-bar">` +
      `<label class="db-name"><span>${esc(t('cardDeck.nameLabel'))}</span>` +
      `<input type="text" data-name value="${esc(view.draftName)}" maxlength="24" /></label>` +
      `<span class="db-progress">${esc(count)}</span>` +
      `<button type="button" class="db-save" data-save${view.legal ? '' : ' disabled'}>${esc(t('cardDeck.save'))}</button>` +
      // ALWAYS rendered and hidden when it does not apply, rather than added
      // and removed. Whether it applies depends on the name the player is
      // typing, and adding a node for that would put the name back into the
      // rebuild path the signatures exist to keep it out of.
      `<button type="button" class="db-delete" data-delete${view.savedNames.includes(view.draftName) ? '' : ' hidden'}>${esc(t('cardDeck.delete'))}</button>` +
      `</div>` +
      (saved ? `<div class="db-saved-row">${saved}</div>` : '') +
      `<p class="db-rule">${esc(t('cardDeck.rule'))}</p>` +
      // The two panes: the deck you are building, and the cards you may put in
      // the one value you are working on.
      `<div class="db-panes">` +
      `<div class="db-deck" data-deck>${this.deckHtml(view)}</div>` +
      `<div class="db-pool" data-pool>${this.poolHtml(view)}</div>` +
      `</div>` +
      `</div>`
    );
  }

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
      // The deck column doubles as the value navigator: a row points the pool
      // at its value. Checked BEFORE the card arm, because a value button
      // contains no card and a card button contains no value, but reading in a
      // fixed order keeps that from being a thing to remember.
      const value = target.closest('[data-value]') as HTMLElement | null;
      if (value) {
        this.focusValue = Number(value.dataset.value) as CardValue;
        this.render();
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
