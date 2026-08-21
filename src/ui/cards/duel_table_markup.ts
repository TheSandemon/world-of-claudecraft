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
import { esc } from '../esc';
import { formatNumber, t } from '../i18n';
import { cardFaceHtml } from './card_face_markup';
import { buildCardFaceModel } from './card_face_view';
import type { DuelStageModel, DuelStageSide } from './duel_beats_core';
import type { DuelCounterToken, DuelPip, DuelSeatModel, DuelTableModel } from './duel_table_view';

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

/** The score track. Filled pips are rounds already won. */
export function duelPipsHtml(pips: readonly DuelPip[], label: string): string {
  const cells = pips
    .map((pip) => `<span class="dt-pip${pip.filled ? ' dt-pip-on' : ''}"></span>`)
    .join('');
  return `<div class="dt-pips" role="img" aria-label="${esc(label)}">${cells}</div>`;
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
  const won = seat.pips.filter((pip) => pip.filled).length;
  const scoreLabel = t('cardDuel.pipsAria', {
    name,
    won: num(won),
    total: num(seat.pips.length),
  });
  return (
    `<div class="dt-seat dt-seat-${side}" data-commit="${seat.commit}">` +
    `<span class="dt-seat-name">${esc(name)}</span>` +
    `<span class="dt-commit"><span class="dt-lamp" aria-hidden="true"></span>${esc(commitText)}</span>` +
    duelPipsHtml(seat.pips, scoreLabel) +
    duelTokensHtml(seat.counters) +
    (opts.piles ? duelPilesHtml(opts.piles.deck, opts.piles.discard) : '') +
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

/** The opponent cards a reveal effect entitled this viewer to see. Cards, not
 *  a sentence: they are read the same way as everything else on the table. */
export function duelRevealedHtml(cards: readonly CardMinigameCard[], catalog: CardCatalog): string {
  if (cards.length === 0) return '';
  const faces = cards
    .map((card) =>
      cardFaceHtml(
        buildCardFaceModel(card, catalog.get(card.cardId), { size: 'hand', revealed: true }),
        { catalog },
      ),
    )
    .join('');
  return (
    '<div class="dt-revealed">' +
    `<div class="dt-revealed-title">${esc(t('cardDuel.revealedHeading'))}</div>` +
    `<div class="dt-revealed-row">${faces}</div>` +
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
    `<div class="dt-slot-card">${face}<span class="dt-back" aria-hidden="true"></span></div>` +
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
    stageCardHtml(stage.mine, 'mine', catalog, labels)
  );
}

/** The stage before any round has resolved: two empty places, so the table
 *  reads as a table rather than as a gap that might be a bug. */
export function duelStageIdleHtml(labels: DuelStageLabels = defaultStageLabels()): string {
  const empty = (which: DuelSide) =>
    `<div class="dt-slot dt-slot-${which} dt-slot-empty">` +
    `<div class="dt-slot-label">${esc(which === 'mine' ? labels.mine : labels.theirs)}</div>` +
    '<div class="dt-slot-card"><span class="dt-back" aria-hidden="true"></span></div>' +
    '</div>';
  return (
    empty('theirs') +
    '<div class="dt-clash" aria-hidden="true"></div>' +
    `<div class="dt-verdict dt-verdict-idle">${esc(t('cardDuel.stageIdle'))}</div>` +
    empty('mine')
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
