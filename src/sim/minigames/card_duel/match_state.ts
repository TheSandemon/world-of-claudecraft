// Live ClaudeStone match state: the two seats, the round board the resolver
// mutates, the modifier list, and the played-card history every history query
// reads. Pure: no SimContext, no clock, no rng (deck.ts and selectors.ts own
// the draws).
//
// The orchestrator (src/sim/social/card_duel.ts) owns ONE of these per live
// match and never reaches past this module's shapes.

import type { CardHandState } from './deck';
import { CARD_DUEL_START_HP } from './rules';
import type {
  CardDefinition,
  CardHistoryEntry,
  CardHistoryFilter,
  CardId,
  CardInstance,
  CardModifier,
  CardOwner,
  CardRoundResult,
  CardSeat,
  CardTag,
  CardTribe,
} from './types';

/** The catalog lookup the engine needs, injected so the rules stay content-free
 *  and a test can drive them with three hand-built cards. */
export interface CardCatalog {
  get(id: CardId): CardDefinition | undefined;
}

/** The biggest single hit one seat has landed, for the end-of-match summary.
 *  Null until that seat has won a round that dealt damage. */
export interface CardBestHit {
  round: number;
  cardId: CardId;
  amount: number;
}

/** One seat's live state. */
export interface PlayerCardState {
  seat: CardSeat;
  cards: CardHandState;
  /** Health remaining. The match ends when a seat reaches zero (rules.ts). */
  hp: number;
  /** Total damage this seat has DEALT, for the summary. Not a rule input: no
   *  card reads it, and no comparison depends on it. */
  damageDealt: number;
  bestHit: CardBestHit | null;
  /** The card locked in for this round, or null before it is played. */
  playedThisRound: CardInstance | null;
  /** The card this seat played LAST round. */
  previousCard: CardInstance | null;
  previousResult: CardRoundResult | null;
  roundWins: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  /** Named counters (Pack, Venom, ...). A plain record, walked through sorted
   *  keys wherever order could matter. */
  counters: Record<string, number>;
  /** Instance ids of THIS seat's cards the OPPONENT is entitled to see. The
   *  snapshot builder serializes opponent card identities only for members of
   *  this list, so an identity the viewer is not entitled to never leaves the
   *  server (docs/prd/card-duel-v2.md section 5). */
  revealedToOpponent: number[];
}

/** The whole live match. */
export interface CardMatchState {
  /** 1-based; incremented after each resolved round. */
  round: number;
  a: PlayerCardState;
  b: PlayerCardState;
  /** Parked modifiers (next-card buffs, match-long auras). Ordered by creation;
   *  every consumer sorts explicitly rather than trusting this order. */
  modifiers: CardModifier[];
  history: CardHistoryEntry[];
  /** Effect-limit bookkeeping, keyed by `seat|cardId|effectIndex`. */
  triggerCounts: Record<string, number>;
  lastTriggerRound: Record<string, number>;
}

/** One side of the round board: the mutable working copy the resolver edits. */
export interface CardBoardSide {
  seat: CardSeat;
  card: CardInstance | null;
  def: CardDefinition | null;
  baseValue: number;
  effectiveValue: number;
  tribes: CardTribe[];
  tags: CardTag[];
  /** Set by a `silence` effect: this side's own effects stop resolving. */
  silenced: boolean;
  /** Set by `winTies`: this side takes a tied comparison. */
  winTies: boolean;
  /** Set by `reverseComparison`: the LOWER effective value wins the round. */
  reverseComparison: boolean;
  floorValue: number | null;
  ceilValue: number | null;
}

export interface CardBoard {
  a: CardBoardSide;
  b: CardBoardSide;
}

export function otherSeat(seat: CardSeat): CardSeat {
  return seat === 'a' ? 'b' : 'a';
}

