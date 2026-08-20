// Match-shape constants: how long a match is and how long a round may take.
//
// They live in the engine rather than on the SimContext-bound orchestrator
// because the standalone slice and the bot need the same numbers, and a second
// copy would be a rule that could silently disagree with itself.
// src/sim/social/card_duel.ts re-exports both, so every existing importer and
// every pinned test keeps resolving them there.

// Best-of-3 rounds; first to 2 round wins takes the match.
export const CARD_DUEL_ROUNDS_TO_WIN = 2;

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
