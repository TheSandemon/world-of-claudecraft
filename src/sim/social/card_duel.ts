// The Card Duel minigame: a class-agnostic 1v1 card game, hosted by the Card
// Master NPC (src/sim/content/card_master.ts). Deliberately NOT built on top of
// src/sim/social/duel.ts's HP-based DuelState: that system is combat-coupled
// (forfeit-by-death, HP dueling range, ccDr clearing) and growing it for a
// non-combat minigame would be the wrong seam. This module owns its own live
// match state on SimContext, following the same "own module behind the seam"
// shape as arena.ts / duel.ts.
//
// The RULES live in src/sim/minigames/card_duel/ and this module orchestrates
// them: it owns the queue, the seats, the clock, the emits, and the deed
// credit, and it calls resolveCardRound for everything that decides a round.
//
// Determinism: every card draw goes through ctx.rng (never Math.random).
// Server-authoritative: rounds resolve here once both sides have played, never
// client-side, and no effect is ever computed by a client.

import {
  buildOpponentDeck,
  CARD_CATALOG,
  type CardOpponentDef,
  DEFAULT_DECK_LIST,
} from '../content/cards';
import { cardMasterInRange } from '../instances/card_master';
import {
  activeCardEffects,
  activeDeckEntries,
  botCommitDelayTicks,
  buildBoard,
  CARD_DUEL_ROUND_DEADLINE_S,
  CARD_DUEL_ROUNDS_TO_WIN,
  type CardBotTier,
  type CardDeckEntry,
  type CardInstance,
  type CardMatchState,
  type CardParkedDuration,
  type CardSeat,
  createCardHand,
  createMatchState,
  pendingValueDelta,
  playCardByInstance,
  resolveCardRound,
  resolveCardTextValues,
  validateDeck,
} from '../minigames/card_duel';
import type { SimContext } from '../sim_context';
import {
  type CardDuelQueue,
  isQueuedForCardDuel,
  joinCardDuelQueue,
  leaveCardDuelQueue,
  tryPairCardDuel,
} from './card_duel_queue';

// The match-shape constants now live in the engine (minigames/card_duel/rules.ts),
// so the standalone slice and the bot read the same numbers this orchestrator
// does. Re-exported here because this module is where every caller and every
// pinned test resolves them.
export { CARD_DUEL_ROUND_DEADLINE_S, CARD_DUEL_ROUNDS_TO_WIN } from '../minigames/card_duel';

export interface CardDuelMatch {
  a: number;
  b: number;
  /** The engine's live match: both seats' zones, modifiers, counters, history. */
  state: CardMatchState;
  roundDeadline: number; // ctx.time this round's AFK deadline expires
  /**
   * Whether ANY card has been played this match. The discriminator between a
   * recorded DRAW (both clocks expired, cards were played) and an unrecorded
   * void (both clocks expired, nothing was ever played). Deliberately NOT the
   * same test as the manual-forfeit void, which turns on whether a round has
   * been WON; conflating the two is the likely bug here.
   */
  anyCardPlayed: boolean;
  /**
   * The computer opponent sitting in seat B, when this is a bot match. A bot
   * match runs the SHIPPING code (same startCardDuelMatch, same resolve.ts);
   * only the pairing step is bypassed.
   */
  bot: {
    opponentId: string;
    tier: CardBotTier;
    /** ctx.tickCount at which the bot commits this round. Counted in TICKS,
     *  never wall clock, so the offline Sim, the server, and the headless env
     *  agree. */
    commitAt: number;
  } | null;
}

