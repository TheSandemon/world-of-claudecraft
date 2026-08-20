// The standalone Card Duel slice, minus the DOM: a hot-seat match driven by
// the REAL engine (src/sim/minigames/card_duel/), never a copy of it.
//
// Composing the shipping rules is the whole point. A drifted test harness is
// worse than none, so this module holds only what a world-less two-sided
// session needs on top: which seat is a bot, whether both seats have committed,
// the resolution log, and the match-over check. Everything else is imported.
//
// Pure and DOM-free, so tests/cards_slice_core.test.ts drives it directly and
// the scriptable match runner (the thing that makes a large catalog tractable)
// is just a loop over `stepMatch`.

import {
  BASIC_DECK_LIST,
  CARD_DUEL_ROUNDS_TO_WIN,
  type CardBotTier,
  type CardBotView,
  type CardCatalog,
  type CardDeckEntry,
  type CardInstance,
  type CardMatchState,
  type CardSeat,
  chooseCard,
  createCardHand,
  createMatchState,
  type HandInstanceId,
  playCardByInstance,
  resolveCardRound,
  withBasicCards,
} from '../sim/minigames/card_duel';
import { Rng } from '../sim/rng';

/** One resolved round, for the step-through view and the sweep runner. */
export interface CardSliceRound {
  round: number;
  aCard: CardInstance | null;
  bCard: CardInstance | null;
  aValue: number;
  bValue: number;
  winner: CardSeat | null;
  steps: number;
  overflow: boolean;
  reshuffled: boolean;
}

export interface CardSliceOptions {
  seed: number;
  /** Which seats the computer plays, so a session can be hot-seat, one bot, or
   *  fully self-playing (which turns the slice into an engine soak test). */
  bots?: Partial<Record<CardSeat, CardBotTier | null>>;
  deckA?: readonly CardDeckEntry[];
  deckB?: readonly CardDeckEntry[];
  catalog?: CardCatalog;
  roundsToWin?: number;
}

export interface CardSliceState {
  seed: number;
  rng: Rng;
  catalog: CardCatalog;
  match: CardMatchState;
  bots: Record<CardSeat, CardBotTier | null>;
  roundsToWin: number;
  log: CardSliceRound[];
  /** Set once a seat reaches roundsToWin; null while the match is live. */
  winner: CardSeat | null;
  over: boolean;
  /** Dev-channel messages (a resolution overflow). English: this is a
   *  diagnostic channel, not player text. */
  notes: string[];
}

/** Starts a fresh session. The seed alone reproduces an exact shuffle, which is
 *  what makes a reported card interaction re-playable. */
export function createSlice(opts: CardSliceOptions): CardSliceState {
  const rng = new Rng(opts.seed);
  const catalog = withBasicCards(opts.catalog ?? { get: () => undefined });
  const match = createMatchState(
    createCardHand(rng, 'a', opts.deckA ?? BASIC_DECK_LIST),
    createCardHand(rng, 'b', opts.deckB ?? BASIC_DECK_LIST),
  );
  return {
    seed: opts.seed,
    rng,
    catalog,
    match,
    bots: { a: opts.bots?.a ?? null, b: opts.bots?.b ?? null },
    roundsToWin: opts.roundsToWin ?? CARD_DUEL_ROUNDS_TO_WIN,
    log: [],
    winner: null,
    over: false,
    notes: [],
  };
}

export function seatState(state: CardSliceState, seat: CardSeat) {
  return seat === 'a' ? state.match.a : state.match.b;
}

/**
 * The per-viewer projection: exactly what that seat's client would receive.
 * The bot consumes this and nothing else, which is what makes it provably
 * unable to peek at the opponent's hand.
 */
