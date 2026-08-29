// The thin consumer half of the Card Duel table: model in, markup out.
//
// Same split, and the same reasoning, as card_face_markup.ts: every number
// here was decided by duel_table_view.ts or duel_beats_core.ts, every string
// comes from i18n, and this module writes no DOM. It is markup the window and
// the standalone playtest slice both insert, so the two tables cannot drift
// into looking like different games.
//
// The rule the whole file serves: SHOW the state, do not describe it. A score
// is a row of pips, a clock is a draining ring, a counter is a token, and a
// seat's commit is a lamp. The exact numbers ride along beside every one of
// them for the player who wants to read rather than glance.

import type { CardCatalog } from '../../sim/minigames/card_duel/match_state';
import type { CardMinigameCard } from '../../sim/social/card_duel';
import { cardName, cardOpponentName, cardRulesTextFrom } from '../card_i18n';
import { esc } from '../esc';
import { formatNumber, t } from '../i18n';
import { cardFaceHtml } from './card_face_markup';
import { buildCardFaceModel } from './card_face_view';
import type { DuelBeat, DuelStageModel, DuelStageSide, DuelStageStep } from './duel_beats_core';
import type { DuelMatchOutcome } from './duel_outro_core';
import { type DuelSummaryModel, type DuelSummaryRow, summaryRowDelayMs } from './duel_summary_view';
import type {
  DuelCounterToken,
  DuelEffectChip,
  DuelHealthModel,
  DuelOpponentSlot,
  DuelSeatModel,
  DuelTableModel,
} from './duel_table_view';