/** One card as the owning player's client sees it. */
export interface CardMinigameCard {
  iid: number;
  cardId: string;
  value: number;
  /**
   * The value change parked modifiers would apply if this card were played
   * this round, signed, and absent when it is zero. A PREVIEW of what the
   * viewer already has riding on the card, never a promise: the true effective
   * value also depends on the opponent's hidden card. Sent for the viewer's
   * OWN hand only.
   */
  pendingDelta?: number;
  /**
   * The numbers this card's rules sentence needs, resolved against the LIVE
   * match. Sent for the viewer's own hand so a scaling card ("+1 for every two
   * Beasts you have played") states what it would actually apply right now,
   * rather than the client re-deriving it from match state it deliberately
   * does not have. Absent for a card with no placeholders to fill.
   */
  textValues?: Record<string, number>;
}

// The IWorldCardMinigame read-surface shape (src/world_api/card_minigame.ts
// imports this rather than sim depending on world_api, per the IWorld seam
// direction: world_api reads sim types, never the reverse).
/** The viewer's saved decks, for the builder. Names only: a deck's twenty
 *  cards are sent when the builder asks to edit that deck, not on every
 *  snapshot. */
export interface CardMinigameDecks {
  names: string[];
  active: string;
  /** The active deck's cards, so the builder opens on something real without
   *  a second round trip. */
  activeCards: string[];
}

/** One parked modifier still in play, for the table's effects row. The client
 *  reads the SOURCE CARD's name and rules sentence as the explanation, so no
 *  second copy of the wording rides the wire. */
export interface CardMinigameEffect {
  /** True when it rides the viewer's own cards. */
  mine: boolean;
  cardId: string;
  /** The signed constant it carries, or null for a flag effect. */
  amount: number | null;
  duration: CardParkedDuration;
}

export interface CardMinigameInfo {
  queued: boolean;
  // false when there is no other player in the world to ever pair against
  // (the offline Sim's single-player case): the Join affordance should be
  // hidden/disabled rather than let the player queue forever with no
  // feedback (finding: offline queue never resolves).
  available: boolean;
  decks: CardMinigameDecks;
  match: {
    /**
     * `name` is a PLAYER name and is empty for one of the Card Master's
     * regulars, which has no player meta at all. `opponentId` is the content
     * id of that regular, present only for a bot match: the sim stays
     * language-agnostic, so the client resolves the display name from the id
     * (src/ui/card_i18n.ts) rather than receiving English on the wire.
     */
    opponent: { pid: number; name: string; opponentId?: string };
    hand: CardMinigameCard[];
    deckCount: number;
    discardCount: number;
    myRounds: number;
    opponentRounds: number;
    roundsToWin: number;
    round: number;
    waitingOnOpponent: boolean;
    /** Seconds left on this round's clock, floored at zero. */
    secondsLeft: number;
    /**
     * True once the opponent has locked a card in for this round. The card
     * itself stays hidden (simultaneous hidden selection is the game), but
     * WHOSE commit the round is waiting on is public: without it the pause
     * before a reveal is indistinguishable from a stalled client.
     */
    opponentCommitted: boolean;
    /**
     * How many cards the opponent is holding. Public by the rules (a hand
     * refills to four and a commit takes one), and the thing the revealed set
     * below hangs off: without it there is no opponent hand on the table for a
     * revealed card to be revealed IN.
     */
    opponentHandCount: number;
    /** Parked modifiers still in play, both sides, in creation order. */
    activeEffects: CardMinigameEffect[];
    myCounters: Record<string, number>;
    opponentCounters: Record<string, number>;
    /**
     * Opponent cards this viewer is ENTITLED to see, because a reveal effect
     * fired. Everything else about the opponent's hand, deck, and draws is
     * absent from this projection rather than hidden client-side, so no
     * tampering or packet inspection can recover it.
     */
    opponentRevealed: CardMinigameCard[];
    /** Face values the opponent has played this match, public by the rules. */
    opponentPlayedValues: number[];
  } | null;
}

export function inCardDuel(ctx: SimContext, pid: number): boolean {
  return ctx.cardDuels.has(pid);
}

export function cardDuelMatchFor(ctx: SimContext, pid: number): CardDuelMatch | null {
  return ctx.cardDuels.get(pid) ?? null;
}

