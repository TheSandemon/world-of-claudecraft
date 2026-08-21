// The standalone slice's thin DOM consumer. Everything it knows about the
// rules it asks slice_core.ts (and therefore the real engine); everything it
// knows about how a duel LOOKS it asks src/ui/cards (and therefore the real
// card face and the real duel table). This file only paints, routes clicks,
// and owns the one thing a world-less hot seat needs that neither of those
// does: pacing.
//
// PACING is why this file has timers at all. In the shipped game a round takes
// as long as two humans take; here both seats can be computer opponents that
// decide in the same microsecond, so a whole match used to resolve between two
// frames and the log was the only evidence anything had happened. A bot now
// takes a beat to think, its lamp shows it thinking, and the resolved round
// plays out on the shared stage exactly as it does in game. The MODEL is never
// delayed: slice_core resolves the instant both seats are in, and the pacing
// only decides when a bot commits and how the finished round is narrated.
//
// Cold and event-driven: it repaints on a state change, never on a frame.

import {
  CARD_BOT_TIERS,
  type CardBotTier,
  type CardInstance,
  type CardSeat,
} from '../sim/minigames/card_duel';
import {
  browserTheaterHost,
  buildCardFaceModel,
  buildDuelSeat,
  buildDuelStage,
  cardFaceHtml,
  type DuelStageLabels,
  DuelTheater,
  duelSeatBandHtml,
  duelStageHtml,
  duelStageIdleHtml,
  resolveDuelMotion,
} from '../ui/cards';
import { t } from '../ui/i18n';
import {
  bothCommitted,
  type CardSliceState,
  commitBot,
  commitCard,
  createSlice,
  resolveSliceRound,
  runToCompletion,
  seatState,
} from './slice_core';

const TIER_LABEL: Readonly<Record<CardBotTier, () => string>> = {
  novice: () => t('cards.controls.novice'),
  steady: () => t('cards.controls.steady'),
  sharp: () => t('cards.controls.sharp'),
  master: () => t('cards.controls.master'),
};

/**
 * How long a computer seat visibly thinks before committing.
 *
 * Long enough that a human sees the lamp breathe and then latch, short enough
 * that a bot-versus-bot match still runs at a watchable pace. It is a
 * PRESENTATION number and lives here rather than in slice_core, which stays a
 * pure model with no notion of time.
 */
const BOT_THINK_MS = 620;

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

/** Seat A is the table's far side, seat B the near side: the same top/bottom
 *  ownership the in-game table uses, with two named seats instead of a "you". */
function seatName(seat: CardSeat): string {
  return seat === 'a' ? t('cards.seat.a') : t('cards.seat.b');
}

export class CardsApp {
  private state: CardSliceState;
  private seed = 1;
  private readonly bands: Record<CardSeat, HTMLDivElement>;
  private readonly hands: Record<CardSeat, HTMLDivElement>;
  private readonly stageEl: HTMLDivElement;
  private readonly logEl: HTMLDivElement;
  private readonly resultEl: HTMLParagraphElement;
  private readonly seedInput: HTMLInputElement;
  private readonly botSelects: Record<CardSeat, HTMLSelectElement>;
  private theater: DuelTheater | null = null;
  private thinking: Record<CardSeat, number | null> = { a: null, b: null };

  constructor(private readonly mount: HTMLElement) {
    this.state = createSlice({ seed: this.seed });
    this.bands = { a: el('div'), b: el('div') };
    this.hands = { a: el('div', 'dt-hand'), b: el('div', 'dt-hand') };
    this.stageEl = el('div', 'dt-stage');
    this.logEl = el('div', 'cards-log');
    this.resultEl = el('p', 'cards-result');
    this.seedInput = el('input', 'cards-seed');
    this.botSelects = { a: el('select', 'cards-bot'), b: el('select', 'cards-bot') };
  }

  start(): void {
    document.title = t('cards.docTitle');
    this.mount.replaceChildren(this.buildHeader(), this.buildControls(), this.buildTable());
    this.stageEl.dataset.beat = 'idle';
    this.stageEl.innerHTML = duelStageIdleHtml(this.stageLabels());
    this.render();
    this.advance();
  }

