// Match-shape rules: how a match is won, how much a round hurts, and how long a
// round may take.
//
// They live in the engine rather than on the SimContext-bound orchestrator
// because the standalone slice and the bot need the same numbers, and a second
// copy would be a rule that could silently disagree with itself.
// src/sim/social/card_duel.ts re-exports both, so every existing importer and
// every pinned test keeps resolving them there.

// A match is decided by HEALTH, not by a round count. Both seats start here and
// the loser of a round takes the MARGIN between the two final card values (see
// roundDamage below); the first seat to reach zero loses.
//
// It used to be best-of-three round wins. Rounds still exist and cards still
// read the round score (`scoreCompare`, the `score` expression, the consecutive
// win/loss counters), but a round win no longer ends anything: it is a readout,
// and how BADLY a round was won is what actually moves the match.
export const CARD_DUEL_START_HP = 100;

/**
 * The damage one resolved round deals to the seat that lost it: the margin
 * between the two FINAL (post-effect) values. A 15 against a 4 deals 11; a 6
 * against a 5 deals 1; a push deals nothing. A seat that played no card counts
 * as a zero, so a timeout costs the full value of whatever beat it.
 *
 * Deliberately the plain difference rather than a scaled one: a player can read
 * the two numbers on the stage and know the hit before it lands, which no
 * multiplier would let them do.
 */
export function roundDamage(winnerValue: number, loserValue: number): number {
  return Math.max(0, Math.round(winnerValue - loserValue));
}

// The bound on a match nobody can finish. Two decks that keep tying (or trading
// one-point rounds against 100 health) would otherwise hold a match slot open
// forever, and one process serves a whole realm. At the cap the higher health
// wins and equal health is a draw.
export const CARD_DUEL_MAX_ROUNDS = 30;

// ONE clock governs everything: thinking time and a dropped connection alike,
// for both sides at once, refreshed at every round resolution. A player who
// never plays a card (idle, or linkdead-but-not-yet-dropped) forfeits the round
// and the match once this much sim time has passed since the round started, so
// a live match can never deadlock the other side forever (see
// leaveCardMinigameEntirely / forfeitCardDuelMatch for the player-issued
// escape).
//
// There is deliberately NO separate linkdead grace: a dropped player has until
// their round clock expires, exactly like a player who is present but idle.
// One number to reason about, one number to explain in the tooltip, one number
// to tune. Worth watching in playtest, since 45 seconds is doing double duty as
// think time and as reconnect grace on a slow mobile connection; the honest fix
// if it bites is a separate, longer reconnect window, never inflating think
// time.
export const CARD_DUEL_ROUND_DEADLINE_S = 45;
