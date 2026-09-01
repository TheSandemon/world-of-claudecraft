// The pure model behind the ClaudeStone table: the state a player reads BETWEEN
// reveals, as shapes rather than sentences.
//
// The complaint this core answers: a live match used to state itself as three
// lines of prose ("Round score: 1 - 0", "Waiting on your opponent's card...",
// "Deck: 14 - Discard: 2"), which is a lot of reading for information a player
// glances at twenty times a round. Everything here has a shape instead: the
// score is pips, the clock is a ring with a named urgency band, a counter is a
// token that carries its own count, and each seat has one commit state.
//
// DOM-free and i18n-free (tests/duel_table_view.test.ts drives it with plain
// data). The markup half resolves the strings; nothing here decides a color or
// a pixel, only what is true.

import type { CardParkedDuration } from '../../sim/minigames/card_duel/preview';
import type { CardMinigameCard } from '../../sim/social/card_duel';

/** One seat's answer to "is this side still deciding?". */
export type DuelSeatCommit = 'choosing' | 'locked';

/** How much of the round clock is left, as a name the stylesheet can act on.
 *  `urgent` is the band a player must not miss, so it is never tiered away. */
export type DuelClockBand = 'calm' | 'urgent' | 'out';

/** Seconds at or below which the clock reads urgent. Matches the point where
 *  the shipped window already switched the number to its warning color, so the
 *  ring and the number agree rather than each having their own idea. */
export const DUEL_CLOCK_URGENT_S = 10;

export interface DuelClockModel {
  /** Whole seconds a player reads, floored at zero. */
  seconds: number;
  /** 0 to 1, how much of the round window remains: what the ring draws. */
  ratio: number;
  band: DuelClockBand;
}

/**
 * The round clock.
 *
 * `total` is the full round window, so the ring is drawn against the real
 * deadline rather than against whatever the largest value seen so far was. A
 * missing or non-positive total leaves the ring full rather than dividing by
 * zero: a broken ring must never make a live clock read as expired.
 */
export function buildDuelClock(secondsLeft: number | null, total: number): DuelClockModel {
  if (secondsLeft === null) return { seconds: 0, ratio: 0, band: 'out' };
  const seconds = Math.max(0, Math.ceil(secondsLeft));
  const ratio = total > 0 ? Math.min(1, Math.max(0, secondsLeft / total)) : 1;
  const band: DuelClockBand =
    seconds <= 0 ? 'out' : seconds <= DUEL_CLOCK_URGENT_S ? 'urgent' : 'calm';
  return { seconds, ratio, band };
}

/** How much health a seat has left, as a name the stylesheet can act on. */
export type DuelHealthBand = 'healthy' | 'hurt' | 'critical';

/** Below this share of the pool a seat reads as hurt, and below the second one
 *  as critical. Named here so the bar and any future warning agree. */
export const DUEL_HEALTH_HURT_RATIO = 0.5;
export const DUEL_HEALTH_CRITICAL_RATIO = 0.25;

export interface DuelHealthModel {
  /** The exact number a player reads, floored at zero. */
  hp: number;
  max: number;
  /** 0 to 1: what the bar fills to. */
  ratio: number;
  band: DuelHealthBand;
}

/**
 * One seat's health.
 *
 * This replaced the score pips when health replaced best-of-three: the pips
 * answered "how many rounds until this ends", and the bar answers the same
 * question with the resolution the new rules actually have (a round can take
 * one point or fifteen).
 *
 * A non-positive pool leaves the bar EMPTY rather than dividing by zero, and
 * hp above the pool clamps to full: a bar that overflowed its track would be a
 * rendering bug reported as a rules bug.
 */
export function buildDuelHealth(hp: number, max: number): DuelHealthModel {
  const pool = Math.max(0, Math.floor(max));
  const left = Math.max(0, Math.min(pool, Math.floor(hp)));
  const ratio = pool > 0 ? left / pool : 0;
  const band: DuelHealthBand =
    ratio <= DUEL_HEALTH_CRITICAL_RATIO
      ? 'critical'
      : ratio <= DUEL_HEALTH_HURT_RATIO
        ? 'hurt'
        : 'healthy';
  return { hp: left, max: pool, ratio, band };
}

/** A counter a card put on a side (Web, Dread), as a token. */
export interface DuelCounterToken {
  key: string;
  count: number;
}

/**
 * The counters a side is carrying, as tokens.
 *
 * Zeroed and negative counters are dropped (a counter spent down to nothing is
 * not a thing on the board), and the order is by key so the token row never
 * reshuffles itself between two snapshots that hold the same counters.
 */
export function buildDuelCounters(counters: Record<string, number>): DuelCounterToken[] {
  return Object.keys(counters)
    .sort()
    .filter((key) => counters[key] > 0)
    .map((key) => ({ key, count: counters[key] }));
}

