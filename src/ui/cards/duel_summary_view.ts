// Pure view-core for the end of a match: what the summary says, and in what
// order it lands.
//
// The complaint it answers: a match ended in silence. The projection's match
// went null, the window's shell signature flipped to the Join screen, and the
// table a player had been reading for five minutes was replaced mid-thought
// with no statement of what had happened. A game should finish, not stop.
//
// DOM-free and i18n-free: it decides which rows exist and what numbers they
// carry, and the markup half resolves the words. Driven straight from the
// match-end event's summary, which the SIM builds at the end (a client that
// accumulated it from the rounds it happened to receive would summarize the
// half of the match it watched).

/** How a match finished, from the receiving player's point of view. */
export type DuelSummaryOutcome = 'win' | 'loss' | 'draw';

/** One line of the summary. `kind` is what it MEANS, so the markup can style
 *  the interesting ones without parsing their text. */
export type DuelSummaryRowKind = 'health' | 'rounds' | 'dealt' | 'taken' | 'bestHit';

export interface DuelSummaryRow {
  kind: DuelSummaryRowKind;
  /** The primary number the row is about. */
  value: number;
  /** The second number, where the row is a pair (health left of a pool). */
  of?: number;
  /** The card a row is about (the best hit). */
  cardId?: string;
  /** The round it happened in. */
  round?: number;
}

/** What the summary needs, which is exactly the match-end event's payload. */
export interface DuelSummaryInput {
  won: boolean;
  draw?: boolean;
  rounds: number;
  myHp: number;
  theirHp: number;
  maxHp: number;
  damageDealt: number;
  damageTaken: number;
  bestHit?: { round: number; cardId: string; amount: number };
  opponentName?: string;
  opponentId?: string;
}

export interface DuelSummaryModel {
  outcome: DuelSummaryOutcome;
  /** The opponent, as the seat band names them: a player name, or the content
   *  id of one of the Card Master's regulars. The markup resolves the id. */
  opponentName: string;
  opponentId: string;
  rows: DuelSummaryRow[];
  /** True when the same opponent can be sat down against again, which is only
   *  the regulars: a human opponent has to be queued for. */
  canRematch: boolean;
}

/**
 * The summary for one finished match.
 *
 * Every row is unconditional except the best hit, which only exists if the
 * player landed one: a "biggest hit: none" line is a row that says nothing,
 * and a summary of a match somebody lost without ever connecting should not
 * rub it in with an empty field.
 */
export function buildDuelSummary(input: DuelSummaryInput): DuelSummaryModel {
  const rows: DuelSummaryRow[] = [
    { kind: 'health', value: Math.max(0, input.myHp), of: input.maxHp },
    { kind: 'rounds', value: Math.max(0, input.rounds) },
    { kind: 'dealt', value: Math.max(0, input.damageDealt) },
    { kind: 'taken', value: Math.max(0, input.damageTaken) },
  ];
  if (input.bestHit && input.bestHit.amount > 0) {
    rows.push({
      kind: 'bestHit',
      value: input.bestHit.amount,
      cardId: input.bestHit.cardId,
      round: input.bestHit.round,
    });
  }
  return {
    outcome: input.draw ? 'draw' : input.won ? 'win' : 'loss',
    opponentName: input.opponentName ?? '',
    opponentId: input.opponentId ?? '',
    rows,
    canRematch: (input.opponentId ?? '') !== '',
  };
}

/** How long after the title each row lands, in milliseconds. The summary uses
 *  the same idea as the round: one thing at a time, quickly. */
export const DUEL_SUMMARY_ROW_MS = 160;

/** When one row appears. Index 0 lands with the title. */
export function summaryRowDelayMs(index: number): number {
  return Math.max(0, index) * DUEL_SUMMARY_ROW_MS;
}
