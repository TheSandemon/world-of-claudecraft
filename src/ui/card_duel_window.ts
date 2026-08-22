// Thin DOM consumer for the Card Duel minigame window (the Card Master NPC).
//
// The consumer half of the pure-core + thin-consumer split. It paints
// #card-duel-window from the structured CardDuelViewModel (card_duel_view.ts)
// and the table model (src/ui/cards/duel_table_view.ts), and wires the
// join/leave/play-card dispatch back through IWorld + injected callbacks. It
// holds no Sim reference and reaches into Hud only through its deps.
//
// TWO CADENCES, deliberately separated, because conflating them is what made
// the old window hard to read:
//
//  1. The SNAPSHOT paints the truth: the hand, the score, the clock, whose
//     commit is outstanding, the counters, the revealed cards. Every one of
//     those is correct the instant the snapshot arrives, at every graphics
//     tier and on every device. Each region carries its own signature, so a
//     counter changing does not rebuild the hand and a hand refill does not
//     rebuild the score.
//  2. The round THEATER narrates what just happened, over that already-true
//     picture, from the cardRoundResolved event. It owns exactly one element
//     (the stage) and writes exactly one attribute per beat. How much of it
//     plays is resolveDuelMotion's call: reduced motion collapses it to the
//     finished picture, the lowest graphics preset keeps every beat and sheds
//     only the animation. Either way the numbers are the same at the same
//     instant.
//
// The stage is the only region the snapshot never touches: a snapshot-driven
// stage would be stomped by the next render, and staging the snapshot itself
// would delay information the fairness rule forbids delaying.

import { CARD_CATALOG, CARD_OPPONENTS } from '../sim/content/cards';
import { CARD_DUEL_ROUND_DEADLINE_S } from '../sim/minigames/card_duel';
import type { IWorld } from '../world_api';
import { buildCardDuelView, type CardDuelViewModel } from './card_duel_view';
import { cardOpponentName } from './card_i18n';
import {
  browserTheaterHost,
  buildCardFaceModel,
  buildDuelClock,
  buildDuelEffects,
  buildDuelStage,
  buildDuelTable,
  buildOpponentHand,
  type CardFaceModel,
  CardInspector,
  type CardRoundAudio,
  type CardRoundRevealInput,
  cardFaceHtml,
  type DuelStageModel,
  DuelTheater,
  duelBeatCaption,
  duelClockHtml,
  duelEffectsHtml,
  duelOpponentHandHtml,
  duelSeatBandHtml,
  duelStageHtml,
  duelStageIdleHtml,
  duelStagePendingHtml,
  duelTokensHtml,
  duelWaitingText,
  flyCard,
  resolveDuelMotion,
} from './cards';
import type { FlightRect } from './cards/card_flight_core';
import { markDialogRoot } from './dialog_root';
import { esc } from './esc';
import { formatNumber, t } from './i18n';
import { svgIcon } from './ui_icons';