export function viewFor(state: CardSliceState, seat: CardSeat): CardBotView {
  const me = seatState(state, seat);
  const them = seatState(state, seat === 'a' ? 'b' : 'a');
  const revealedIds = them.revealedToOpponent;
  const revealed = [...them.cards.hand, ...them.cards.deck, ...them.cards.discard].filter((c) =>
    revealedIds.includes(c.iid),
  );
  return {
    hand: me.cards.hand,
    deckCount: me.cards.deck.length,
    discardCount: me.cards.discard.length,
    myRounds: me.roundWins,
    opponentRounds: them.roundWins,
    roundsToWin: state.roundsToWin,
    round: state.match.round,
    myCounters: me.counters,
    opponentCounters: them.counters,
    opponentRevealed: revealed,
    opponentPlayedValues: state.match.history
      .filter((entry) => entry.owner !== seat)
      .map((entry) => entry.value),
  };
}

/** Commits one seat's card for the round. Returns false when the seat has
 *  already committed, the match is over, or the hand does not hold that card:
 *  the same three rejections the server path makes. */
export function commitCard(state: CardSliceState, seat: CardSeat, iid: HandInstanceId): boolean {
  if (state.over) return false;
  const side = seatState(state, seat);
  if (side.playedThisRound) return false;
  const played = playCardByInstance(side.cards, iid);
  if (!played) return false;
  side.playedThisRound = played;
  return true;
}

/** Lets a bot seat commit. Returns false when the seat is not a bot, has
 *  already committed, or has nothing to play. */
export function commitBot(state: CardSliceState, seat: CardSeat): boolean {
  const tier = state.bots[seat];
  if (!tier || state.over) return false;
  const side = seatState(state, seat);
  if (side.playedThisRound) return false;
  const pick = chooseCard(viewFor(state, seat), state.rng, tier);
  return pick === null ? false : commitCard(state, seat, pick);
}

/** True once both seats have locked a card in. */
export function bothCommitted(state: CardSliceState): boolean {
  return state.match.a.playedThisRound !== null && state.match.b.playedThisRound !== null;
}

/**
 * Resolves the round both seats have committed to, appends it to the log, and
 * ends the match if a seat has reached the win threshold. Returns the resolved
 * round, or null when the round is not ready.
 */
export function resolveSliceRound(state: CardSliceState): CardSliceRound | null {
  if (state.over || !bothCommitted(state)) return null;
  const aCard = state.match.a.playedThisRound;
  const bCard = state.match.b.playedThisRound;
  const round = state.match.round;
  const res = resolveCardRound(state.match, state.catalog, state.rng, {
    onOverflow: (message) => state.notes.push(message),
  });
  const entry: CardSliceRound = {
    round,
    aCard,
    bCard,
    aValue: res.aValue,
    bValue: res.bValue,
    winner: res.winner,
    steps: res.steps,
    overflow: res.overflow,
    reshuffled: res.refillA.reshuffled || res.refillB.reshuffled,
  };
  state.log.push(entry);
  for (const seat of ['a', 'b'] as const) {
    if (seatState(state, seat).roundWins >= state.roundsToWin) {
      state.winner = seat;
      state.over = true;
    }
  }
  return entry;
}

/**
 * One step of the session: let any bot seat commit, then resolve if both sides
 * are in. Returns true when it moved the session forward, so a caller can loop
 * until it returns false (a human seat is being waited on, or the match ended).
 */
export function stepMatch(state: CardSliceState): boolean {
  if (state.over) return false;
  let moved = false;
  for (const seat of ['a', 'b'] as const) {
    if (commitBot(state, seat)) moved = true;
  }
  if (bothCommitted(state)) {
    resolveSliceRound(state);
    return true;
  }
  return moved;
}

/**
 * Runs a fully-botted session to completion. The scriptable match runner: this
 * is what makes sweeping a large catalog tractable, and what turns the slice
 * into an engine soak test rather than a hot-seat toy.
 *
 * `maxRounds` is a hard stop so a pathological pair of decks cannot hang the
 * caller (the engine's own per-round ceiling covers the inside of a round).
 */
export function runToCompletion(state: CardSliceState, maxRounds = 200): CardSliceState {
  for (let i = 0; i < maxRounds && !state.over; i++) {
    if (!stepMatch(state)) break;
  }
  return state;
}
