// Match-shape constants: how long a match is and how long a round may take.
//
// They live in the engine rather than on the SimContext-bound orchestrator
// because the standalone slice and the bot need the same numbers, and a second
// copy would be a rule that could silently disagree with itself.
// src/sim/social/card_duel.ts re-exports both, so every existing importer and
// every pinned test keeps resolving them there.

// Best-of-3 rounds; first to 2 round wins takes the match.
export const CARD_DUEL_ROUNDS_TO_WIN = 2;

// A player who never plays a card (opponent gone idle / linkdead-but-not-yet-
// dropped) forfeits the current round, and the match, once this much sim time
// has passed since the round started. Keeps a live match from deadlocking the
// other side forever (see leaveCardMinigameEntirely / forfeitCardDuelMatch for
// the player-issued escape).
export const CARD_DUEL_ROUND_DEADLINE_S = 90;