export interface CardDuelWindowDeps {
  root(): HTMLElement;
  world(): IWorld;
  /** Opens the deck builder. Injected rather than reached for, so this window
   *  still knows nothing about Hud. */
  openDeckBuilder(): void;
  closeOthers(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
}

/** What the theater narrates for one resolved round. */
export type CardDuelRevealInput = CardRoundRevealInput;

/** The regions the snapshot repaints, each behind its own signature. */
interface CardDuelRegions {
  seatsThem: HTMLElement | null;
  seatsMine: HTMLElement | null;
  stage: HTMLElement | null;
  clock: HTMLElement | null;
  clockRing: HTMLElement | null;
  waiting: HTMLElement | null;
  hand: HTMLElement | null;
  oppoHand: HTMLElement | null;
  effects: HTMLElement | null;
  announce: HTMLElement | null;
}

function emptyRegions(): CardDuelRegions {
  return {
    seatsThem: null,
    seatsMine: null,
    stage: null,
    clock: null,
    clockRing: null,
    waiting: null,
    hand: null,
    oppoHand: null,
    effects: null,
    announce: null,
  };
}

/** A whole number as the player's locale writes it. */
function num(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

export class CardDuelWindow {
  // The SHELL signature is the window's state alone: a live match keeps one
  // shell for its whole length, so the stage element survives every repaint
  // and a running timeline is never rebuilt out from under itself.
  private lastShell = '';
  private lastSeats = '';
  private lastHand = '';
  private lastOppoHand = '';
  private lastEffects = '';
  private lastWaiting = '';
  private lastClock = '';
  private lastRatio = '';
  private openerFocus: HTMLElement | null = null;
  private els: CardDuelRegions = emptyRegions();
  private theater: DuelTheater | null = null;
  /** The last painted view, kept for exactly one job: answering the inspector's
   *  "which card is this" from the same data the face was painted from, rather
   *  than a second copy that could disagree with it. */
  private lastView: CardDuelViewModel | null = null;
  /** The card the player just clicked, measured where it sat, waiting for the
   *  stage slot it flies to. Cleared by the flight or by the next commit. */
  private pendingFlight: { from: FlightRect; html: string } | null = null;
  /** The signature of the between-rounds stage picture (who has committed),
   *  latched only when it is actually painted: while a round is being told the
   *  stage belongs to the theater, and the change waits. */
  private lastPending = '';
  private readonly inspector = new CardInspector({
    resolve: (iid) => this.inspectModel(iid),
    catalog: CARD_CATALOG,
  });

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
    this.lastShell = '';
    this.render();
    (root.querySelector('[data-close]') as HTMLElement | null)?.focus();
  }

  close(): void {
    const el = this.deps.root();
    if (el.style.display !== 'block') {
      this.openerFocus = null;
      return;
    }
    // A timeline still running would keep firing beats at an element nobody is
    // watching, and would be mid-phase if the window reopened.
    this.theater?.stop();
    // A peek is anchored to a card that is about to be hidden.
    this.inspector.hide();
    el.style.display = 'none';
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  // Re-localize after an in-game language switch: clearing the sig forces
  // exactly one rebuild with fresh t(). Self-gated on isOpen so the language
  // fan-out can call it unconditionally.
  relocalize(): void {
    if (!this.isOpen) return;
    this.lastShell = '';
    this.render();
  }

  render(): void {
    if (!this.isOpen) return;
    const world = this.deps.world();
    const view = buildCardDuelView(world.cardMinigameInfo);
    if (view.state !== this.lastShell) {
      this.lastShell = view.state;
      const el = this.deps.root();
      el.innerHTML = this.html(view);
      this.wire(el, world);
      this.cacheRegions(el);
    }
    this.lastView = view;
    if (view.state !== 'inMatch') return;
    this.paintTable(view);
  }

  /**
   * Keeps an open peek pointing at a real card after a region rebuilt under it.
   *
   * A hand repaints whenever a modifier re-prices it, several times a match, so
   * a peek left alone would be describing a node that no longer exists. Same
   * card: repaint it (with the new numbers). Card gone: drop the peek.
   */
  private refreshInspect(): void {
    const iid = this.inspector.showing;
    if (iid === null) return;
    const el = this.deps.root().querySelector(`[data-inspect="${iid}"]`) as HTMLElement | null;
    if (el) this.inspector.show(el);
    else this.inspector.hide();
  }

  /**
   * The face model behind one inspectable card, by instance id.
   *
   * Built from the SAME view the face was painted from, so the enlarged copy
   * can never show a value the small card disagrees with: a card whose
   * modifiers re-priced between renders re-prices in the peek too, and one that
   * has left the hand resolves to null rather than to a stale picture.
   */
  private inspectModel(iid: number): CardFaceModel | null {
    const view = this.lastView;
    if (!view) return null;
    const mine = view.hand.find((card) => card.iid === iid);
    if (mine) {
      return buildCardFaceModel(
        { iid: mine.iid, cardId: mine.cardId, value: mine.value, textValues: mine.textValues },
        CARD_CATALOG.get(mine.cardId),
        { playable: mine.playable, effectiveValue: mine.value + mine.pendingDelta },
      );
    }
    const theirs = view.opponentRevealed.find((card) => card.iid === iid);
    if (!theirs) return null;
    return buildCardFaceModel(theirs, CARD_CATALOG.get(theirs.cardId), { revealed: true });
  }

  /** The snapshot half: every region that carries information a player acts on. */
  private paintTable(view: CardDuelViewModel): void {
    const table = buildDuelTable({
      waitingOnOpponent: view.waitingOnOpponent,
      opponentCommitted: view.opponentCommitted,
      myRounds: view.myRounds,
      opponentRounds: view.opponentRounds,
      myHp: view.myHp,
      opponentHp: view.opponentHp,
      maxHp: view.maxHp,
      myCounters: view.myCounters,
      opponentCounters: view.opponentCounters,
      secondsLeft: view.secondsLeft,
      roundWindow: CARD_DUEL_ROUND_DEADLINE_S,
      opponentRevealed: view.opponentRevealed,
    });

    // A regular carries no player name, so the band resolves its content id.
    const opponentName = view.opponentId ? cardOpponentName(view.opponentId) : view.opponentName;
    const seatsSig = [
      opponentName,
      view.myRounds,
      view.opponentRounds,
      view.myHp,
      view.opponentHp,
      view.maxHp,
      view.deckCount,
      view.discardCount,
      table.mine.commit,
      table.theirs.commit,
      duelTokensHtml(table.mine.counters),
      duelTokensHtml(table.theirs.counters),
    ].join('|');
    if (seatsSig !== this.lastSeats) {
      this.lastSeats = seatsSig;
      if (this.els.seatsThem) {
        // No pile counts for the opponent: the projection deliberately does
        // not carry them, and a zero here would be a claim rather than a gap.
        this.els.seatsThem.innerHTML = duelSeatBandHtml(table.theirs, 'theirs', {
          name: opponentName,
        });
      }
      if (this.els.seatsMine) {
        this.els.seatsMine.innerHTML = duelSeatBandHtml(table.mine, 'mine', {
          name: t('cardDuel.youSeat'),
          piles: { deck: view.deckCount, discard: view.discardCount },
        });
      }
    }

    const waiting = duelWaitingText(table);
    if (waiting !== this.lastWaiting && this.els.waiting) {
      this.lastWaiting = waiting;
      this.els.waiting.textContent = waiting;
    }

    // textValues rides the signature because a SCALING card's rules sentence
    // ("Gets +1 for every two Beasts you have played") re-prices between rounds
    // with its iid, id, value and playability all unchanged. Leaving it out
    // would leave the most actionable text on the face reading last round's
    // number, which is exactly the class of staleness the split is for.
    const handSig = view.hand
      .map((card) => {
        const values = card.textValues ?? {};
        const priced = Object.keys(values)
          .sort()
          .map((key) => `${key}=${values[key]}`)
          .join('+');
        return `${card.iid}:${card.cardId}:${card.value}:${card.pendingDelta}:${card.playable ? 'p' : '-'}:${priced}`;
      })
      .join(',');
    if (handSig !== this.lastHand && this.els.hand) {
      this.lastHand = handSig;
      this.els.hand.innerHTML = view.hand
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
              {
                size: 'hand',
                playable: card.playable,
                // What the card is worth with everything already parked on it,
                // so the face reads the real number with the printed one and a
                // signed chip beside it, rather than a value the round will
                // contradict the moment it resolves.
                effectiveValue: card.value + card.pendingDelta,
              },
            ),
            // Inspectable: a 68x96 face has no room for the rules sentence,
            // and the sentence is what a player is choosing between.
            { playAttribute: 'data-play', catalog: CARD_CATALOG, inspect: true },
          ),
        )
        .join('');
      // Only where a rebuild actually replaced the nodes, never on an unchanged
      // frame: re-showing a peek costs a layout read, and this method runs on
      // the HUD's poll.
      this.refreshInspect();
    }

