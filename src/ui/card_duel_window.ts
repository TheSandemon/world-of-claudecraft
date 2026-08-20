// Thin DOM painter for the Card Duel minigame window (the Card Master NPC).
//
// The consumer half of the pure-core + thin-painter split (ValeCupWindow /
// ArenaWindow shape, scaled down: no bracket tabs, just three states). It
// paints #card-duel-window from the structured CardDuelViewModel
// (card_duel_view.ts) and wires the join/leave/play-card dispatch back
// through IWorld + injected callbacks. It holds no Sim reference and reaches
// into Hud only through its deps.

import { CARD_CATALOG } from '../sim/content/cards';
import type { IWorld } from '../world_api';
import { buildCardDuelView, type CardDuelViewModel } from './card_duel_view';
import { buildCardFaceModel, cardFaceHtml } from './cards';
import { markDialogRoot } from './dialog_root';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import { svgIcon } from './ui_icons';

export interface CardDuelWindowDeps {
  root(): HTMLElement;
  world(): IWorld;
  closeOthers(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
}

/** What the reveal overlay narrates for one resolved round. */
export interface CardDuelRevealInput {
  mine: number;
  theirs: number;
  mineBase?: number;
  theirsBase?: number;
  outcome: 'win' | 'lose' | 'push';
  reshuffled: boolean;
}

export class CardDuelWindow {
  private lastSig = '';
  private openerFocus: HTMLElement | null = null;
  // The clock is deliberately OUTSIDE the repaint signature: it moves every
  // second, and folding it in would rebuild the whole window on every tick.
  // It is written straight to its own element instead, elided against the last
  // string so an unchanged second costs nothing.
  private clockEl: HTMLElement | null = null;
  private lastClock = '';
  private revealEl: HTMLElement | null = null;

  constructor(private readonly deps: CardDuelWindowDeps) {}

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
    const root = this.deps.root();
    markDialogRoot(root, { labelledBy: 'card-duel-title' });
    root.style.display = 'block';
    this.lastSig = '';
    this.render();
    (root.querySelector('[data-close]') as HTMLElement | null)?.focus();
  }

  close(): void {
    const el = this.deps.root();
    if (el.style.display !== 'block') {
      this.openerFocus = null;
      return;
    }
    el.style.display = 'none';
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  // Re-localize after an in-game language switch: clearing the sig forces
  // exactly one rebuild with fresh t(). Self-gated on isOpen so the language
  // fan-out can call it unconditionally.
  relocalize(): void {
    if (!this.isOpen) return;
    this.lastSig = '';
    this.render();
  }

  render(): void {
    if (!this.isOpen) return;
    const world = this.deps.world();
    const info = world.cardMinigameInfo;
    const view = buildCardDuelView(info);
    const sig = JSON.stringify(view);
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      const el = this.deps.root();
      el.innerHTML = this.html(view);
      this.wire(el, world);
      // The subtree was just replaced, so the cached refs are re-resolved at
      // the rebuild rather than at construction.
      this.clockEl = el.querySelector('[data-cd-clock]');
      this.revealEl = el.querySelector('[data-cd-reveal]');
      this.lastClock = '';
    }
    this.paintClock(info.match ? info.match.secondsLeft : null);
  }

  /**
   * The round clock. Actionable information, so it paints at every graphics
   * tier and on every device, and it is driven from the SNAPSHOT deadline
   * rather than a client-side timer that could drift out of agreement with the
   * server.
   */
  private paintClock(secondsLeft: number | null): void {
    const el = this.clockEl;
    if (!el) return;
    const seconds = secondsLeft === null ? 0 : Math.max(0, Math.ceil(secondsLeft));
    const shown = formatNumber(seconds, { maximumFractionDigits: 0 });
    const text =
      secondsLeft === null || seconds <= 0
        ? t('cardDuel.clockOut')
        : t('cardDuel.clock', { seconds: shown });
    if (text === this.lastClock) return;
    this.lastClock = text;
    el.textContent = text;
    el.setAttribute('aria-label', t('cardDuel.clockAria', { seconds: shown }));
    el.classList.toggle('cd-clock-low', seconds > 0 && seconds <= 10);
  }