/** A whole number as the player's locale writes it. */
function num(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/** Which side of the table a fragment belongs to. Position is ownership here:
 *  the opponent is always the top band, the player is always the bottom one,
 *  in every window, on every device, in every round. */
export type DuelSide = 'mine' | 'theirs';

/** The localized name of a counter (Web, Dread), by its sim-side key. */
export function counterName(key: string): string {
  return t(`cards.counter.${key}` as never);
}

/**
 * One seat's health bar: the thing the match is decided on.
 *
 * The exact numbers ride ON the bar rather than under it, because a bar alone
 * cannot answer "can that card finish me" and that is the question every choice
 * in this game turns on. Never tiered and never hover-gated; the only thing a
 * graphics preset touches is whether the fill SLIDES to its new width or cuts
 * to it.
 */
export function duelHealthHtml(health: DuelHealthModel, label: string): string {
  const pct = `${(health.ratio * 100).toFixed(1)}%`;
  return (
    `<div class="dt-hp" data-band="${health.band}" role="img" aria-label="${esc(label)}">` +
    `<span class="dt-hp-fill" style="width:${pct}"></span>` +
    `<span class="dt-hp-num">${esc(num(health.hp))}<span class="dt-hp-max">/${esc(num(health.max))}</span></span>` +
    '</div>'
  );
}

/** The counter tokens a side is carrying. Nothing renders when it has none:
 *  an empty row of zeroes is noise a player has to read past every round. */
export function duelTokensHtml(tokens: readonly DuelCounterToken[]): string {
  if (tokens.length === 0) return '';
  const cells = tokens
    .map((token) => {
      const label = t('cardDuel.counterAria', {
        name: counterName(token.key),
        count: num(token.count),
      });
      return (
        `<span class="dt-token" data-counter="${esc(token.key)}" aria-label="${esc(label)}">` +
        `<span class="dt-token-count">${esc(num(token.count))}</span>` +
        `<span class="dt-token-name">${esc(counterName(token.key))}</span>` +
        '</span>'
      );
    })
    .join('');
  return `<div class="dt-tokens">${cells}</div>`;
}

export interface DuelSeatBandOptions {
  name: string;
  /** The seat's two piles, when this viewer is entitled to their counts: their
   *  own in game, both seats at a hot-seat table. Omitted rather than zeroed
   *  for the opponent, because a zero would be a claim. */
  piles?: { deck: number; discard: number };
  /**
   * A discard pile with no figure on it, for the seat whose count this viewer
   * is not entitled to.
   *
   * It exists so a spent card has somewhere to GO. Cards used to leave the
   * opponent's side of the stage by simply ceasing to exist, which is the one
   * thing a card game never does. A place with no number claims nothing about
   * how many cards are in it.
   */
  discardPlace?: boolean;
}

/** One seat's identity band: who it is, whether it has committed, its score,
 *  its counters, and (where known) its two piles. Everything about one side of
 *  the table on one row, so the two rows can be compared without reading
 *  either. The commit lamp is the answer to "why is nothing happening", so it
 *  is never hidden and never delayed. */
export function duelSeatBandHtml(
  seat: DuelSeatModel,
  side: DuelSide,
  opts: DuelSeatBandOptions,
): string {
  const { name } = opts;
  const commitText = t(
    seat.commit === 'locked' ? 'cardDuel.commitLocked' : 'cardDuel.commitChoosing',
  );
  const healthLabel = t('cardDuel.healthAria', {
    name,
    hp: num(seat.health.hp),
    max: num(seat.health.max),
  });
  // Rounds won is a readout rather than the win condition now, so it rides the
  // band as one small figure instead of owning a track of its own.
  const rounds = t('cardDuel.roundsWon', { count: num(seat.roundWins) });
  return (
    `<div class="dt-seat dt-seat-${side}" data-commit="${seat.commit}">` +
    `<span class="dt-seat-name">${esc(name)}</span>` +
    `<span class="dt-commit"><span class="dt-lamp" aria-hidden="true"></span>${esc(commitText)}</span>` +
    duelHealthHtml(seat.health, healthLabel) +
    `<span class="dt-rounds">${esc(rounds)}</span>` +
    duelTokensHtml(seat.counters) +
    (opts.piles
      ? duelPilesHtml(opts.piles.deck, opts.piles.discard)
      : opts.discardPlace
        ? duelDiscardPlaceHtml()
        : '') +
    '</div>'
  );
}

/** The clock: a ring that drains plus the seconds in figures. The ring is the
 *  glanceable half and the number is the exact one; neither is tiered away,
 *  because a round is racing this. */
export function duelClockHtml(): string {
  return (
    '<div class="dt-clock" role="status">' +
    '<span class="dt-clock-ring" data-cd-clockring aria-hidden="true"></span>' +
    '<span class="dt-clock-num" data-cd-clock></span>' +
    '</div>'
  );
}

/**
 * A discard pile with no count on it: the place the opponent's spent cards go.
 *
 * Same node shape as the counted pile above (same class, same `data-pile`), so
 * the flight that clears the stage finds both seats' piles by one selector and
 * the two sides of the table are laid out alike.
 */
export function duelDiscardPlaceHtml(): string {
  return (
    '<div class="dt-piles dt-piles-place">' +
    `<span class="dt-pile" data-pile="discard" aria-label="${esc(t('cardDuel.pileDiscardTheirs'))}">` +
    '<span class="dt-pile-stack" aria-hidden="true"></span>' +
    '</span>' +
    '</div>'
  );
}

/** The deck and discard piles, as stacks that carry their own counts. */
export function duelPilesHtml(deck: number, discard: number): string {
  const pile = (kind: 'deck' | 'discard', count: number, label: string) =>
    `<span class="dt-pile" data-pile="${kind}" aria-label="${esc(label)}">` +
    '<span class="dt-pile-stack" aria-hidden="true"></span>' +
    `<span class="dt-pile-count">${esc(num(count))}</span>` +
    '</span>';
  return (
    '<div class="dt-piles">' +
    pile('deck', deck, t('cardDuel.pileDeck', { count: num(deck) })) +
    pile('discard', discard, t('cardDuel.pileDiscard', { count: num(discard) })) +
    '</div>'
  );
}

/**
 * The opponent's hand: a face-down place per card they hold, with the ones a
 * reveal effect entitled this viewer to see turned face up among them.
 *
 * This is where a revealed card LIVES. Before it, the viewer was handed a
 * separate "seen in their hand" strip with no hand anywhere on the table, so
 * there was nothing to read it against and no way to tell how much of their
 * hand it was.
 */
export function duelOpponentHandHtml(
  slots: readonly DuelOpponentSlot[],
  catalog: CardCatalog,
): string {
  if (slots.length === 0) return '';
  const seen = slots.filter((slot) => slot.card !== null).length;
  const label =
    seen > 0
      ? t('cardDuel.oppoHandSeen', { count: num(slots.length), seen: num(seen) })
      : t('cardDuel.oppoHandHidden', { count: num(slots.length) });
  const cells = slots
    .map((slot) =>
      slot.card
        ? cardFaceHtml(
            buildCardFaceModel(slot.card, catalog.get(slot.card.cardId), {
              size: 'hand',
              revealed: true,
            }),
            { catalog, inspect: true },
          )
        : '<span class="dt-oppo-back" aria-hidden="true"></span>',
    )
    .join('');
  return (
    `<div class="dt-oppo" role="group" aria-label="${esc(label)}">` +
    `<div class="dt-oppo-row">${cells}</div>` +
    `<div class="dt-oppo-note">${esc(label)}</div>` +
    '</div>'
  );
}

/**
 * The effects row: every parked modifier still in play, the viewer's own
 * first.
 *
 * Each chip names the SOURCE CARD and carries that card's own rules sentence
 * as its accessible name, because the sentence already says what the effect
 * does ("Your next Beast gets +2"). Writing a second copy of that wording here
 * would be a sentence to translate, review, and keep in step with the card for
 * no new information.
 */
export function duelEffectsHtml(effects: readonly DuelEffectChip[], catalog: CardCatalog): string {
  if (effects.length === 0) return '';
  const durationKey = {
    nextRound: 'cardDuel.durationNextRound',
    untilTriggered: 'cardDuel.durationUntilTriggered',
    untilMatchEnd: 'cardDuel.durationMatchEnd',
  } as const;
  const chips = effects
    .map((effect) => {
      const def = catalog.get(effect.cardId);
      const name = def ? cardName(def) : '';
      const rules = def ? cardRulesTextFrom(def, {}) : '';
      const duration = t(durationKey[effect.duration]);
      const label = t('cardDuel.effectAria', { name, rules, duration });
      const amount =
        effect.amount === null || effect.amount === 0
          ? ''
          : `<span class="dt-fx-amount ${effect.amount > 0 ? 'dt-fx-up' : 'dt-fx-down'}">` +
            `${esc(effect.amount > 0 ? `+${num(effect.amount)}` : num(effect.amount))}</span>`;
      return (
        `<span class="dt-fx" data-side="${effect.mine ? 'mine' : 'theirs'}" aria-label="${esc(label)}" title="${esc(label)}">` +
        `<span class="dt-fx-name">${esc(name)}</span>` +
        amount +
        `<span class="dt-fx-when">${esc(duration)}</span>` +
        '</span>'
      );
    })
    .join('');
  return (
    '<div class="dt-effects">' +
    `<div class="dt-effects-title">${esc(t('cardDuel.effectsHeading'))}</div>` +
    `<div class="dt-effects-row">${chips}</div>` +
    '</div>'
  );
}

/**
 * What the stage calls its two sides and its three outcomes.
 *
 * The in-game window is played from ONE seat, so its defaults are written in
 * the second person ("You played", "You win the round"). The standalone
 * playtest slice is a hot seat with two named seats and no "you" at all, so it
 * passes its own labels rather than lying about whose round it was. Nothing
 * else about the stage differs between them, which is the point.
 */
export interface DuelStageLabels {
  mine: string;
  theirs: string;
  win: string;
  lose: string;
  push: string;
}

/** The window's own labels: one seat, second person. */
export function defaultStageLabels(): DuelStageLabels {
  return {
    mine: t('cardDuel.revealMine'),
    theirs: t('cardDuel.revealTheirs'),
    win: t('cardDuel.revealWin'),
    lose: t('cardDuel.revealLose'),
    push: t('cardDuel.revealPush'),
  };
}

/** One card on the stage: the face when the round told us which card it was,
 *  the value plate alone when it did not. */
function stageCardHtml(
  side: DuelStageSide,
  which: DuelSide,
  catalog: CardCatalog,
  labels: DuelStageLabels,
): string {
  const face =
    side.cardId === null
      ? ''
      : cardFaceHtml(
          buildCardFaceModel(
            { iid: 0, cardId: side.cardId, value: side.base },
            catalog.get(side.cardId),
            { size: 'stage', effectiveValue: side.value },
          ),
          { catalog },
        );
  const label = which === 'mine' ? labels.mine : labels.theirs;
  const deltaChip =
    side.delta === 0
      ? ''
      : `<span class="dt-chip ${side.delta > 0 ? 'dt-chip-up' : 'dt-chip-down'}">` +
        `${esc(side.delta > 0 ? `+${num(side.delta)}` : num(side.delta))}</span>`;
  // The number plate rides beside the face rather than only on it: at the
  // clash the two plates are what the player compares, so they must be the
  // same size and in the same place every round.
  return (
    `<div class="dt-slot dt-slot-${which}">` +
    `<div class="dt-slot-label">${esc(label)}</div>` +
    // The same `data-cd-slot` anchor the pending stage writes: one selector
    // finds a side's card whether the stage is waiting or finished, which is
    // what lets the flight that clears the table measure it.
    `<div class="dt-slot-card" data-cd-slot="${which}">${face}` +
    '<span class="dt-back" aria-hidden="true"></span></div>' +
    '<div class="dt-plate">' +
    `<span class="dt-plate-value">${esc(num(side.value))}</span>` +
    (side.delta === 0
      ? ''
      : `<span class="dt-plate-base">${esc(num(side.base))}</span>${deltaChip}`) +
    '</div>' +
    '</div>'
  );
}

/**
 * The caption line: one sentence saying what the stage is doing RIGHT NOW.
 *
 * The theater writes into it once per beat (duel_theater_host.ts), because a
 * step beat's line names the card that acted and the number it moved, and
 * neither is knowable when the stage markup is written. It is the one part of
 * the round that survives having every animation switched off, which is why it
 * exists at all: at the lowest preset a clash has no motion to tell it apart
 * from the beat before it, and a beat a player cannot distinguish is not a
 * beat.
 *
 * `aria-hidden`: the off-screen announce line already reads the whole round as
 * one sentence, and a caption that rewrites itself six times in three seconds
 * would talk over it.
 */
export function duelBeatLineHtml(): string {
  return '<div class="dt-beats" data-cd-beatline aria-hidden="true"></div>';
}

/**
 * What one beat says.
 *
 * A step beat names the CARD, because "+2" with no author is the thing players
 * were complaining about: a number that changes for no visible reason. The
 * value-moving steps read as a signed change; the rest name what the effect
 * did in its own words.
 */
export function duelBeatCaption(
  beat: DuelBeat,
  stage: DuelStageModel,
  catalog: CardCatalog,
): string {
  if (beat.phase === 'step' && beat.step) return stepCaption(beat.step, catalog);
  if (beat.phase === 'deal') return t('cardDuel.beat.deal');
  if (beat.phase === 'reveal') return t('cardDuel.beat.reveal');
  if (beat.phase === 'clash') return t('cardDuel.beat.clash');
  if (beat.phase === 'damage') {
    return t('cardDuel.beat.damage', {
      target: t(stage.damageTo === 'mine' ? 'cardDuel.beat.you' : 'cardDuel.beat.them'),
      amount: num(stage.damage),
    });
  }
  // The verdict banner is already the caption for the last two beats, and two
  // lines saying the same thing is one line of noise.
  return '';
}

/**
 * What one OUTRO beat says (duel_outro_core.ts).
 *
 * Separate from `duelBeatCaption` because an outro beat is not about a round:
 * it has no stage, no step and no card to name, and the thing it reports is the
 * MATCH. Same strip, same attribute, same one-line-per-beat contract.
 *
 * `curtain` is deliberately silent. It is the beat where the summary is coming
 * up, and the summary's own title says the result better than a caption
 * repeating it underneath.
 */
export function duelOutroCaption(beat: DuelBeat, outcome: DuelMatchOutcome): string {
  if (beat.phase === 'finish') return t('cardDuel.beat.finish');
  if (beat.phase === 'glory') {
    return t(
      outcome === 'win'
        ? 'cardDuel.beat.gloryWin'
        : outcome === 'lose'
          ? 'cardDuel.beat.gloryLose'
          : 'cardDuel.beat.gloryDraw',
    );
  }
  return '';
}

function stepCaption(step: DuelStageStep, catalog: CardCatalog): string {
  const def = catalog.get(step.cardId);
  const name = def ? cardName(def) : step.cardId;
  if (step.amount !== null && step.amount !== 0) {
    return t('cardDuel.beat.effectValue', {
      card: name,
      amount: step.amount > 0 ? `+${num(step.amount)}` : num(step.amount),
      target: t(step.target === 'mine' ? 'cardDuel.beat.yourCard' : 'cardDuel.beat.theirCard'),
    });
  }
  const key =
    step.effect === 'silence'
      ? 'cardDuel.beat.effectSilence'
      : step.effect === 'reveal'
        ? 'cardDuel.beat.effectReveal'
        : step.effect === 'draw'
          ? 'cardDuel.beat.effectDraw'
          : step.effect === 'swapValues'
            ? 'cardDuel.beat.effectSwap'
            : 'cardDuel.beat.effectOther';
  return t(key as never, { card: name });
}

/**
 * The stage for a resolved round: two cards, the strike between them, and the
 * verdict.
 *
 * Written once when the round resolves; the beats then only move a `data-beat`
 * attribute across it, so the whole timeline costs no markup and no layout
 * read. The numbers are correct in this string from the first frame, whether
 * or not a single beat ever plays.
 */
export function duelStageHtml(
  stage: DuelStageModel,
  catalog: CardCatalog,
  labels: DuelStageLabels = defaultStageLabels(),
): string {
  const outcome =
    stage.outcome === 'win' ? labels.win : stage.outcome === 'lose' ? labels.lose : labels.push;
  return (
    stageCardHtml(stage.theirs, 'theirs', catalog, labels) +
    '<div class="dt-clash" aria-hidden="true"><span class="dt-spark"></span></div>' +
    `<div class="dt-verdict">${esc(outcome)}</div>` +
    (stage.reshuffled ? `<div class="dt-note">${esc(t('cardDuel.revealReshuffled'))}</div>` : '') +
    stageCardHtml(stage.mine, 'mine', catalog, labels) +
    duelDamagePlateHtml(stage) +
    duelBeatLineHtml()
  );
}

/**
 * The hit, as a plate on the stage: how much health the round took and off
 * whom.
 *
 * Written with the stage and revealed by the damage beat, so the number is in
 * the markup from the first frame (the health bar underneath has already
 * moved) and the beat only chooses when to point at it.
 */
export function duelDamagePlateHtml(stage: DuelStageModel): string {
  if (stage.damage <= 0 || stage.damageTo === null) return '';
  const side = stage.damageTo;
  const label = t(side === 'mine' ? 'cardDuel.damageMine' : 'cardDuel.damageTheirs', {
    amount: num(stage.damage),
  });
  return (
    `<div class="dt-damage" data-side="${side}" aria-hidden="true">` +
    `<span class="dt-damage-num">-${esc(num(stage.damage))}</span>` +
    `<span class="dt-damage-who">${esc(label)}</span>` +
    '</div>'
  );
}

/** The stage before any round has resolved: two empty places, so the table
 *  reads as a table rather than as a gap that might be a bug. */
export function duelStageIdleHtml(labels: DuelStageLabels = defaultStageLabels()): string {
  return duelStagePendingHtml({ mine: false, theirs: false }, labels);
}

/**
 * The stage BETWEEN rounds: a face-down card in the place of every side that
 * has committed.
 *
 * This is where a played card goes. Before it, a card left the hand and simply
 * ceased to exist until the round resolved, so the table could not answer the
 * most basic question in the game ("have I played, and have they?") with
 * anything but a lamp on a band. A committed side gets a real card back, face
 * down, in the slot its card will be revealed in.
 *
 * Snapshot-driven, so it is correct the instant a commit lands, at every
 * preset. The MOTION of the card getting there is the flight
 * (src/ui/cards/card_flight.ts), which is decoration over this.
 */
export function duelStagePendingHtml(
  committed: { mine: boolean; theirs: boolean },
  labels: DuelStageLabels = defaultStageLabels(),
): string {
  const slot = (which: DuelSide) => {
    const down = which === 'mine' ? committed.mine : committed.theirs;
    return (
      `<div class="dt-slot dt-slot-${which}${down ? '' : ' dt-slot-empty'}">` +
      `<div class="dt-slot-label">${esc(which === 'mine' ? labels.mine : labels.theirs)}</div>` +
      `<div class="dt-slot-card" data-cd-slot="${which}">` +
      '<span class="dt-back" aria-hidden="true"></span></div>' +
      '</div>'
    );
  };
  const both = committed.mine && committed.theirs;
  const line = both ? t('cardDuel.waitingReveal') : t('cardDuel.stageIdle');
  return (
    slot('theirs') +
    '<div class="dt-clash" aria-hidden="true"></div>' +
    `<div class="dt-verdict dt-verdict-idle">${esc(line)}</div>` +
    slot('mine')
  );
}

/** The one sentence a pause owes the player: whose card the round is on. */
export function duelWaitingText(model: DuelTableModel): string {
  switch (model.waitingOn) {
    case 'both':
      return t('cardDuel.waitingBoth');
    case 'them':
      return t('cardDuel.waitingThem');
    case 'me':
      return t('cardDuel.waitingMe');
    default:
      return t('cardDuel.waitingReveal');
  }
}

/**
 * The end of a match, as a panel the window holds until the player dismisses
 * it.
 *
 * Deliberately IN the window rather than a banner over the world: the table it
 * replaces is where the player was looking, and the numbers only mean anything
 * next to the board they came from. Rows carry their own landing delay as a
 * CSS custom property, so they arrive one at a time without a timer per row.
 */
export function duelSummaryHtml(model: DuelSummaryModel, catalog: CardCatalog): string {
  const title = t(
    model.outcome === 'win'
      ? 'cardDuel.summary.win'
      : model.outcome === 'loss'
        ? 'cardDuel.summary.loss'
        : 'cardDuel.summary.draw',
  );
  const who = model.opponentId ? cardOpponentName(model.opponentId) : model.opponentName;
  const rows = model.rows
    .map((row, index) => {
      const delay = summaryRowDelayMs(index);
      return (
        `<li class="dt-sum-row" data-kind="${row.kind}" style="--dt-sum-delay:${delay}ms">` +
        `<span class="dt-sum-label">${esc(summaryRowLabel(row))}</span>` +
        `<span class="dt-sum-value">${esc(summaryRowValue(row, catalog))}</span>` +
        '</li>'
      );
    })
    .join('');
  const rematch = model.canRematch
    ? `<button type="button" class="cd-action-btn" data-rematch="${esc(model.opponentId)}">${esc(
        t('cardDuel.summary.rematch'),
      )}</button>`
    : '';
  return (
    `<div class="dt-sum" data-outcome="${model.outcome}" role="group" aria-label="${esc(title)}">` +
    `<div class="dt-sum-title">${esc(title)}</div>` +
    (who
      ? `<div class="dt-sum-who">${esc(t('cardDuel.summary.against', { name: who }))}</div>`
      : '') +
    `<ul class="dt-sum-rows">${rows}</ul>` +
    rematch +
    `<button type="button" class="cd-action-btn" data-sumclose>${esc(t('cardDuel.summary.done'))}</button>` +
    '</div>'
  );
}

function summaryRowLabel(row: DuelSummaryRow): string {
  switch (row.kind) {
    case 'health':
      return t('cardDuel.summary.health');
    case 'rounds':
      return t('cardDuel.summary.rounds');
    case 'dealt':
      return t('cardDuel.summary.dealt');
    case 'taken':
      return t('cardDuel.summary.taken');
    default:
      return t('cardDuel.summary.bestHit');
  }
}

function summaryRowValue(row: DuelSummaryRow, catalog: CardCatalog): string {
  if (row.kind === 'health') return `${num(row.value)}/${num(row.of ?? 0)}`;
  if (row.kind === 'bestHit') {
    const def = row.cardId ? catalog.get(row.cardId) : undefined;
    return t('cardDuel.summary.bestHitValue', {
      amount: num(row.value),
      card: def ? cardName(def) : (row.cardId ?? ''),
      round: num(row.round ?? 0),
    });
  }
  return num(row.value);
}