/** Which seat a pid holds in a match. */
export function seatOf(match: CardDuelMatch, pid: number): CardSeat {
  return pid === match.a ? 'a' : 'b';
}

function sideFor(match: CardDuelMatch, pid: number) {
  return pid === match.a ? match.state.a : match.state.b;
}

// At least one other QUEUEABLE HUMAN must be present to ever pair off the
// queue. Fiesta and Vale Cup bots share the offline Sim's players map
// (fiesta_bots.ts reaches Sim.addPlayer), but they
// never call joinCardDuelQueue, so counting them here would let the gate
// read "available" while a bot match is live offline, and the human queues
// into a FIFO that can never pair (finding: bots defeat the offline gate).
export function cardMinigameAvailable(ctx: SimContext, pid?: number): boolean {
  for (const [otherPid, meta] of ctx.players) {
    if (otherPid === pid) continue;
    if (meta.isFiestaBot) continue;
    return true;
  }
  return false;
}

export function joinCardMinigameQueue(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  if (r.e.dead) {
    ctx.error(r.meta.entityId, "You can't do that while dead.");
    return;
  }
  if (!cardMasterInRange(ctx, r.e)) {
    ctx.error(r.meta.entityId, 'You must be at the Card Master to queue for a Card Duel.');
    return;
  }
  if (!cardMinigameAvailable(ctx, r.meta.entityId)) {
    ctx.error(r.meta.entityId, 'Card Duel requires another player online.');
    return;
  }
  const result = joinCardDuelQueue(
    ctx.cardDuelQueue,
    r.meta.entityId,
    inCardDuel(ctx, r.meta.entityId),
  );
  if (!result.ok) {
    // Hoisted to two literal ctx.error calls (rather than one ternary-fed
    // call) so the localization_fixes S3 guard's literal-argument scraper
    // actually sees both strings.
    if (result.reason === 'already_in_duel') {
      ctx.error(r.meta.entityId, 'You are already in a Card Duel.');
    } else {
      ctx.error(r.meta.entityId, 'You are already queued for a Card Duel.');
    }
    return;
  }
  ctx.emit({
    type: 'log',
    text: 'You queue for a Card Duel.',
    color: '#fa6',
    pid: r.meta.entityId,
  });
}

export function leaveCardMinigameQueue(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  if (leaveCardDuelQueue(ctx.cardDuelQueue, r.meta.entityId)) {
    ctx.emit({
      type: 'log',
      text: 'You leave the Card Duel queue.',
      color: '#fa6',
      pid: r.meta.entityId,
    });
  }
}

export function isQueuedForCardMinigame(ctx: SimContext, pid: number): boolean {
  return isQueuedForCardDuel(ctx.cardDuelQueue, pid);
}

/**
 * The deck a seat brings to a match, validated HERE rather than trusted from
 * wherever it was stored: a deck that was legal when saved can become illegal
 * as the catalog changes. An illegal deck is replaced with the default and the
 * mismatch logged to the dev channel; the match still starts.
 */
export function deckForPlayer(
  deck: readonly CardDeckEntry[] | undefined,
): readonly CardDeckEntry[] {
  if (!deck) return DEFAULT_DECK_LIST;
  const verdict = validateDeck(deck, CARD_CATALOG);
  if (verdict.ok) return deck;
  console.warn(
    `[card duel] illegal saved deck (${verdict.reason} ${verdict.detail}); using default`,
  );
  return DEFAULT_DECK_LIST;
}

/** Seats a match. Exported for the bots sibling, which starts one directly
 *  against a named regular rather than off the queue. */