/** Resolves an owner reference relative to the seat the effect belongs to. */
export function seatForOwner(seat: CardSeat, owner: CardOwner): CardSeat {
  return owner === 'self' ? seat : otherSeat(seat);
}

export function sideOf(state: CardMatchState, seat: CardSeat): PlayerCardState {
  return seat === 'a' ? state.a : state.b;
}

export function boardSide(board: CardBoard, seat: CardSeat): CardBoardSide {
  return seat === 'a' ? board.a : board.b;
}

export function createPlayerCardState(seat: CardSeat, cards: CardHandState): PlayerCardState {
  return {
    seat,
    cards,
    hp: CARD_DUEL_START_HP,
    damageDealt: 0,
    bestHit: null,
    playedThisRound: null,
    previousCard: null,
    previousResult: null,
    roundWins: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    counters: {},
    revealedToOpponent: [],
  };
}

export function createMatchState(a: CardHandState, b: CardHandState): CardMatchState {
  return {
    round: 1,
    a: createPlayerCardState('a', a),
    b: createPlayerCardState('b', b),
    modifiers: [],
    history: [],
    triggerCounts: {},
    lastTriggerRound: {},
  };
}

/** Builds one side of the round board from the card it locked in. A side with
 *  no card (it never played, or the round has not started) still gets a board
 *  entry so every consumer can read it without a null check. */
export function buildBoardSide(
  seat: CardSeat,
  card: CardInstance | null,
  catalog: CardCatalog,
): CardBoardSide {
  const def = card ? (catalog.get(card.cardId) ?? null) : null;
  const base = card?.value ?? 0;
  return {
    seat,
    card,
    def,
    baseValue: base,
    effectiveValue: base,
    tribes: def ? [...def.tribes] : [],
    tags: def ? [...def.tags] : [],
    silenced: false,
    winTies: false,
    reverseComparison: false,
    floorValue: null,
    ceilValue: null,
  };
}

export function buildBoard(state: CardMatchState, catalog: CardCatalog): CardBoard {
  return {
    a: buildBoardSide('a', state.a.playedThisRound, catalog),
    b: buildBoardSide('b', state.b.playedThisRound, catalog),
  };
}

export function counterValue(side: PlayerCardState, counter: string): number {
  return side.counters[counter] ?? 0;
}

/** Counters never go negative: a removeCounter past zero clamps rather than
 *  minting a debt a later addCounter would silently pay off. */
export function setCounter(side: PlayerCardState, counter: string, value: number): void {
  side.counters[counter] = Math.max(0, Math.floor(value));
}

/** Marks one of `seat`'s cards as visible to the opponent. Idempotent, and the
 *  list stays sorted so two hosts serialize it identically. */
export function revealToOpponent(side: PlayerCardState, iid: number): void {
  if (side.revealedToOpponent.includes(iid)) return;
  side.revealedToOpponent.push(iid);
  side.revealedToOpponent.sort((x, y) => x - y);
}

/** Records one played card once its round has been decided. */
export function recordHistory(
  state: CardMatchState,
  seat: CardSeat,
  card: CardInstance,
  effectiveValue: number,
  tribes: readonly CardTribe[],
  result: CardRoundResult,
): void {
  state.history.push({
    round: state.round,
    owner: seat,
    cardId: card.cardId,
    iid: card.iid,
    value: card.value,
    effectiveValue,
    tribes: [...tribes],
    result,
  });
}

/** Counts history entries matching a filter. Every field ANDs; an empty filter
 *  counts every card played this match by either side. `owner` is resolved by
 *  the caller (it is relative to the reading card's seat). */
