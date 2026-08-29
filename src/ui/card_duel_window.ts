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
//     picture, from the cardRoundResolved event. It writes two attributes per
//     beat: the phase on the stage, and what the beat is POINTING AT on the
//     board (the health bars a damage beat means are outside the stage). Both
//     elements survive every region repaint. How much of it
//     plays is resolveDuelMotion's call, and it never collapses the round: the
//     lowest preset and reduced motion both keep every beat at its own moment
//     and shed only the MOVEMENT. Either way the numbers are the same at the
//     same instant.
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
  buildDuelOutro,
  buildDuelStage,
  buildDuelSummary,
  buildDuelTable,
  buildOpponentHand,
  type CardFaceModel,
  CardInspector,
  type CardRoundAudio,
  type CardRoundRevealInput,
  cardFaceHtml,
  type DuelMatchOutcome,
  type DuelMotion,
  type DuelStageModel,
  type DuelSummaryInput,
  type DuelSummaryModel,
  DuelTheater,
  duelBeatCaption,
  duelClockHtml,
  duelEffectsHtml,
  duelOpponentHandHtml,
  duelOutroCaption,
  duelOutroSpanMs,
  duelSeatBandHtml,
  duelStageHtml,
  duelStageIdleHtml,
  duelStagePendingHtml,
  duelSummaryHtml,
  duelTokensHtml,
  duelWaitingText,
  isDuelOutroBeat,
  resolveDuelMotion,
} from './cards';
import type { FlightRect } from './cards/card_flight_core';
import {
  clearSweptMark,
  type DuelCommitted,
  type DuelMotionAnchors,
  flyOpponentCommit,
  flyOwnCommit,
  flyStageToDiscard,
} from './cards/duel_card_motion';
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
  /** The board: both seat bands plus the stage. The spotlight attribute and
   *  the discard flights both need an element that spans the two. */
  board: HTMLElement | null;
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
    board: null,
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
  /** The finished match on the table, until the player dismisses it. Held here
   *  rather than in the projection because the projection's match is already
   *  gone by then: a finished match is not a state the server keeps. */
  private summary: DuelSummaryModel | null = null;
  /**
   * A match ending waiting for the final round to finish being told.
   *
   * The sim emits the match-end event in the SAME tick as the last
   * `cardRoundResolved`, so acting on it directly tore down the round that
   * decided the match: the cards were still face-down when the scoreboard
   * replaced them. Held here instead, and released by the theater's completion
   * hook once the round has spoken and the outro has played.
   */
  private pendingEnd: DuelSummaryModel | null = null;
  /** Which ending the outro is currently narrating, for its caption line. Null
   *  whenever a round rather than a match end owns the stage. */
  private endingOutcome: DuelMatchOutcome | null = null;
  /** Whether the projection has reported "no match" since the last one ended.
   *  What tells a NEW match apart from the tail of the one being summarized. */
  private sawNoMatch = false;
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
    // A NEW match clears whatever summary is up: the table is the answer to
    // "what now" once there is a table again. New, not merely live: the
    // match-end event can land a beat before the snapshot drops the match it
    // describes, and clearing on that would delete the summary in the same
    // frame it was written.
    if (view.state === 'inMatch' && this.sawNoMatch) {
      this.summary = null;
      this.sawNoMatch = false;
    } else if (view.state !== 'inMatch') {
      this.sawNoMatch = true;
    }
    // The summary is part of the shell's identity, so the window rebuilds into
    // it and back out of it exactly once each.
    const shell = this.summary ? `summary:${this.summary.outcome}` : view.state;
    if (shell !== this.lastShell) {
      this.lastShell = shell;
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
        { playable: mine.playable, effectiveValue: mine.value + mine.projectedDelta },
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
          // A discard PLACE with no figure: their count is not on the wire,
          // and their spent cards still need somewhere to go.
          discardPlace: true,
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
        return `${card.iid}:${card.cardId}:${card.value}:${card.projectedDelta}:${card.playable ? 'p' : '-'}:${priced}`;
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
                // What the card would RESOLVE at: everything already parked on
                // it plus its own pre-comparison effects, conditions and
                // clamps. The same projection the bots pick against, so the
                // face reads the real number with the printed one and a signed
                // chip beside it, rather than a value the round will contradict
                // the moment it resolves.
                effectiveValue: card.value + card.projectedDelta,
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
    this.paintClock(view.secondsLeft, view.resolving);
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
    // Which side is NEWLY down, read before the signature is latched: a
    // repaint for the other seat must not re-fly a card that has been on the
    // table for seconds. A different round is all new, whatever the flags say.
    const [lastRound, lastMine, lastTheirs] = this.lastPending.split('|');
    const sameRound = lastRound === String(view.round);
    const landed = {
      mine: mine && !(sameRound && lastMine === 'm'),
      theirs: theirs && !(sameRound && lastTheirs === 't'),
    };
    this.lastPending = sig;
    // Nobody has committed yet and the match is past its first round: the
    // stage is showing the round that just finished, and that picture is the
    // right one to leave up. Wiping it back to two empty places the instant a
    // round resolved is how the old table lost the result mid-glance.
    if (!mine && !theirs && view.round > 1) return;
    el.innerHTML = duelStagePendingHtml({ mine, theirs });
    el.dataset.beat = 'idle';
    el.removeAttribute('data-outcome');
    // The last round's cards were swept into the piles; this stage is the next
    // round's, and its cards are meant to be seen.
    clearSweptMark(el);
    this.els.board?.removeAttribute('data-spot');
    this.flyCommittedCards(el, landed);
  }

  /**
   * Sends each newly committed card to the place it now sits.
   *
   * BOTH seats, from different origins, because the two commits are known
   * differently. The viewer's own card flies from the hand cell it was clicked
   * in, measured before the repaint that removed it. The opponent's flies as a
   * face-down BACK from their hand row, which is honestly all this client
   * knows: their card is not revealed until the round turns.
   *
   * Only on the paint where a side NEWLY committed, so a repaint for the other
   * seat does not re-fly a card that has been on the table for seconds.
   */
  private flyCommittedCards(stage: HTMLElement, committed: DuelCommitted): void {
    const flight = this.pendingFlight;
    this.pendingFlight = null;
    const anchors = this.motionAnchors(stage);
    if (flight && committed.mine) flyOwnCommit(anchors, flight);
    if (committed.theirs) flyOpponentCommit(anchors);
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
  private paintClock(secondsLeft: number | null, resolving = false): void {
    const el = this.els.clock;
    if (!el) return;
    const clock = buildDuelClock(secondsLeft, CARD_DUEL_ROUND_DEADLINE_S);
    const shown = num(clock.seconds);
    // While the last round is being told, the sim is genuinely holding the
    // clock: it says so rather than showing a number frozen for no visible
    // reason, which is what a stalled client looks like.
    const text = resolving
      ? t('cardDuel.clockHeld')
      : clock.band === 'out'
        ? t('cardDuel.clockOut')
        : t('cardDuel.clock', { seconds: shown });
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
    const band = resolving ? 'held' : clock.band;
    if (ratio === this.lastRatio && ring.dataset.band === band) return;
    this.lastRatio = ratio;
    ring.dataset.band = band;
    ring.style.setProperty('--dt-clock-ratio', ratio);
  }

  /**
   * Ends the match ON the table.
   *
   * The projection's match goes null the instant a match ends, so without this
   * the window's shell flips to the Join screen and the board a player was
   * reading is replaced mid-thought. The summary holds the window until they
   * choose to leave it or sit down again.
   */
  showMatchEnd(input: DuelSummaryInput): void {
    const summary = buildDuelSummary(input);
    this.lastPending = '';
    // Nobody is watching, or nothing is being told: the finished picture is the
    // only correct one, and a closed window has no beats to play anyway.
    if (!this.isOpen || !this.theater?.isPlaying) {
      this.revealSummary(summary);
      return;
    }
    // The round that decided the match is still speaking. Queue behind it: the
    // theater calls back when its last beat opens, and the outro plays over the
    // finished stage before the summary takes the window.
    this.pendingEnd = summary;
  }

  /**
   * The ending, once the last round has been told: the outro beats, then the
   * summary.
   *
   * The outro runs on the SAME theater, host and attribute the round used
   * (duel_outro_core.ts), so the ending is more of the grammar a player has
   * been reading all match rather than a second animation system. Motion is
   * resolved the same way too, which means the lowest preset and reduced motion
   * get every beat with the movement dropped, exactly as a round does.
   */
  private playOutro(summary: DuelSummaryModel): void {
    const el = this.els.stage;
    const theater = this.theater;
    if (!el || !theater || !this.isOpen) {
      this.revealSummary(summary);
      return;
    }
    const outcome: DuelMatchOutcome =
      summary.outcome === 'win' ? 'win' : summary.outcome === 'loss' ? 'lose' : 'draw';
    this.endingOutcome = outcome;
    const beats = buildDuelOutro(outcome, resolveDuelMotion(el.ownerDocument));
    // Published for the stylesheet: the table dims and the winner's side lifts
    // on this one hook, the same way `data-motion` publishes the motion answer.
    if (this.els.board) this.els.board.dataset.ending = outcome;
    // Handed over at the END of the span, so the curtain beat gets the hold it
    // was written for rather than being replaced on the frame it opens.
    theater.playBeats(beats, () => this.revealSummary(summary), duelOutroSpanMs(beats));
  }

  /** The summary takes the window. The one place `summary` is set, so the
   *  queued and the immediate paths cannot diverge. */
  private revealSummary(summary: DuelSummaryModel): void {
    this.pendingEnd = null;
    this.endingOutcome = null;
    // The board is about to be replaced by the summary, but clear the hook
    // anyway: a rematch that reuses this element must not open under the last
    // match's ending colours.
    if (this.els.board) this.els.board.removeAttribute('data-ending');
    this.summary = summary;
    this.theater?.stop();
    if (this.isOpen) this.render();
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
    // The mark the last round's sweep left: these cards have not been
    // discarded yet, and a stage that opened already swept would narrate a
    // whole round with nothing on it.
    clearSweptMark(el);
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
    const motion = resolveDuelMotion(el.ownerDocument);
    const theater = this.ensureTheater(el, audio ?? null, stage, motion);
    // The completion hook is where a queued match ending gets its turn. A round
    // that ends an ordinary match-in-progress simply has nothing waiting.
    theater.play(stage, motion, () => {
      const ending = this.pendingEnd;
      if (ending) this.playOutro(ending);
    });
    return true;
  }

  /** The theater is rebuilt whenever the shell is, because it is bound to the
   *  stage element and to the audio surface the round arrived with. */
  private ensureTheater(
    el: HTMLElement,
    audio: CardRoundAudio | null,
    stage: DuelStageModel,
    motion: DuelMotion,
  ): DuelTheater {
    this.theater?.stop();
    this.theater = new DuelTheater(
      browserTheaterHost(el, audio, window, {
        // One strip, two kinds of beat. An outro beat has no stage, no step
        // and no card to name, so it gets its own line rather than falling
        // through the round captions to an empty string.
        caption: (beat) =>
          isDuelOutroBeat(beat)
            ? duelOutroCaption(beat, this.endingOutcome ?? 'draw')
            : duelBeatCaption(beat, stage, CARD_CATALOG),
        // Published for the stylesheet: the calm rules key on this one answer
        // rather than re-deriving it from a media query and a root attribute.
        motion,
        // The BOARD, not the stage: a damage beat points at a seat's health
        // bar, and the bars live in the seat bands beside the stage rather
        // than in it. The board is their common ancestor and survives every
        // region repaint, so one attribute lights whichever the beat means.
        spotlight: this.els.board,
        // The round is fully told: the two spent cards leave for the piles.
        onBeat: (beat) => {
          if (beat.phase === 'settle') flyStageToDiscard(this.motionAnchors(el));
        },
      }),
    );
    return this.theater;
  }

  /** Where the flights start and end, resolved from the regions this window
   *  already caches. */
  private motionAnchors(stage: HTMLElement): DuelMotionAnchors {
    return { stage, board: this.els.board, oppoHand: this.els.oppoHand };
  }

  private cacheRegions(el: HTMLElement): void {
    const pick = (sel: string) => el.querySelector(sel) as HTMLElement | null;
    this.els = {
      board: pick('[data-cd-board]'),
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
    if (this.summary) {
      // The finished match owns the window until it is dismissed, whatever the
      // projection now says about queues and availability.
      body = duelSummaryHtml(this.summary, CARD_CATALOG) + this.deckButtonHtml();
    } else if (view.state === 'unavailable') {
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
        '<div class="dt-board" data-cd-board>' +
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
      const rematch = target.closest('[data-rematch]') as HTMLElement | null;
      if (rematch) {
        this.summary = null;
        world.startCardDuelAgainstOpponent(rematch.dataset.rematch ?? '');
        this.render();
        return;
      }
      if (target.closest('[data-sumclose]')) {
        this.summary = null;
        this.render();
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
