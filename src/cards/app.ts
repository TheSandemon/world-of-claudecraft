// The standalone slice's thin DOM consumer. Everything it knows about the
// rules it asks slice_core.ts (and therefore the real engine); this file only
// paints and routes clicks.
//
// Cold and event-driven: it repaints on a state change, never on a frame.

import {
  CARD_BOT_TIERS,
  type CardBotTier,
  type CardInstance,
  type CardSeat,
} from '../sim/minigames/card_duel';
import { t } from '../ui/i18n';
import {
  bothCommitted,
  type CardSliceState,
  commitCard,
  createSlice,
  resolveSliceRound,
  runToCompletion,
  seatState,
  stepMatch,
} from './slice_core';

const TIER_LABEL: Readonly<Record<CardBotTier, () => string>> = {
  novice: () => t('cards.controls.novice'),
  steady: () => t('cards.controls.steady'),
  sharp: () => t('cards.controls.sharp'),
  master: () => t('cards.controls.master'),
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class CardsApp {
  private state: CardSliceState;
  private seed = 1;
  private readonly seats: Record<CardSeat, HTMLDivElement>;
  private readonly logEl: HTMLDivElement;
  private readonly resultEl: HTMLParagraphElement;
  private readonly seedInput: HTMLInputElement;
  private readonly botSelects: Record<CardSeat, HTMLSelectElement>;

  constructor(private readonly mount: HTMLElement) {
    this.state = createSlice({ seed: this.seed });
    this.seats = { a: el('div', 'cards-seat'), b: el('div', 'cards-seat') };
    this.logEl = el('div', 'cards-log');
    this.resultEl = el('p', 'cards-result');
    this.seedInput = el('input', 'cards-seed');
    this.botSelects = { a: el('select', 'cards-bot'), b: el('select', 'cards-bot') };
  }

  start(): void {
    document.title = t('cards.docTitle');
    this.mount.replaceChildren(this.buildHeader(), this.buildControls(), this.buildTable());
    this.render();
  }

  private buildHeader(): HTMLElement {
    const header = el('header', 'cards-header');
    header.append(el('h1', undefined, t('cards.appTitle')), el('p', undefined, t('cards.intro')));
    return header;
  }

  private buildControls(): HTMLElement {
    const bar = el('section', 'cards-controls');
    bar.setAttribute('aria-label', t('cards.controls.label'));

    const seedLabel = el('label', 'cards-field');
    seedLabel.append(el('span', undefined, t('cards.controls.seed')));
    this.seedInput.type = 'number';
    this.seedInput.value = String(this.seed);
    this.seedInput.title = t('cards.controls.seedHint');
    seedLabel.append(this.seedInput);
    bar.append(seedLabel);

    for (const seat of ['a', 'b'] as const) {
      const label = el('label', 'cards-field');
      label.append(
        el(
          'span',
          undefined,
          seat === 'a' ? t('cards.controls.opponentA') : t('cards.controls.opponentB'),
        ),
      );
      const select = this.botSelects[seat];
      const human = el('option', undefined, t('cards.controls.human'));
      human.value = '';
      select.append(human);
      for (const tier of CARD_BOT_TIERS) {
        const option = el('option', undefined, TIER_LABEL[tier]());
        option.value = tier;
        select.append(option);
      }
      select.addEventListener('change', () => {
        this.state.bots[seat] = (select.value || null) as CardBotTier | null;
        this.advance();
      });
      label.append(select);
      bar.append(label);
    }

    const newMatch = el('button', 'cards-button', t('cards.controls.newMatch'));
    newMatch.type = 'button';
    newMatch.addEventListener('click', () => {
      this.seed = Number(this.seedInput.value) || 1;
      this.state = createSlice({
        seed: this.seed,
        bots: { a: this.state.bots.a, b: this.state.bots.b },
      });
      this.advance();
    });

    const runAll = el('button', 'cards-button', t('cards.controls.runToEnd'));
    runAll.type = 'button';
    runAll.title = t('cards.controls.runToEndHint');
    runAll.addEventListener('click', () => {
      runToCompletion(this.state);
      this.render();
    });

    bar.append(newMatch, runAll);
    return bar;
  }

  private buildTable(): HTMLElement {
    const table = el('section', 'cards-table');
    table.append(this.seats.a, this.seats.b, this.resultEl, this.logEl);
    return table;
  }

  /** Lets any bot seat move, resolves a ready round, then repaints. */
  private advance(): void {
    stepMatch(this.state);
    if (bothCommitted(this.state)) resolveSliceRound(this.state);
    this.render();
  }

  private onPlay(seat: CardSeat, card: CardInstance): void {
    if (!commitCard(this.state, seat, card.iid)) return;
    this.advance();
  }

  private cardLabel(card: CardInstance): string {
    // Every card reads as its value for now: the basics have no name of their
    // own (ten of them share one sentence with the value spliced in), and an
    // authored card's `nameId` is a KEY, never text, so it is resolved through
    // card_i18n once the catalog phase lands rather than spliced in raw here.
    return t('cards.basicName', { value: card.value });
  }

  private renderSeat(seat: CardSeat): void {
    const host = this.seats[seat];
    const side = seatState(this.state, seat);
    host.replaceChildren();
    const heading = el('h2', undefined, seat === 'a' ? t('cards.seat.a') : t('cards.seat.b'));
    const status = el(
      'p',
      'cards-seat-status',
      side.playedThisRound ? t('cards.seat.committed') : t('cards.seat.waiting'),
    );
    const counts = el('p', 'cards-seat-counts');
    counts.append(
      el('span', undefined, t('cards.seat.deckCount', { count: side.cards.deck.length })),
      el('span', undefined, t('cards.seat.discardCount', { count: side.cards.discard.length })),
      el('span', undefined, t('cards.seat.score', { count: side.roundWins })),
    );

    const hand = el('div', 'cards-hand');
    hand.setAttribute(
      'aria-label',
      t('cards.seat.handLabel', { seat: seat === 'a' ? t('cards.seat.a') : t('cards.seat.b') }),
    );
    for (const card of side.cards.hand) {
      const button = el('button', 'cards-card');
      button.type = 'button';
      const name = this.cardLabel(card);
      button.setAttribute('aria-label', t('cards.card.play', { name }));
      button.append(
        el('span', 'cards-card-value', String(card.value)),
        el('span', 'cards-card-name', name),
      );
      button.disabled = this.state.over || side.playedThisRound !== null;
      button.addEventListener('click', () => this.onPlay(seat, card));
      hand.append(button);
    }
    host.append(heading, status, counts, hand);
  }

  private renderLog(): void {
    this.logEl.replaceChildren();
    if (this.state.log.length === 0) {
      this.logEl.append(el('p', undefined, t('cards.round.empty')));
      return;
    }
    for (const entry of this.state.log) {
      const row = el('article', 'cards-log-row');
      row.append(el('h3', undefined, t('cards.round.heading', { round: entry.round })));
      const values = { a: entry.aValue, b: entry.bValue };
      row.append(
        el(
          'p',
          undefined,
          entry.winner === 'a'
            ? t('cards.round.outcomeWin', values)
            : entry.winner === 'b'
              ? t('cards.round.outcomeLose', values)
              : t('cards.round.outcomePush', { a: entry.aValue }),
        ),
      );
      row.append(el('p', 'cards-log-detail', t('cards.round.steps', { count: entry.steps })));
      if (entry.reshuffled) {
        row.append(el('p', 'cards-log-detail', t('cards.round.reshuffled')));
      }
      if (entry.overflow) {
        row.append(el('p', 'cards-log-detail', t('cards.round.overflow')));
      }
      this.logEl.append(row);
    }
  }

  private render(): void {
    this.renderSeat('a');
    this.renderSeat('b');
    this.resultEl.textContent = this.state.over
      ? this.state.winner === 'a'
        ? t('cards.result.winA')
        : t('cards.result.winB')
      : t('cards.result.live');
    this.renderLog();
  }
}