export function countHistory(
  state: CardMatchState,
  filter: CardHistoryFilter,
  ownerSeat: CardSeat | null,
): number {
  let n = 0;
  for (const entry of state.history) {
    if (ownerSeat !== null && entry.owner !== ownerSeat) continue;
    if (filter.tribe !== undefined && !entry.tribes.includes(filter.tribe)) continue;
    if (filter.value !== undefined && entry.value !== filter.value) continue;
    if (filter.cardId !== undefined && entry.cardId !== filter.cardId) continue;
    if (filter.result !== undefined && entry.result !== filter.result) continue;
    if (filter.fromRound !== undefined && entry.round < filter.fromRound) continue;
    if (filter.toRound !== undefined && entry.round > filter.toRound) continue;
    n++;
  }
  return n;
}

/** Tag filtering needs the catalog (tags are definition data, not recorded on
 *  the history entry), so it is a separate walk the expression layer uses when
 *  a filter names a tag. */
export function countHistoryWithTag(
  state: CardMatchState,
  filter: CardHistoryFilter,
  ownerSeat: CardSeat | null,
  tag: CardTag,
  catalog: CardCatalog,
): number {
  let n = 0;
  for (const entry of state.history) {
    if (ownerSeat !== null && entry.owner !== ownerSeat) continue;
    if (filter.tribe !== undefined && !entry.tribes.includes(filter.tribe)) continue;
    if (filter.value !== undefined && entry.value !== filter.value) continue;
    if (filter.cardId !== undefined && entry.cardId !== filter.cardId) continue;
    if (filter.result !== undefined && entry.result !== filter.result) continue;
    if (filter.fromRound !== undefined && entry.round < filter.fromRound) continue;
    if (filter.toRound !== undefined && entry.round > filter.toRound) continue;
    if (!catalog.get(entry.cardId)?.tags.includes(tag)) continue;
    n++;
  }
  return n;
}

/** How many DISTINCT tribes a seat has played this match. */
export function uniqueTribesPlayed(state: CardMatchState, seat: CardSeat): number {
  const seen: CardTribe[] = [];
  for (const entry of state.history) {
    if (entry.owner !== seat) continue;
    for (const tribe of entry.tribes) if (!seen.includes(tribe)) seen.push(tribe);
  }
  return seen.length;
}

/** Records a round result on both seats, advancing streaks and the round
 *  counter. `winner` is null for a push. */
export function applyRoundResult(state: CardMatchState, winner: CardSeat | null): void {
  for (const seat of ['a', 'b'] as const) {
    const side = sideOf(state, seat);
    const result: CardRoundResult = winner === null ? 'tie' : winner === seat ? 'win' : 'lose';
    side.previousResult = result;
    if (result === 'win') {
      side.roundWins++;
      side.consecutiveWins++;
      side.consecutiveLosses = 0;
    } else if (result === 'lose') {
      side.consecutiveLosses++;
      side.consecutiveWins = 0;
    } else {
      side.consecutiveWins = 0;
      side.consecutiveLosses = 0;
    }
  }
}

/**
 * Applies one round's damage to the seat that lost it.
 *
 * Kept beside `applyRoundResult` because they are the same moment: these two
 * functions together are the whole answer to "what does a resolved round do to
 * the match", and splitting them would let a caller run one without the other.
 *
 * Health floors at zero rather than going negative: the overkill is not a
 * mechanic anything reads, and a negative bar is a rendering bug waiting to
 * happen in two hosts at once.
 */
export function applyRoundDamage(
  state: CardMatchState,
  winner: CardSeat,
  damage: number,
  sourceCardId: CardId | null,
): void {
  if (damage <= 0) return;
  const loser = sideOf(state, otherSeat(winner));
  const victor = sideOf(state, winner);
  loser.hp = Math.max(0, loser.hp - damage);
  victor.damageDealt += damage;
  if (sourceCardId && (victor.bestHit === null || damage > victor.bestHit.amount)) {
    victor.bestHit = { round: state.round, cardId: sourceCardId, amount: damage };
  }
}

/** The bookkeeping key one authored effect's limits are counted against. */
export function limitKey(seat: CardSeat, cardId: CardId, effectIndex: number): string {
  return `${seat}|${cardId}|${effectIndex}`;
}