export function startCardDuelMatch(
  ctx: SimContext,
  a: number,
  b: number,
  opponent?: CardOpponentDef,
): void {
  const deckA = deckForPlayer(activeDeckEntries(ctx.players.get(a)?.cards, CARD_CATALOG));
  const deckB = opponent
    ? deckForPlayer(buildOpponentDeck(opponent.favours))
    : deckForPlayer(activeDeckEntries(ctx.players.get(b)?.cards, CARD_CATALOG));
  const match: CardDuelMatch = {
    a,
    b,
    state: createMatchState(
      createCardHand(ctx.rng, 'a', deckA),
      createCardHand(ctx.rng, 'b', deckB),
    ),
    roundDeadline: ctx.time + CARD_DUEL_ROUND_DEADLINE_S,
    anyCardPlayed: false,
    bot: opponent
      ? {
          opponentId: opponent.id,
          tier: opponent.difficulty,
          commitAt: ctx.tickCount + botCommitDelayTicks(opponent.difficulty, ctx.rng),
        }
      : null,
  };
  ctx.cardDuels.set(a, match);
  ctx.cardDuels.set(b, match);
  const aMeta = ctx.players.get(a);
  const bMeta = ctx.players.get(b);
  for (const [pid, opponent] of [
    [a, bMeta],
    [b, aMeta],
  ] as const) {
    // A distinct, fully-literal message for the no-opponent-meta arm (rather
    // than interpolating an "?? 'an opponent'" fallback string): root CLAUDE.md
    // bans that pattern in player-visible text, and the S3 i18n guard only
    // scrapes the outer literal so it is blind to a fallback hidden inside a
    // template. The gap is narrow here (both sides were just confirmed live by
    // updateCardDuelQueue's pairing check moments earlier) but not provably
    // unreachable, so it stays handled rather than asserted away.
    ctx.emit({
      type: 'log',
      text: opponent ? `Your Card Duel against ${opponent.name} begins!` : 'Your Card Duel begins!',
      color: '#fa6',
      pid,
    });
    ctx.emit({ type: 'cardDuelMatchStart', pid });
  }
}

// Called every tick from Sim (like updateDuels/updateArena): pairs waiting
// players off the queue and starts a match for each pair.
export function updateCardDuelQueue(ctx: SimContext): void {
  // Sweep stale entries BEFORE pairing, so tryPairCardDuel's shift() never
  // pulls a disconnected or dead pid and silently ejects the still-connected
  // other side of a pair (finding: stale pairing ejects the survivor). Mirrors
  // joinCardMinigameQueue's join-time r.e.dead gate: a queued player who dies
  // before pairing (not just one who disconnects) is dropped too, matching
  // every sibling PvP system (duel.ts forfeits on death; arena.ts
  // resolve desertion) rather than pairing a ghost off the queue.
  for (const pid of [...ctx.cardDuelQueue]) {
    const e = ctx.entities.get(pid);
    if (!ctx.players.has(pid) || !e || e.dead) leaveCardDuelQueue(ctx.cardDuelQueue, pid);
  }
  let pair = tryPairCardDuel(ctx.cardDuelQueue);
  while (pair) {
    const [a, b] = pair;
    // Defense in depth: re-check liveness AND death even though the presweep
    // above should already guarantee both.
    const ea = ctx.entities.get(a);
    const eb = ctx.entities.get(b);
    if (ctx.players.has(a) && ctx.players.has(b) && ea && !ea.dead && eb && !eb.dead) {
      startCardDuelMatch(ctx, a, b);
    }
    pair = tryPairCardDuel(ctx.cardDuelQueue);
  }
}

