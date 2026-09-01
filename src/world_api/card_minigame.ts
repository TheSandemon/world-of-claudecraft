// IWorldCardMinigame: the ClaudeStone minigame facet (src/sim/social/card_duel.ts,
// src/sim/social/card_duel_queue.ts). Poll-style read state (like duel_arena.ts)
// plus a small action surface (like interaction.ts).

import type { CardMinigameInfo } from '../sim/social/card_duel';

export type { CardMinigameInfo };

export interface IWorldCardMinigame {
  cardMinigameInfo: CardMinigameInfo;
  joinCardDuelQueue(): void;
  leaveCardDuelQueue(): void;
  /** Plays one card from the local player's hand, named by its per-match
   *  INSTANCE id (`CardMinigameCard.iid`), never by its face value: a hand can
   *  hold two different cards of the same value. */
  playCardInDuel(cardIid: number): void;
  // Forfeits a LIVE match (distinct from leaveCardDuelQueue, which only
  // leaves the matchmaking queue): the player-issuable escape from a match
  // whose opponent has gone idle.
  forfeitCardDuel(): void;
  /** Sits down against one of the Card Master's named regulars. This does NOT
   *  join the matchmaking queue: it starts a match directly, which is what
   *  makes the minigame playable in a single-player world. */
  startCardDuelAgainstOpponent(opponentId: string): void;
  /** Saves (or replaces) one named deck. The server re-validates the shape. */
  saveCardDeck(name: string, cardIds: readonly string[]): void;
  /** Chooses which saved deck the next match deals. */
  selectCardDeck(name: string): void;
  deleteCardDeck(name: string): void;
}