  /**
   * Narrates the round that just resolved.
   *
   * Driven from the `cardRoundResolved` event, NOT from the snapshot: the
   * window returns early on an unchanged repaint signature, so a staged reveal
   * driven from the snapshot would be stomped by the next render, and staging
   * the snapshot would DELAY information, which the fairness rule forbids. The
   * snapshot keeps painting the truth underneath; this only tells the story
   * over it.
   */
  showReveal(input: CardDuelRevealInput): void {
    const el = this.revealEl;
    if (!el || !this.isOpen) return;
    const outcomeKey =
      input.outcome === 'win'
        ? 'cardDuel.revealWin'
        : input.outcome === 'lose'
          ? 'cardDuel.revealLose'
          : 'cardDuel.revealPush';
    const number = (value: number) => formatNumber(value, { maximumFractionDigits: 0 });
    const side = (
      labelKey: 'cardDuel.revealMine' | 'cardDuel.revealTheirs',
      value: number,
      base?: number,
    ) =>
      '<div class="cd-reveal-side">' +
      `<div class="cd-reveal-label">${esc(t(labelKey))}</div>` +
      `<div class="cd-reveal-value">${esc(number(value))}</div>` +
      (base !== undefined && base !== value
        ? `<div class="cd-reveal-base">${esc(number(base))}</div>`
        : '') +
      '</div>';
    el.innerHTML =
      side('cardDuel.revealMine', input.mine, input.mineBase) +
      side('cardDuel.revealTheirs', input.theirs, input.theirsBase) +
      `<div class="cd-reveal-outcome">${esc(t(outcomeKey))}</div>` +
      (input.reshuffled
        ? `<div class="cd-reveal-note">${esc(t('cardDuel.revealReshuffled'))}</div>`
        : '');
    el.setAttribute('data-outcome', input.outcome);
    // Re-arm the CSS animation with a write only, never a forced layout read:
    // a tier that drops motion simply shows the final state at once.
    el.classList.remove('cd-reveal-play');
    el.classList.add('cd-reveal-play');
  }

  private html(view: CardDuelViewModel): string {
    let body = '';
    if (view.state === 'unavailable') {
      body = `<div class="cd-status">${esc(t('cardDuel.unavailable'))}</div>`;
    } else if (view.state === 'idle') {
      body = `<button type="button" class="cd-action-btn" data-join aria-label="${esc(t('cardDuel.joinAria'))}">${esc(t('cardDuel.join'))}</button>`;
    } else if (view.state === 'queued') {
      body =
        `<div class="cd-status">${esc(t('cardDuel.queued'))}</div>` +
        `<button type="button" class="cd-action-btn" data-leave aria-label="${esc(t('cardDuel.leaveAria'))}">${esc(t('cardDuel.leave'))}</button>`;
    } else {
      const roundText = esc(
        t('cardDuel.round', {
          mine: formatNumber(view.myRounds, { maximumFractionDigits: 0 }),
          theirs: formatNumber(view.opponentRounds, { maximumFractionDigits: 0 }),
        }),
      );
      const oppText = esc(t('cardDuel.vsOpponent', { name: view.opponentName }));
      const turnText = esc(
        t(view.waitingOnOpponent ? 'cardDuel.waitingOnOpponent' : 'cardDuel.yourTurn'),
      );
      const hand = view.hand
        .map((card) =>
          cardFaceHtml(
            buildCardFaceModel(
              {
                iid: card.iid,
                cardId: card.cardId,
                value: card.value,
                textValues: card.textValues,
              },
              CARD_CATALOG.get(card.cardId),
              { size: 'hand', playable: card.playable },
            ),
            { playAttribute: 'data-play', catalog: CARD_CATALOG },
          ),
        )
        .join('');
      const counts = esc(
        t('cardDuel.counts', {
          deck: formatNumber(view.deckCount, { maximumFractionDigits: 0 }),
          discard: formatNumber(view.discardCount, { maximumFractionDigits: 0 }),
        }),
      );
      const forfeitBtn = `<button type="button" class="cd-action-btn" data-forfeit aria-label="${esc(t('cardDuel.forfeitAria'))}">${esc(t('cardDuel.forfeit'))}</button>`;
      body =
        `<div class="cd-opponent">${oppText}</div>` +
        `<div class="cd-status">${roundText}</div>` +
        `<div class="cd-status cd-turn">${turnText}</div>` +
        '<div class="cd-clock" data-cd-clock role="status"></div>' +
        '<div class="cd-reveal" data-cd-reveal aria-live="polite"></div>' +
        `<div class="cd-hand">${hand}</div>` +
        `<div class="cd-counts">${counts}</div>` +
        forfeitBtn;
    }
    return (
      `<div class="panel-title"><span id="card-duel-title">${esc(t('cardDuel.title'))}</span>` +
      `<button type="button" class="x-btn" data-close aria-label="${esc(t('cardDuel.close'))}">${svgIcon('close')}</button></div>` +
      `<div class="cd-body">${body}</div>`
    );
  }

  private wire(el: HTMLElement, world: IWorld): void {
    el.querySelector('[data-close]')?.addEventListener('click', () => this.close());
    el.querySelector('[data-join]')?.addEventListener('click', () => world.joinCardDuelQueue());
    el.querySelector('[data-leave]')?.addEventListener('click', () => world.leaveCardDuelQueue());
    el.querySelector('[data-forfeit]')?.addEventListener('click', () => world.forfeitCardDuel());
    el.querySelectorAll('[data-play]:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        // The INSTANCE id, not the face value: a hand can hold two different
        // cards of the same value, so a value would be an ambiguous request.
        const iid = Number((btn as HTMLElement).dataset.play);
        world.playCardInDuel(iid);
      });
    });
  }
}