  /** The stage speaks in seat names here, never in the second person: a hot
   *  seat has two players at it and neither of them is "you". */
  private stageLabels(): DuelStageLabels {
    return {
      mine: seatName('b'),
      theirs: seatName('a'),
      win: t('cards.round.verdictB'),
      lose: t('cards.round.verdictA'),
      push: t('cards.round.verdictPush'),
    };
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
      this.cancelThinking();
      this.theater?.stop();
      this.state = createSlice({
        seed: this.seed,
        bots: { a: this.state.bots.a, b: this.state.bots.b },
      });
      this.stageEl.dataset.beat = 'idle';
      this.stageEl.removeAttribute('data-outcome');
      this.stageEl.innerHTML = duelStageIdleHtml(this.stageLabels());
      this.render();
      this.advance();
    });

    const runAll = el('button', 'cards-button', t('cards.controls.runToEnd'));
    runAll.type = 'button';
    runAll.title = t('cards.controls.runToEndHint');
    runAll.addEventListener('click', () => {
      // The sweep runner deliberately skips the pacing: it exists to resolve a
      // whole match as fast as the engine can, and the finished board plus the
      // last round on the stage is what it has to show for it.
      this.cancelThinking();
      runToCompletion(this.state);
      this.render();
      this.showLastRound();
    });

    bar.append(newMatch, runAll);
    return bar;
  }

  private buildTable(): HTMLElement {
    const table = el('section', 'dt cards-table');
    const handLabel = (seat: CardSeat) =>
      el('p', 'cards-hand-label', t('cards.seat.handLabel', { seat: seatName(seat) }));
    table.append(
      this.bands.a,
      handLabel('a'),
      this.hands.a,
      this.stageEl,
      this.bands.b,
      handLabel('b'),
      this.hands.b,
      this.resultEl,
    );
    const wrap = el('div');
    wrap.append(table, this.logEl);
    return wrap;
  }

  /**
   * One step of the session, paced.
   *
   * A computer seat that has not committed is given a visible beat to think in
   * rather than answering instantly. Once both seats are in, the round is
   * resolved IMMEDIATELY (the model never waits on presentation) and the
   * theater narrates the result over the already-updated board.
   */
  private advance(): void {
    if (this.state.over) return;
    for (const seat of ['a', 'b'] as const) {
      if (!this.state.bots[seat]) continue;
      if (seatState(this.state, seat).playedThisRound) continue;
      if (this.thinking[seat] !== null) continue;
      this.thinking[seat] = window.setTimeout(() => {
        this.thinking[seat] = null;
        if (!commitBot(this.state, seat)) return;
        this.render();
        this.advance();
      }, BOT_THINK_MS);
    }
    if (!bothCommitted(this.state)) return;
    resolveSliceRound(this.state);
    this.render();
    this.showLastRound();
    // The next round's bots start thinking only once this one has been told:
    // stacking a new think timer under a playing stage is what made the old
    // table impossible to follow.
    window.setTimeout(() => this.advance(), BOT_THINK_MS);
  }

  private cancelThinking(): void {
    for (const seat of ['a', 'b'] as const) {
      if (this.thinking[seat] !== null) window.clearTimeout(this.thinking[seat] as number);
      this.thinking[seat] = null;
    }
  }

  /** Puts the most recent resolved round on the stage and plays its beats. */
  private showLastRound(): void {
    const entry = this.state.log[this.state.log.length - 1];
    if (!entry) return;
    const stage = buildDuelStage({
      // Seat B is the near side, so the stage's "mine" is B throughout.
      mine: entry.bValue,
      theirs: entry.aValue,
      mineBase: entry.bCard?.value,
      theirsBase: entry.aCard?.value,
      mineCardId: entry.bCard?.cardId,
      theirsCardId: entry.aCard?.cardId,
      outcome: entry.winner === 'b' ? 'win' : entry.winner === 'a' ? 'lose' : 'push',
      reshuffled: entry.reshuffled,
    });
    this.stageEl.innerHTML = duelStageHtml(stage, this.state.catalog, this.stageLabels());
    this.stageEl.dataset.outcome = stage.outcome;
    this.theater?.stop();
    // No audio surface here: the slice is a world-less page and loads none of
    // the game's sound. The beats are the same beats regardless.
    this.theater = new DuelTheater(browserTheaterHost(this.stageEl, null));
    this.theater.play(stage, resolveDuelMotion());
  }

  private onPlay(seat: CardSeat, card: CardInstance): void {
    if (!commitCard(this.state, seat, card.iid)) return;
    this.render();
    this.advance();
  }

  private renderSeat(seat: CardSeat): void {
    const side = seatState(this.state, seat);
    // No round clock here on purpose: the deadline belongs to the
    // authoritative server, and a world-less table inventing one would be a
    // rule the engine does not have.
    const band = buildDuelSeat({
      committed: side.playedThisRound !== null,
      roundWins: side.roundWins,
      roundsToWin: this.state.roundsToWin,
      counters: side.counters,
    });
    // Both seats show their piles here: a hot seat is not a viewer projection,
    // and watching a deck run short is half of what a playtest is for.
    this.bands[seat].innerHTML = duelSeatBandHtml(band, seat === 'a' ? 'theirs' : 'mine', {
      name: seatName(seat),
      piles: { deck: side.cards.deck.length, discard: side.cards.discard.length },
    });

    const hand = this.hands[seat];
    hand.replaceChildren();
    hand.setAttribute('aria-label', t('cards.seat.handLabel', { seat: seatName(seat) }));
    const playable = !this.state.over && side.playedThisRound === null && !this.state.bots[seat];
    for (const card of side.cards.hand) {
      const holder = el('div');
      holder.innerHTML = cardFaceHtml(
        buildCardFaceModel(card, this.state.catalog.get(card.cardId), {
          size: 'hand',
          playable,
        }),
        { playAttribute: 'data-play', catalog: this.state.catalog },
      );
      const button = holder.firstElementChild as HTMLButtonElement | null;
      if (!button) continue;
      button.addEventListener('click', () => this.onPlay(seat, card));
      hand.append(button);
    }
  }

  private renderLog(): void {
    this.logEl.replaceChildren();
    if (this.state.log.length === 0) {
      this.logEl.append(el('p', 'cards-log-detail', t('cards.round.empty')));
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