// Sweeps every live match for an expired per-round clock. ONE clock governs
// everything: thinking time and a dropped connection alike, for both sides at
// once (selection is simultaneous, so "your turn" means the round window).
// Called every tick from Sim, under its own profiler lap marker (distinct from
// the queue pairing phase, since it walks every live match).
export function updateCardDuelDeadlines(ctx: SimContext): void {
  const seen = new Set<number>();
  for (const match of ctx.cardDuels.values()) {
    if (seen.has(match.a)) continue;
    seen.add(match.a);
    seen.add(match.b);
    if (ctx.time < match.roundDeadline) continue;
    const aPlayed = match.state.a.playedThisRound !== null;
    const bPlayed = match.state.b.playedThisRound !== null;
    if (!aPlayed && !bPlayed) {
      // Both clocks expired. If cards were played earlier in the match it is a
      // recorded DRAW; if nothing was ever played it is unrecorded, so nobody
      // can farm a result out of two accounts queueing and going AFK together.
      if (match.anyCardPlayed) drawMatch(ctx, match);
      else voidMatch(ctx, match);
      continue;
    }
    // Whichever side has not played this round forfeits.
    const forfeiterPid = aPlayed ? match.b : match.a;
    forfeitMatch(ctx, match, forfeiterPid);
  }
}

export function playCardInDuel(ctx: SimContext, cardIid: number, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const match = ctx.cardDuels.get(r.meta.entityId);
  if (!match) {
    ctx.error(r.meta.entityId, 'You are not in a Card Duel.');
    return;
  }
  // Mirrors joinCardMinigameQueue's join-time gate: a player who dies mid-match
  // (Card Duel needs no proximity to play, so death is the only way the sim can
  // catch this) cannot keep playing as a ghost. The other side is not left
  // hanging: the existing per-round clock forfeits the dead side exactly like
  // any other unresponsive opponent, so no separate death-triggers-forfeit path
  // is needed here.
  if (r.e.dead) {
    ctx.error(r.meta.entityId, "You can't do that while dead.");
    return;
  }
  const side = sideFor(match, r.meta.entityId);
  if (side.playedThisRound !== null) {
    ctx.error(r.meta.entityId, 'You already played a card this round.');
    return;
  }
  // The one authoritative check that the sender actually holds the card it
  // named: an instance id is validated against that seat's own hand, and a
  // miss is refused rather than resolved into an arbitrary card of that value.
  const played = playCardByInstance(side.cards, cardIid);
  if (played === null) {
    ctx.error(r.meta.entityId, "You don't hold that card.");
    return;
  }
  side.playedThisRound = played;
  match.anyCardPlayed = true;
  ctx.emit({ type: 'cardPlayed', pid: r.meta.entityId });
  if (match.state.a.playedThisRound !== null && match.state.b.playedThisRound !== null) {
    resolveRound(ctx, match);
  }
}

/** Resolves the round both seats have committed to. Exported for the bots
 *  sibling, whose commit can be the second of the two. */
export function resolveRound(ctx: SimContext, match: CardDuelMatch): void {
  const playedA = match.state.a.playedThisRound as CardInstance;
  const playedB = match.state.b.playedThisRound as CardInstance;
  const res = resolveCardRound(match.state, CARD_CATALOG, ctx.rng, {
    onOverflow: (message) => {
      // Dev channel only: this is a content bug (a cyclic card pair), never
      // player-facing text, so it stays English and is not matched client-side.
      console.warn(`[card duel] ${message}`);
    },
  });
  match.roundDeadline = ctx.time + CARD_DUEL_ROUND_DEADLINE_S;
  if (match.bot) {
    match.bot.commitAt = ctx.tickCount + botCommitDelayTicks(match.bot.tier, ctx.rng);
  }
  for (const pid of [match.a, match.b]) {
    const isA = pid === match.a;
    const mine = isA ? res.aValue : res.bValue;
    const theirs = isA ? res.bValue : res.aValue;
    ctx.emit({
      type: 'log',
      text: `Card Duel round: you played ${mine}, opponent played ${theirs}.`,
      color: '#fa6',
      pid,
    });
    ctx.emit({
      type: 'cardRoundResolved',
      mine,
      theirs,
      mineBase: isA ? playedA.value : playedB.value,
      theirsBase: isA ? playedB.value : playedA.value,
      // The two card IDENTITIES, so the reveal can show the cards that
      // actually clashed rather than two bare numbers. Both are public the
      // instant the round resolves: the rules reveal every played card.
      mineCardId: isA ? playedA.cardId : playedB.cardId,
      theirsCardId: isA ? playedB.cardId : playedA.cardId,
      outcome: mine > theirs ? 'win' : mine < theirs ? 'lose' : 'push',
      reshuffled: isA ? res.refillA.reshuffled : res.refillB.reshuffled,
      pid,
    });
  }
  if (match.state.a.roundWins >= CARD_DUEL_ROUNDS_TO_WIN) {
    endCardDuelMatch(ctx, match, match.a);
  } else if (match.state.b.roundWins >= CARD_DUEL_ROUNDS_TO_WIN) {
    endCardDuelMatch(ctx, match, match.b);
  }
}