    const oppoSig = `${view.opponentHandCount}|${view.opponentRevealed.map((c) => c.iid).join(',')}`;
    if (oppoSig !== this.lastOppoHand && this.els.oppoHand) {
      this.lastOppoHand = oppoSig;
      this.els.oppoHand.innerHTML = duelOpponentHandHtml(
        buildOpponentHand(view.opponentHandCount, view.opponentRevealed),
        CARD_CATALOG,
      );
      this.refreshInspect();
    }

    const effects = buildDuelEffects(view.activeEffects);
    const effectsSig = effects
      .map((fx) => `${fx.mine ? 'm' : 't'}:${fx.cardId}:${fx.amount}:${fx.duration}`)
      .join(',');
    if (effectsSig !== this.lastEffects && this.els.effects) {
      this.lastEffects = effectsSig;
      this.els.effects.innerHTML = duelEffectsHtml(effects, CARD_CATALOG);
    }

    this.paintPendingStage(view);
    this.paintClock(view.secondsLeft);
  }

  /**
   * The stage BETWEEN rounds: a face-down card wherever a side has committed.
   *
   * This is the half of the table the theater does not own. It repaints when a
   * commit lands, and it does NOT repaint while a round is being told: the
   * stage belongs to the timeline then, and the settled picture of the round
   * that just happened has to survive until the player moves on. The signature
   * is latched only on a real paint, so a commit that arrives mid-narration is
   * painted the moment the narration is done rather than lost.
   */
  private paintPendingStage(view: CardDuelViewModel): void {
    const el = this.els.stage;
    if (!el) return;
    const mine = view.myPlayedCard !== null;
    const theirs = view.opponentCommitted;
    const sig = `${view.round}|${mine ? 'm' : '-'}|${theirs ? 't' : '-'}`;
    if (sig === this.lastPending) return;
    if (this.theater?.isPlaying) return;
    this.lastPending = sig;
    // Nobody has committed yet and the match is past its first round: the
    // stage is showing the round that just finished, and that picture is the
    // right one to leave up. Wiping it back to two empty places the instant a
    // round resolved is how the old table lost the result mid-glance.
    if (!mine && !theirs && view.round > 1) return;
    el.innerHTML = duelStagePendingHtml({ mine, theirs });
    el.dataset.beat = 'idle';
    el.removeAttribute('data-outcome');
    this.flyCommittedCard(el, mine);
  }

  /**
   * Sends the card the player just clicked to the place it now sits.
   *
   * Only the viewer's own card: the opponent's commit has no rectangle to fly
   * FROM (their hand is a row of backs whose contents this client never sees),
   * and inventing one would be animating a card that was never there.
   */
  private flyCommittedCard(stage: HTMLElement, mineCommitted: boolean): void {
    const flight = this.pendingFlight;
    this.pendingFlight = null;
    if (!flight || !mineCommitted) return;
    const slot = stage.querySelector('[data-cd-slot="mine"]') as HTMLElement | null;
    if (!slot) return;
    flyCard({
      from: flight.from,
      to: slot,
      html: flight.html,
      // The same authority the round theater reads: a player who asked for no
      // motion gets the card already on the table, which it is.
      animate: resolveDuelMotion(stage.ownerDocument) !== 'none',
    });
  }

  /**
   * The round clock. Actionable information, so it paints at every graphics
   * tier and on every device, and it is driven from the SNAPSHOT deadline
   * rather than a client-side timer that could drift out of agreement with the
   * server.
   *
   * Deliberately outside every region signature above: it moves every second,
   * and folding it into one would rebuild that region on every tick. It gets
   * two writes, each elided against its last value: the figures a player
   * reads, and the ratio the ring draws itself from.
   */
  private paintClock(secondsLeft: number | null): void {
    const el = this.els.clock;
    if (!el) return;
    const clock = buildDuelClock(secondsLeft, CARD_DUEL_ROUND_DEADLINE_S);
    const shown = num(clock.seconds);
    const text =
      clock.band === 'out' ? t('cardDuel.clockOut') : t('cardDuel.clock', { seconds: shown });
    if (text !== this.lastClock) {
      this.lastClock = text;
      el.textContent = text;
      el.setAttribute('aria-label', t('cardDuel.clockAria', { seconds: shown }));
    }
    const ring = this.els.clockRing;
    if (!ring) return;
    // One decimal is all the ring can show: rounding here is what keeps a
    // 20 Hz snapshot from writing a new custom property on every single frame.
    const ratio = clock.ratio.toFixed(2);
    if (ratio === this.lastRatio && ring.dataset.band === clock.band) return;
    this.lastRatio = ratio;
    ring.dataset.band = clock.band;
    ring.style.setProperty('--dt-clock-ratio', ratio);
  }

  /**
   * Narrates the round that just resolved, and hands its cues to the beats.
   *
   * Returns whether the stage took the round: a closed window returns false so
   * the caller still plays the audio, which is a real case (a player can be
   * mid-match with the window shut).
   */
  showReveal(input: CardDuelRevealInput, audio?: CardRoundAudio): boolean {
    const el = this.els.stage;
    if (!el || !this.isOpen) return false;
    const stage = buildDuelStage(input);
    el.innerHTML = duelStageHtml(stage, CARD_CATALOG);
    el.dataset.outcome = stage.outcome;
    if (this.els.announce) {
      const outcome = t(
        stage.outcome === 'win'
          ? 'cardDuel.revealWin'
          : stage.outcome === 'lose'
            ? 'cardDuel.revealLose'
            : 'cardDuel.revealPush',
      );
      this.els.announce.textContent = t('cardDuel.announce', {
        mine: num(stage.mine.value),
        theirs: num(stage.theirs.value),
        outcome,
      });
    }
    const theater = this.ensureTheater(el, audio ?? null, stage);
    theater.play(stage, resolveDuelMotion(el.ownerDocument));
    return true;
  }

  /** The theater is rebuilt whenever the shell is, because it is bound to the
   *  stage element and to the audio surface the round arrived with. */
  private ensureTheater(
    el: HTMLElement,
    audio: CardRoundAudio | null,
    stage: DuelStageModel,
  ): DuelTheater {
    this.theater?.stop();
    this.theater = new DuelTheater(
      browserTheaterHost(el, audio, window, (beat) => duelBeatCaption(beat, stage, CARD_CATALOG)),
    );
    return this.theater;
  }

  private cacheRegions(el: HTMLElement): void {
    const pick = (sel: string) => el.querySelector(sel) as HTMLElement | null;
    this.els = {
      seatsThem: pick('[data-cd-seats-them]'),
      seatsMine: pick('[data-cd-seats-mine]'),
      stage: pick('[data-cd-stage]'),
      clock: pick('[data-cd-clock]'),
      clockRing: pick('[data-cd-clockring]'),
      waiting: pick('[data-cd-waiting]'),
      hand: pick('[data-cd-hand]'),
      oppoHand: pick('[data-cd-oppohand]'),
      effects: pick('[data-cd-effects]'),
      announce: pick('[data-cd-announce]'),
    };
    this.theater = null;
    this.lastSeats = '';
    this.lastHand = '';
    this.lastOppoHand = '';
    this.lastEffects = '';
    this.lastWaiting = '';
    this.lastClock = '';
    this.lastRatio = '';
  }

  private html(view: CardDuelViewModel): string {
    let body = '';
    if (view.state === 'unavailable') {
      // No human to pair with, but the regulars are always at the table: the
      // queue gate never takes the whole minigame away from a lone player.
      body =
        `<div class="cd-status">${esc(t('cardDuel.unavailable'))}</div>` +
        this.regularsHtml() +
        this.deckButtonHtml();
    } else if (view.state === 'idle') {
      body =
        `<button type="button" class="cd-action-btn" data-join aria-label="${esc(t('cardDuel.joinAria'))}">${esc(t('cardDuel.join'))}</button>` +
        this.regularsHtml() +
        this.deckButtonHtml();
    } else if (view.state === 'queued') {
      body =
        `<div class="cd-status">${esc(t('cardDuel.queued'))}</div>` +
        `<button type="button" class="cd-action-btn" data-leave aria-label="${esc(t('cardDuel.leaveAria'))}">${esc(t('cardDuel.leave'))}</button>`;
    } else {
      // The table, top to bottom: the opponent's band, the stage where the two
      // cards meet, the clock, the player's band, then their hand. Position is
      // ownership and never moves, so a glance at the same place always
      // answers the same question.
      // Three groups, not a flat stack: the BOARD (both seats and the place
      // their cards meet), the SIDE readouts (clock, whose turn, what is still
      // in play), and your HAND. On a short viewport the board and the side sit
      // in two columns with the hand across the bottom, which is the only way
      // a landscape phone fits a table this tall.
      body =
        '<div class="dt">' +
        '<div class="dt-board">' +
        '<div data-cd-seats-them></div>' +
        '<div data-cd-oppohand></div>' +
        '<div class="dt-stage" data-cd-stage data-beat="idle">' +
        duelStageIdleHtml() +
        '</div>' +
        '<div data-cd-seats-mine></div>' +
        '</div>' +
        '<div class="dt-side">' +
        duelClockHtml() +
        '<div class="dt-waiting" data-cd-waiting></div>' +
        '<div data-cd-effects></div>' +
        '</div>' +
        '<div class="dt-hand-wrap"><div class="dt-hand" data-cd-hand></div></div>' +
        `<button type="button" class="cd-action-btn dt-forfeit" data-forfeit aria-label="${esc(t('cardDuel.forfeitAria'))}">${esc(t('cardDuel.forfeit'))}</button>` +
        '<div class="dt-announce" data-cd-announce role="status" aria-live="polite"></div>' +
        '</div>';
    }
    return (
      `<div class="panel-title"><span id="card-duel-title">${esc(t('cardDuel.title'))}</span>` +
      `<button type="button" class="x-btn" data-close aria-label="${esc(t('cardDuel.close'))}">${svgIcon('close')}</button></div>` +
      `<div class="cd-body">${body}</div>`
    );
  }

  /** The sit-down list. Always offered, online or offline. */
  private regularsHtml(): string {
    const rows = CARD_OPPONENTS.map((opponent) => {
      const name = t(`cards.opponent.${opponent.nameId}.name` as never);
      const title = t(`cards.opponent.${opponent.nameId}.title` as never);
      const tier = t(`cardOpponents.tier.${opponent.difficulty}` as never);
      return (
        `<button type="button" class="cd-regular" data-opponent="${esc(opponent.id)}" aria-label="${esc(t('cardOpponents.sitDown', { name }))}">` +
        `<span class="cd-regular-name">${esc(name)}</span>` +
        `<span class="cd-regular-title">${esc(title)}</span>` +
        `<span class="cd-regular-tier">${esc(tier)}</span>` +
        '</button>'
      );
    }).join('');
    return `<div class="cd-regulars"><h3 class="cd-regulars-title">${esc(t('cardOpponents.heading'))}</h3>${rows}</div>`;
  }

  private deckButtonHtml(): string {
    return `<button type="button" class="cd-action-btn" data-decks aria-label="${esc(t('cardDeck.openAria'))}">${esc(t('cardDeck.open'))}</button>`;
  }

  /**
   * One delegated click handler for the whole window.
   *
   * Delegation rather than per-button listeners because the hand is now
   * rebuilt on its own signature, several times a match: re-wiring every card
   * on every refill is work, and a listener attached to a node the next
   * rebuild replaces is a leak waiting to happen.
   */
  private wire(el: HTMLElement, world: IWorld): void {
    // Rebound with the shell, for the same reason the click handler is: the
    // subtree it delegates over has just been replaced.
    this.inspector.attach(el);
    el.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-close]')) {
        this.close();
        return;
      }
      if (target.closest('[data-join]')) {
        world.joinCardDuelQueue();
        return;
      }
      if (target.closest('[data-leave]')) {
        world.leaveCardDuelQueue();
        return;
      }
      if (target.closest('[data-forfeit]')) {
        world.forfeitCardDuel();
        return;
      }
      if (target.closest('[data-decks]')) {
        this.deps.openDeckBuilder();
        return;
      }
      const regular = target.closest('[data-opponent]') as HTMLElement | null;
      if (regular) {
        world.startCardDuelAgainstOpponent(regular.dataset.opponent ?? '');
        return;
      }
      const card = target.closest('[data-play]') as HTMLElement | null;
      if (card && !(card as HTMLButtonElement).disabled) {
        // Where the card is RIGHT NOW, captured before the command: the commit
        // repaints the hand without it, so by the time the stage shows it there
        // is nothing left to measure. This is the origin of its flight.
        const box = card.getBoundingClientRect();
        this.pendingFlight = {
          from: { left: box.left, top: box.top, width: box.width, height: box.height },
          html: card.outerHTML,
        };
        // The INSTANCE id, not the face value: a hand can hold two different
        // cards of the same value, so a value would be an ambiguous request.
        world.playCardInDuel(Number(card.dataset.play));
      }
    });
  }
}
