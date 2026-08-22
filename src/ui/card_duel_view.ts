// Pure view-core for the Card Duel minigame window (Card Master NPC).
//
// Maps the IWorldCardMinigame read surface (cardMinigameInfo) to a render
// model: DOM/i18n-free, so tests/card_duel_view.test.ts drives it directly
// with a plain CardMinigameInfo object (the shape is identical whether it
// came from Sim or ClientWorld, since it is data, not a per-host structure).
// The thin consumer (card_duel_window.ts) paints this.

import type { CardMinigameCard, CardMinigameEffect } from '../sim/social/card_duel';
import type { CardMinigameInfo } from '../world_api';

export interface CardDuelHandCardView {
  /** The per-match instance handle the play command names. A hand can hold two
   *  DIFFERENT cards of the same value, so the value is not an identity. */
  iid: number;
  cardId: string;
  value: number;
  playable: boolean;
  /** The value change parked modifiers would apply if this card were played
   *  now, signed. Zero when nothing is riding on it. */
  pendingDelta: number;
  /** Rules-text numbers the sim resolved against the live match, so a scaling
   *  card states what it would actually apply. Absent for a card with no
   *  placeholders to fill. */
  textValues?: Record<string, number>;
}

// 'unavailable': no other player is present to ever pair against (the
// offline Sim's single-player case). The window hides/disables the Join
// affordance and shows a clear message instead of letting the player queue
// forever with no feedback.
export type CardDuelWindowState = 'idle' | 'unavailable' | 'queued' | 'inMatch';

export interface CardDuelViewModel {
  state: CardDuelWindowState;
  hand: CardDuelHandCardView[];
  deckCount: number;
  discardCount: number;
  opponentName: string;
  /** Set when the opponent is one of the Card Master's regulars: the content
   *  id whose localized name the painter resolves. */
  opponentId: string;
  myRounds: number;
  opponentRounds: number;
  /** Health both seats have left, and the pool it came from: what the match
   *  is decided on. */
  myHp: number;
  opponentHp: number;
  maxHp: number;
  round: number;
  waitingOnOpponent: boolean;
  /** True once the opponent has locked a card in. Their CARD stays hidden;
   *  only the fact that the round is no longer waiting on them is public. */
  opponentCommitted: boolean;
  /** Seconds left on the round clock, or null outside a match. */
  secondsLeft: number | null;
  myCounters: Record<string, number>;
  opponentCounters: Record<string, number>;
  /** Opponent cards a reveal effect entitled this viewer to see. */
  opponentRevealed: CardMinigameCard[];
  /** How many cards the opponent is holding, so their hand has a place on the
   *  table for a revealed card to be revealed IN. */
  opponentHandCount: number;
  /** Parked modifiers still in play, both sides. */
  activeEffects: CardMinigameEffect[];
}

/** Build the structured Card Duel view from the live IWorld snapshot. */
export function buildCardDuelView(info: CardMinigameInfo): CardDuelViewModel {
  if (!info.match) {
    return {
      state: info.queued ? 'queued' : info.available ? 'idle' : 'unavailable',
      hand: [],
      deckCount: 0,
      discardCount: 0,
      opponentName: '',
      opponentId: '',
      myRounds: 0,
      opponentRounds: 0,
      myHp: 0,
      opponentHp: 0,
      maxHp: 0,
      round: 0,
      waitingOnOpponent: false,
      opponentCommitted: false,
      secondsLeft: null,
      myCounters: {},
      opponentCounters: {},
      opponentRevealed: [],
      opponentHandCount: 0,
      activeEffects: [],
    };
  }
  const m = info.match;
  return {
    state: 'inMatch',
    hand: m.hand.map((card) => ({
      iid: card.iid,
      cardId: card.cardId,
      value: card.value,
      playable: !m.waitingOnOpponent,
      pendingDelta: card.pendingDelta ?? 0,
      ...(card.textValues ? { textValues: { ...card.textValues } } : {}),
    })),
    deckCount: m.deckCount,
    discardCount: m.discardCount,
    opponentName: m.opponent.name,
    opponentId: m.opponent.opponentId ?? '',
    myRounds: m.myRounds,
    opponentRounds: m.opponentRounds,
    myHp: m.myHp,
    opponentHp: m.opponentHp,
    maxHp: m.maxHp,
    round: m.round,
    waitingOnOpponent: m.waitingOnOpponent,
    opponentCommitted: m.opponentCommitted,
    secondsLeft: m.secondsLeft,
    myCounters: { ...m.myCounters },
    opponentCounters: { ...m.opponentCounters },
    opponentRevealed: m.opponentRevealed.map((card) => ({ ...card })),
    opponentHandCount: m.opponentHandCount,
    activeEffects: m.activeEffects.map((effect) => ({ ...effect })),
  };
}