function endCardDuelMatch(ctx: SimContext, match: CardDuelMatch, winnerPid: number): void {
  ctx.cardDuels.delete(match.a);
  ctx.cardDuels.delete(match.b);
  const loserPid = winnerPid === match.a ? match.b : match.a;
  const winnerMeta = ctx.players.get(winnerPid);
  const loserMeta = ctx.players.get(loserPid);
  // A bot match credits NO PvP progress. `pvp_card_duel_first_win` is a pvp
  // deed reading cardDuelsWon, so crediting a win over a Novice would make the
  // deed a thirty-second formality and the category a lie. Bot-specific
  // rewards, if they are ever wanted, take their own stat and their own deeds.
  if (winnerMeta && !match.bot) ctx.bumpDeedStat(winnerMeta, 'cardDuelsWon', 1);
  // Distinct fully-literal messages for the no-opponent-meta arm (the real
  // edge case named by review: the opponent's meta is gone because they left
  // mid-match, e.g. removePlayer ran between their last card and this round
  // resolving) instead of an "?? 'your opponent'" fallback interpolated into
  // the template: see the matching comment in startCardDuelMatch above. Each
  // side gets its own emit call (rather than one shared ternary-of-ternaries)
  // so every branch stays a single literal-or-simple-ternary `text:` the S3
  // guard's emit scanner can actually see and verify.
  for (const pid of [match.a, match.b]) {
    if (pid === winnerPid) {
      ctx.emit({
        type: 'log',
        text: loserMeta
          ? `You win the Card Duel against ${loserMeta.name}!`
          : 'You win the Card Duel!',
        color: '#fa6',
        pid,
      });
    } else {
      ctx.emit({
        type: 'log',
        text: winnerMeta
          ? `You lose the Card Duel against ${winnerMeta.name}.`
          : 'You lose the Card Duel.',
        color: '#fa6',
        pid,
      });
    }
    ctx.emit({ type: 'cardDuelMatchEnd', won: pid === winnerPid, pid });
  }
}

// Shared forfeit resolution for both the player-issued forfeit action and the
// clock sweep: the forfeiting side loses, the other side wins and is credited
// the deed progress, matching how PvP disconnects/desertion are treated
// elsewhere (arena/Vale Cup desertion). A forfeit used to credit nobody,
// letting a player one round from losing deny the opponent the deed by
// disconnecting; that is now fixed here.
//
// A forfeit before EITHER side has won a round credits nobody: this is the
// same farm hole voidMatch's own comment names (two accounts queueing and
// going AFK together for a free deed credit), just reached through the
// player-issuable card_forfeit command instead of the round clock, and
// strictly EASIER (no wait at all). Route that case through voidMatch instead
// of the win/lose messaging below, making the manual-forfeit and timeout paths
// consistent; a forfeit after at least one round has been won still credits
// the non-forfeiting side normally.
function forfeitMatch(ctx: SimContext, match: CardDuelMatch, forfeiterPid: number): void {
  if (match.state.a.roundWins + match.state.b.roundWins === 0) {
    voidMatch(ctx, match);
    return;
  }
  const winnerPid = forfeiterPid === match.a ? match.b : match.a;
  ctx.cardDuels.delete(match.a);
  ctx.cardDuels.delete(match.b);
  const winnerMeta = ctx.players.get(winnerPid);
  // Same anti-farm rule on the forfeit path: a bot match credits nothing.
  if (winnerMeta && !match.bot) ctx.bumpDeedStat(winnerMeta, 'cardDuelsWon', 1);
  if (ctx.players.has(forfeiterPid)) {
    ctx.emit({
      type: 'log',
      text: 'You forfeit the Card Duel.',
      color: '#fa6',
      pid: forfeiterPid,
    });
    ctx.emit({ type: 'cardDuelMatchEnd', won: false, pid: forfeiterPid });
  }
  if (winnerMeta) {
    ctx.emit({
      type: 'log',
      text: 'Your opponent forfeited the Card Duel. You win!',
      color: '#fa6',
      pid: winnerPid,
    });
    ctx.emit({ type: 'cardDuelMatchEnd', won: true, pid: winnerPid });
  }
}