/**
 * One place in the opponent's hand.
 *
 * The whole point of the row: a revealed card had nowhere to BE before this,
 * so a player was told "seen in their hand" with no hand on the table to look
 * at. Every slot is face-down except the ones a reveal effect entitled this
 * viewer to see, which are face-up IN PLACE, so the answer to "which of their
 * cards do I know" is a position rather than a separate list.
 */
export interface DuelOpponentSlot {
  index: number;
  /** The revealed card, or null for a face-down place. */
  card: CardMinigameCard | null;
}

/**
 * The opponent's hand as slots, revealed cards first.
 *
 * Revealed cards take the LEADING slots rather than a guessed position: the
 * projection deliberately does not say WHERE in their hand a revealed card
 * sits, and inventing an index would be a claim the server never made. A
 * revealed set larger than the reported hand (a card revealed and then played,
 * so it is no longer held) never grows the row past the count.
 */
export function buildOpponentHand(
  handCount: number,
  revealed: readonly CardMinigameCard[],
): DuelOpponentSlot[] {
  const total = Math.max(0, Math.floor(handCount));
  const slots: DuelOpponentSlot[] = [];
  for (let index = 0; index < total; index++) {
    slots.push({ index, card: index < revealed.length ? revealed[index] : null });
  }
  return slots;
}

/** One parked modifier, as the effects row reads it. */
export interface DuelEffectChip {
  mine: boolean;
  cardId: string;
  amount: number | null;
  duration: CardParkedDuration;
}

/**
 * The effects row: what is still in play, the viewer's own first.
 *
 * Grouping by side rather than interleaving is the whole readability win: "what
 * is riding on me" and "what is riding on them" are two different questions and
 * a player asks them one at a time. Order within a side is left alone, because
 * it is already the engine's creation order.
 */
export function buildDuelEffects(effects: readonly DuelEffectChip[]): DuelEffectChip[] {
  return [...effects.filter((e) => e.mine), ...effects.filter((e) => !e.mine)];
}

export interface DuelSeatModel {
  commit: DuelSeatCommit;
  health: DuelHealthModel;
  /** Rounds this seat has won. A readout now, not the win condition: cards
   *  still read the round score, so it stays on the band beside the bar. */
  roundWins: number;
  counters: DuelCounterToken[];
}

/** One seat's band, on its own. The window builds both through buildDuelTable;
 *  the standalone hot-seat table has two symmetric seats and no "opponent", so
 *  it builds each one directly rather than twisting a viewer-shaped model. */
export function buildDuelSeat(input: {
  committed: boolean;
  roundWins: number;
  hp: number;
  maxHp: number;
  counters: Record<string, number>;
}): DuelSeatModel {
  return {
    commit: input.committed ? 'locked' : 'choosing',
    health: buildDuelHealth(input.hp, input.maxHp),
    roundWins: Math.max(0, Math.floor(input.roundWins)),
    counters: buildDuelCounters(input.counters),
  };
}

export interface DuelTableInput {
  waitingOnOpponent: boolean;
  opponentCommitted: boolean;
  myRounds: number;
  opponentRounds: number;
  myHp: number;
  opponentHp: number;
  maxHp: number;
  myCounters: Record<string, number>;
  opponentCounters: Record<string, number>;
  secondsLeft: number | null;
  roundWindow: number;
  opponentRevealed: readonly CardMinigameCard[];
}

export interface DuelTableModel {
  mine: DuelSeatModel;
  theirs: DuelSeatModel;
  clock: DuelClockModel;
  /** Whose commit the round is actually waiting on, which is the one thing a
   *  pause has to say out loud. `both` is the opening of every round. */
  waitingOn: 'me' | 'them' | 'both' | 'nobody';
  revealed: readonly CardMinigameCard[];
}

/** Builds the whole table model from one snapshot. */
export function buildDuelTable(input: DuelTableInput): DuelTableModel {
  // `waitingOnOpponent` is the snapshot's word for "I have committed": the
  // hand locks the moment a card is played, which is the same instant.
  const iCommitted = input.waitingOnOpponent;
  const waitingOn =
    iCommitted && input.opponentCommitted
      ? 'nobody'
      : iCommitted
        ? 'them'
        : input.opponentCommitted
          ? 'me'
          : 'both';
  return {
    mine: buildDuelSeat({
      committed: iCommitted,
      roundWins: input.myRounds,
      hp: input.myHp,
      maxHp: input.maxHp,
      counters: input.myCounters,
    }),
    theirs: buildDuelSeat({
      committed: input.opponentCommitted,
      roundWins: input.opponentRounds,
      hp: input.opponentHp,
      maxHp: input.maxHp,
      counters: input.opponentCounters,
    }),
    clock: buildDuelClock(input.secondsLeft, input.roundWindow),
    waitingOn,
    revealed: input.opponentRevealed,
  };
}
