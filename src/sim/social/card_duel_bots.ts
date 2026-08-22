// The Card Duel bot seat: the named regulars a player sits down against, and
// the tick that lets them commit.
//
// A sibling of social/card_duel.ts, following the social/fiesta.ts +
// social/fiesta_bots.ts precedent: the orchestrator owns the match lifecycle,
// this module owns everything that is specific to a computer opponent. The
// match itself runs the SHIPPING code, calling the same startCardDuelMatch and
// resolving through the same resolve.ts; only the pairing step is bypassed.

import { cardOpponentById } from '../content/cards';
import { cardMasterInRange } from '../instances/card_master';
import {
  CARD_DUEL_START_HP,
  type CardBotView,
  chooseCard,
  playCardByInstance,
} from '../minigames/card_duel';
import type { SimContext } from '../sim_context';
import { type CardDuelMatch, inCardDuel, resolveRound, startCardDuelMatch } from './card_duel';
import { leaveCardDuelQueue } from './card_duel_queue';

/**
 * The seat a computer opponent occupies.
 *
 * A reserved pid range, deliberately absent from ctx.players and ctx.entities:
 * fabricating a player entry would leak a fake player into interest scoping,
 * the roster, and removePlayer teardown for no benefit. The orchestrator's
 * no-opponent-meta message arms, which existed as edge cases, become the bot's
 * normal path and resolve its name from the catalog instead.
 */
export const CARD_BOT_PID_BASE = -9000;

export function isCardBotPid(pid: number): boolean {
  return pid <= CARD_BOT_PID_BASE;
}

/**
 * Starts a match against one of the Card Master's regulars, directly.
 *
 * The bot does NOT join the matchmaking FIFO. Picking a regular starts a match
 * here, which keeps the queue exactly what it is (a human-versus-human path),
 * needs no change to cardMinigameAvailable, and cannot leave an offline world
 * hanging at "waiting for an opponent". Only the pairing step is bypassed: the
 * match itself runs the shipping code.
 */
export function startCardDuelAgainstOpponent(
  ctx: SimContext,
  opponentId: string,
  pid?: number,
): void {
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
  if (inCardDuel(ctx, r.meta.entityId)) {
    ctx.error(r.meta.entityId, 'You are already in a Card Duel.');
    return;
  }
  const opponent = cardOpponentById(opponentId);
  if (!opponent) {
    ctx.error(r.meta.entityId, 'That opponent is not at the table.');
    return;
  }
  // Leaving the queue first: a player who picks a regular while waiting for a
  // human should not still be holding a place in the FIFO.
  leaveCardDuelQueue(ctx.cardDuelQueue, r.meta.entityId);
  startCardDuelMatch(ctx, r.meta.entityId, botSeatPid(ctx), opponent);
}

/** A free reserved pid for a bot seat. Deterministic: it walks up from the
 *  base until it finds one no live match is using. */
function botSeatPid(ctx: SimContext): number {
  let pid = CARD_BOT_PID_BASE;
  while (ctx.cardDuels.has(pid)) pid -= 1;
  return pid;
}

/** The projection the bot policy consumes: the SAME per-viewer shape a human
 *  client receives, which is what makes the bot provably unable to peek. */
function botViewOf(match: CardDuelMatch): CardBotView {
  const me = match.state.b;
  const them = match.state.a;
  return {
    hand: me.cards.hand,
    deckCount: me.cards.deck.length,
    discardCount: me.cards.discard.length,
    myRounds: me.roundWins,
    opponentRounds: them.roundWins,
    myHp: me.hp,
    opponentHp: them.hp,
    maxHp: CARD_DUEL_START_HP,
    round: match.state.round,
    myCounters: me.counters,
    opponentCounters: them.counters,
    opponentRevealed: [...them.cards.hand, ...them.cards.deck, ...them.cards.discard].filter(
      (card) => them.revealedToOpponent.includes(card.iid),
    ),
    opponentPlayedValues: match.state.history
      .filter((entry) => entry.owner === 'a')
      .map((entry) => entry.value),
  };
}

/**
 * Lets every live bot seat commit once its tick-counted delay has passed.
 * Called every tick from Sim beside the deadline sweep.
 *
 * The delay exists because simultaneous hidden selection is the game's
 * identity: an opponent that locks in the instant the round opens both breaks
 * the feel and quietly announces itself as a bot. It always fits inside the
 * round window, so a bot can never time itself out.
 */
export function updateCardDuelBots(ctx: SimContext): void {
  const seen = new Set<number>();
  for (const match of ctx.cardDuels.values()) {
    if (seen.has(match.a)) continue;
    seen.add(match.a);
    seen.add(match.b);
    const bot = match.bot;
    if (!bot) continue;
    if (match.state.b.playedThisRound !== null) continue;
    if (ctx.tickCount < bot.commitAt) continue;
    const pick = chooseCard(botViewOf(match), ctx.rng, bot.tier);
    if (pick === null) continue;
    const played = playCardByInstance(match.state.b.cards, pick);
    if (!played) continue;
    match.state.b.playedThisRound = played;
    match.anyCardPlayed = true;
    if (match.state.a.playedThisRound !== null) resolveRound(ctx, match);
  }
}