// Both clocks expired in a match where cards HAD been played: a real result
// that credits nobody. Distinct from voidMatch, which is the unrecorded case
// where nothing was ever played (see CardDuelMatch.anyCardPlayed).
function drawMatch(ctx: SimContext, match: CardDuelMatch): void {
  ctx.cardDuels.delete(match.a);
  ctx.cardDuels.delete(match.b);
  for (const pid of [match.a, match.b]) {
    ctx.emit({
      type: 'log',
      text: 'Your Card Duel ends in a draw.',
      color: '#fa6',
      pid,
    });
    ctx.emit({ type: 'cardDuelMatchEnd', won: false, draw: true, pid });
  }
}

// No side has earned a round win and no card was ever played, so end the match
// with no winner, no draw, and no deed credit. Two callers: both sides let the
// round's clock expire without ever playing, or forfeitMatch delegates here
// when the forfeit happens before either side has won a round (see
// forfeitMatch's comment).
function voidMatch(ctx: SimContext, match: CardDuelMatch): void {
  ctx.cardDuels.delete(match.a);
  ctx.cardDuels.delete(match.b);
  for (const pid of [match.a, match.b]) {
    ctx.emit({
      type: 'log',
      text: 'Your Card Duel is void: neither side played in time.',
      color: '#fa6',
      pid,
    });
    // won: false for both sides is a lie in the timeout case (nobody lost
    // either), but it is the only value the field has: a void match still
    // needs a cue, or an early Forfeit ends the match in total silence while
    // forfeiting a round later correctly plays arenaLoss().
    ctx.emit({ type: 'cardDuelMatchEnd', won: false, pid });
  }
}

// Player-issuable forfeit: lets someone stuck in a live match against an idle
// opponent get out immediately, instead of waiting for the round clock.
// Wired to the window's Leave/Forfeit action while in a live match (the queue
// leave path stays leaveCardMinigameQueue).
export function forfeitCardDuelMatch(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const match = ctx.cardDuels.get(r.meta.entityId);
  if (!match) {
    ctx.error(r.meta.entityId, 'You are not in a Card Duel.');
    return;
  }
  forfeitMatch(ctx, match, r.meta.entityId);
}

// Drops a player from the queue and/or forfeits their live match (leave-path /
// disconnect handling, mirroring duelFor's forfeit-on-death shape). Also
// called from Sim.removePlayer so the offline Sim and headless env never leak
// cardDuels/cardDuelQueue entries for a departed pid.
export function leaveCardMinigameEntirely(ctx: SimContext, pid: number): void {
  leaveCardDuelQueue(ctx.cardDuelQueue, pid);
  const match = ctx.cardDuels.get(pid);
  if (!match) return;
  forfeitMatch(ctx, match, pid);
}

function wireDecks(ctx: SimContext, pid: number): CardMinigameDecks {
  const saved = ctx.players.get(pid)?.cards;
  if (!saved) return { names: [], active: '', activeCards: [] };
  const names = Object.keys(saved.decks).sort();
  return {
    names,
    active: saved.activeDeck,
    activeCards: [...(saved.decks[saved.activeDeck] ?? [])],
  };
}

function wireCard(card: CardInstance): CardMinigameCard {
  return { iid: card.iid, cardId: card.cardId, value: card.value };
}

/** A card in the viewer's OWN hand, with its rules-text numbers priced against
 *  the live match so the face states what it would really apply, and the buff
 *  or debuff already parked on it so the face states what it is worth. */
function wireOwnCard(card: CardInstance, state: CardMatchState, seat: CardSeat): CardMinigameCard {
  const delta = pendingValueDelta(state, seat, card, CARD_CATALOG);
  const base = delta === 0 ? wireCard(card) : { ...wireCard(card), pendingDelta: delta };
  const def = CARD_CATALOG.get(card.cardId);
  if (!def || def.effects.length === 0) return base;
  const values = resolveCardTextValues(def, {
    state,
    board: buildBoard(state, CARD_CATALOG),
    catalog: CARD_CATALOG,
    seat,
    thisCard: card,
  });
  return Object.keys(values).length === 0 ? base : { ...base, textValues: values };
}

// IWorldCardMinigame read surface: the local/queried player's queue/match
// snapshot. Lives here (not on the sim.ts coordinator) because it needs
// nothing from Sim's private state, matching the six thin delegates directly
// above cardMinigameInfoFor on sim.ts.
//
// This is the ONE place opponent information can leak, so it is built per
// viewer and serializes an opponent card ONLY when that instance id sits in
// the opponent's revealed set. An identity the viewer is not entitled to never
// leaves the server, so no client tampering can recover it.
export function buildCardMinigameInfo(ctx: SimContext, pid: number): CardMinigameInfo {
  const match = cardDuelMatchFor(ctx, pid);
  const decks = wireDecks(ctx, pid);
  if (!match) {
    return {
      queued: isQueuedForCardMinigame(ctx, pid),
      available: cardMinigameAvailable(ctx, pid),
      decks,
      match: null,
    };
  }
  const isA = pid === match.a;
  const oppPid = isA ? match.b : match.a;
  const oppMeta = ctx.players.get(oppPid);
  const me = isA ? match.state.a : match.state.b;
  const them = isA ? match.state.b : match.state.a;
  const revealed = [...them.cards.hand, ...them.cards.deck, ...them.cards.discard]
    .filter((card) => them.revealedToOpponent.includes(card.iid))
    .map(wireCard);
  return {
    queued: false,
    available: true,
    decks,
    match: {
      opponent: {
        pid: oppPid,
        name: oppMeta?.name ?? '',
        ...(match.bot ? { opponentId: match.bot.opponentId } : {}),
      },
      hand: me.cards.hand.map((card) => wireOwnCard(card, match.state, isA ? 'a' : 'b')),
      deckCount: me.cards.deck.length,
      discardCount: me.cards.discard.length,
      myRounds: me.roundWins,
      opponentRounds: them.roundWins,
      roundsToWin: CARD_DUEL_ROUNDS_TO_WIN,
      round: match.state.round,
      waitingOnOpponent: me.playedThisRound !== null,
      opponentCommitted: them.playedThisRound !== null,
      opponentHandCount: them.cards.hand.length,
      activeEffects: activeCardEffects(match.state, match.state.round).map((effect) => ({
        mine: effect.seat === (isA ? 'a' : 'b'),
        cardId: effect.sourceCardId,
        amount: effect.amount,
        duration: effect.duration,
      })),
      secondsLeft: Math.max(0, match.roundDeadline - ctx.time),
      myCounters: { ...me.counters },
      opponentCounters: { ...them.counters },
      opponentRevealed: revealed,
      opponentPlayedValues: match.state.history
        .filter((entry) => entry.owner !== (isA ? 'a' : 'b'))
        .map((entry) => entry.value),
    },
  };
}

export type { CardDuelQueue };
