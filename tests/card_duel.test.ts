import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CARD_MASTER_NPC_ID } from '../src/sim/content/card_master';
import { CARD_CATALOG, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import type { CardInstance } from '../src/sim/minigames/card_duel';
import { validateDeck } from '../src/sim/minigames/card_duel';
import { Rng } from '../src/sim/rng';
import type { PlayerMeta } from '../src/sim/sim';
import type { SimContext } from '../src/sim/sim_context';
import type { CardDuelMatch } from '../src/sim/social/card_duel';
import {
  buildCardMinigameInfo,
  CARD_DUEL_ROUND_DEADLINE_S,
  CARD_DUEL_START_HP,
  cardDuelMatchFor,
  deckForPlayer,
  forfeitCardDuelMatch,
  joinCardMinigameQueue,
  leaveCardMinigameEntirely,
  leaveCardMinigameQueue,
  playCardInDuel,
  updateCardDuelDeadlines,
  updateCardDuelQueue,
} from '../src/sim/social/card_duel';
import type { Entity } from '../src/sim/types';
import { cardOfValue, handValues } from './helpers/card_duel_fixtures';

function makeCtx(
  overrides: Partial<{ dead: Set<number>; extraPlayers: number[]; time: number }> = {},
) {
  const dead = overrides.dead ?? new Set<number>();
  const players = new Map<number, PlayerMeta>();
  const entities = new Map<number, Entity>();
  const bumpDeedStat = vi.fn();
  const error = vi.fn();
  const emit = vi.fn();
  const ctxState = { time: overrides.time ?? 0 };

  const pids = overrides.extraPlayers ? [1, 2, 3, ...overrides.extraPlayers] : [1, 2, 3];
  for (const pid of pids) {
    players.set(pid, { entityId: pid, name: `Player${pid}` } as unknown as PlayerMeta);
    entities.set(pid, { id: pid, pos: { x: 0, y: 0, z: 0 }, dead: dead.has(pid) } as Entity);
  }
  // The Card Master NPC, standing at the same spot so every test pid is in range.
  entities.set(1000, {
    id: 1000,
    kind: 'npc',
    templateId: CARD_MASTER_NPC_ID,
    pos: { x: 0, y: 0, z: 0 },
  } as unknown as Entity);

  const ctx = {
    rng: new Rng(7),
    players,
    entities,
    cardDuelQueue: [] as number[],
    cardDuels: new Map(),
    bumpDeedStat,
    error,
    emit,
    get time() {
      return ctxState.time;
    },
    set time(v: number) {
      ctxState.time = v;
    },
    resolve: (pid?: number) => {
      if (pid === undefined) return null;
      const meta = players.get(pid);
      const e = entities.get(pid);
      if (!meta || !e) return null;
      return { meta, e };
    },
  } as unknown as SimContext & { time: number };
  return { ctx, players, entities, bumpDeedStat, error, emit };
}

// A hand holds CardInstances, so a test names the exact card it wants to play
// rather than a value: two cards of one value are different cards now.
function highestCard(hand: readonly CardInstance[]): CardInstance {
  return [...hand].sort((x, y) => y.value - x.value || x.iid - y.iid)[0];
}

function lowestCard(hand: readonly CardInstance[]): CardInstance {
  return [...hand].sort((x, y) => x.value - y.value || x.iid - y.iid)[0];
}

/** Forces a decisive round: side A plays a 9, side B a 1. */
function playHighLow(ctx: SimContext, match: CardDuelMatch): void {
  match.state.a.cards.hand[0] = cardOfValue(9);
  match.state.b.cards.hand[0] = cardOfValue(1);
  playCardInDuel(ctx, match.state.a.cards.hand[0].iid, 1);
  playCardInDuel(ctx, match.state.b.cards.hand[0].iid, 2);
}

/**
 * Moves the clock past the telling of the round that just resolved.
 *
 * Play is CLOSED for that window (the round is still being narrated and the
 * round clock is held for exactly it), so a test that drives round after round
 * has to wait it out just as a player does. Without this, every play after the
 * first is refused and the match never advances.
 */
function skipNarration(ctx: SimContext, match: CardDuelMatch): void {
  if (match.resolvingUntil > ctx.time) {
    (ctx as unknown as { time: number }).time = match.resolvingUntil;
  }
}

describe('card_duel', () => {
  it('joining requires standing at the Card Master and queues the player', () => {
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    expect(error).not.toHaveBeenCalled();
    expect(ctx.cardDuelQueue).toEqual([1]);
  });

  it('refuses to queue a dead player', () => {
    const { ctx, error } = makeCtx({ dead: new Set([1]) });
    joinCardMinigameQueue(ctx, 1);
    expect(error).toHaveBeenCalled();
    expect(ctx.cardDuelQueue).toEqual([]);
  });

  it('refuses to queue when no other player is present (offline single-player case)', () => {
    const players = new Map<number, PlayerMeta>();
    const entities = new Map<number, Entity>();
    const error = vi.fn();
    players.set(1, { entityId: 1, name: 'Solo' } as unknown as PlayerMeta);
    entities.set(1, { id: 1, pos: { x: 0, y: 0, z: 0 }, dead: false } as Entity);
    entities.set(1000, {
      id: 1000,
      kind: 'npc',
      templateId: CARD_MASTER_NPC_ID,
      pos: { x: 0, y: 0, z: 0 },
    } as unknown as Entity);
    const ctx = {
      rng: new Rng(7),
      players,
      entities,
      cardDuelQueue: [] as number[],
      cardDuels: new Map(),
      bumpDeedStat: vi.fn(),
      error,
      emit: vi.fn(),
      time: 0,
      resolve: (pid?: number) => {
        if (pid === undefined) return null;
        const meta = players.get(pid);
        const e = entities.get(pid);
        if (!meta || !e) return null;
        return { meta, e };
      },
    } as unknown as SimContext;
    joinCardMinigameQueue(ctx, 1);
    expect(error).toHaveBeenCalledWith(1, 'ClaudeStone requires another player online.');
    expect(ctx.cardDuelQueue).toEqual([]);
  });

  it('pairs two queued players into a live match on the next update', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    expect(ctx.cardDuelQueue.length).toBe(0);
    const match = cardDuelMatchFor(ctx, 1);
    expect(match).not.toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBe(match);
  });

  it('a stale (disconnected) pairing does not eject the surviving queued player', () => {
    const { ctx, players } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    // pid 1 disconnects between queueing and the next pairing sweep.
    players.delete(1);
    updateCardDuelQueue(ctx);
    // pid 1's stale entry is swept, but pid 2 is neither dropped nor
    // silently ejected: it stays queued for the next pairing.
    expect(ctx.cardDuelQueue).toEqual([2]);
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
  });

  it('a queued player who dies before pairing is swept off the queue, not paired as a ghost', () => {
    const { ctx, entities } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    // pid 1 dies between queueing and the next pairing sweep (mirrors the
    // disconnect presweep above: joinCardMinigameQueue already blocks a dead
    // pid at JOIN time, but nothing previously caught a death after joining).
    (entities.get(1) as { dead: boolean }).dead = true;
    updateCardDuelQueue(ctx);
    expect(ctx.cardDuelQueue).toEqual([2]);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
  });

  it('a player who dies mid-match cannot keep playing as a ghost', () => {
    const { ctx, entities, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    (entities.get(1) as { dead: boolean }).dead = true;
    const card = match.state.a.cards.hand[0];
    playCardInDuel(ctx, card.iid, 1);
    expect(error).toHaveBeenCalledWith(1, "You can't do that while dead.");
    // The blocked attempt did not consume the card or record a play.
    expect(cardDuelMatchFor(ctx, 1)?.state.a.cards.hand).toContain(card);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.playedThisRound).toBeNull();
  });

  it('refuses a card played while the last round is still being told', () => {
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    playHighLow(ctx, match);
    // The round has resolved and the hand has refilled, but the telling is
    // still running and the round clock is held for exactly it. A card played
    // now would interrupt the round the player is still watching.
    expect(match.resolvingUntil).toBeGreaterThan(ctx.time);
    const held = match.state.a.cards.hand[0];
    playCardInDuel(ctx, held.iid, 1);
    expect(error).toHaveBeenCalledWith(1, 'Wait for the round to finish playing out.');
    // Refused, not silently swallowed: the card is still in hand and no commit
    // was recorded, so the next round starts from an untouched seat.
    expect(cardDuelMatchFor(ctx, 1)?.state.a.cards.hand).toContain(held);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.playedThisRound).toBeNull();
  });

  it('accepts a card the instant the telling ends, which is when the clock restarts', () => {
    // The refusal above costs no think time BECAUSE the two are one number:
    // play reopens at exactly the moment the round clock starts counting again.
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    playHighLow(ctx, match);
    expect(match.roundDeadline).toBe(match.resolvingUntil + CARD_DUEL_ROUND_DEADLINE_S);
    (ctx as unknown as { time: number }).time = match.resolvingUntil;
    const card = match.state.a.cards.hand[0];
    playCardInDuel(ctx, card.iid, 1);
    expect(error).not.toHaveBeenCalled();
    expect(cardDuelMatchFor(ctx, 1)?.state.a.playedThisRound).toBe(card);
  });

  it('resolves a full match to a winner and bumps cardDuelsWon exactly once', () => {
    const { ctx, bumpDeedStat, players } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);

    // Drive rounds until the match ends (best-of-3). Side A always plays its
    // highest card and side B its lowest, which reliably breaks pushes so the
    // match converges instead of tying forever.
    let guard = 0;
    let winnerPid = 1;
    while (cardDuelMatchFor(ctx, 1) !== null && guard < 500) {
      const match = cardDuelMatchFor(ctx, 1);
      if (!match) break;
      skipNarration(ctx, match);
      playCardInDuel(ctx, highestCard(match.state.a.cards.hand).iid, 1);
      playCardInDuel(ctx, lowestCard(match.state.b.cards.hand).iid, 2);
      // Every card carries effects now, so "A spent its highest card" no longer
      // means A took the round: a 2 that reads +21 beats a 9. Read the winner
      // off the health the match is actually decided on rather than assuming
      // the seat, which keeps the credit assertion below pointed at the WINNER
      // (a loser-credited bug still fails) without asserting a premise the
      // catalog no longer guarantees.
      winnerPid = match.state.a.hp >= match.state.b.hp ? 1 : 2;
      guard++;
    }
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(bumpDeedStat).toHaveBeenCalledTimes(1);
    // The credited meta must be the WINNER's, not just some meta: a
    // loser-credited bug would pass without this.
    expect(bumpDeedStat.mock.calls[0][0]).toBe(players.get(winnerPid));
    expect(bumpDeedStat.mock.calls[0][1]).toBe('cardDuelsWon');
    expect(bumpDeedStat.mock.calls[0][2]).toBe(1);
  });

  it('a tie round (a push) scores neither side and does not end the match', () => {
    const { ctx, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // Force both hands to hold a shared value (5) regardless of the actual
    // deal, so the round resolves as a deterministic push (a === b) without
    // depending on the fixed rng's exact draw.
    for (const side of [match.state.a, match.state.b]) {
      if (!side.cards.hand.some((c) => c.value === 5)) side.cards.hand[0] = cardOfValue(5);
    }
    const fiveA = match.state.a.cards.hand.find((c) => c.value === 5) as CardInstance;
    const fiveB = match.state.b.cards.hand.find((c) => c.value === 5) as CardInstance;
    playCardInDuel(ctx, fiveA.iid, 1);
    playCardInDuel(ctx, fiveB.iid, 2);
    const after = cardDuelMatchFor(ctx, 1);
    expect(after).not.toBeNull();
    expect(after?.state.a.roundWins).toBe(0);
    expect(after?.state.b.roundWins).toBe(0);
    expect(bumpDeedStat).not.toHaveBeenCalled();
  });

  it('rejects playing a card not in hand', () => {
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // An instance id the hand does not hold: the exact rejection the server
    // path relies on when a client names a card it does not have.
    const heldIids = new Set(match.state.a.cards.hand.map((c) => c.iid));
    const notHeld = cardOfValue(5).iid;
    expect(heldIids.has(notHeld)).toBe(false);
    playCardInDuel(ctx, notHeld, 1);
    expect(error).toHaveBeenCalledWith(1, "You don't hold that card.");
  });

  it('rejects playing a second card in the same round before the opponent has played', () => {
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    const [first, second] = match.state.a.cards.hand;
    playCardInDuel(ctx, first.iid, 1);
    playCardInDuel(ctx, second.iid, 1);
    expect(error).toHaveBeenCalledWith(1, 'You already played a card this round.');
    // The second attempt did not consume the card: hand still holds it.
    expect(cardDuelMatchFor(ctx, 1)?.state.a.cards.hand).toContain(second);
  });

  it('rejects playing a card when not in any match', () => {
    const { ctx, error } = makeCtx();
    playCardInDuel(ctx, 5000, 3);
    expect(error).toHaveBeenCalledWith(3, 'You are not in a ClaudeStone match.');
  });

  it('leaving the queue removes the pid without touching a live match', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 3);
    leaveCardMinigameQueue(ctx, 3);
    expect(ctx.cardDuelQueue).toEqual([]);
  });

  it('leaveCardMinigameEntirely forfeits a live match and credits the opponent a win', () => {
    const { ctx, emit, bumpDeedStat, players } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // Play out one full round first so roundsA + roundsB > 0: a forfeit
    // before either side has won a round voids instead of crediting a win
    // (finding 3, the same anti-farm gate as the both-idle AFK case), so
    // exercising the CREDIT path here needs a round already on the board.
    playHighLow(ctx, match);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.roundWins).toBe(1);
    leaveCardMinigameEntirely(ctx, 1);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your opponent forfeited the ClaudeStone match. You win!',
        pid: 2,
      }),
    );
    expect(bumpDeedStat).toHaveBeenCalledTimes(1);
    expect(bumpDeedStat.mock.calls[0][0]).toBe(players.get(2));
    expect(bumpDeedStat.mock.calls[0][1]).toBe('cardDuelsWon');
  });

  it('forfeitMatch voids a zero-round forfeit instead of crediting a win (anti-farm gate)', () => {
    const { ctx, emit, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
    // Instant forfeit the moment the match starts, before either side has
    // played a single card or won a round: two colluding accounts sending
    // card_forfeit immediately is strictly easier than the both-idle AFK farm
    // voidMatch was already built to close, so this must close the same way.
    forfeitCardDuelMatch(ctx, 1);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(bumpDeedStat).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your ClaudeStone match is void: neither side played in time.',
        pid: 1,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your ClaudeStone match is void: neither side played in time.',
        pid: 2,
      }),
    );
    // Neither the forfeit-specific nor the win-credit messaging fires: this is
    // routed through voidMatch, not the normal forfeit win/lose lines.
    expect(emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: 'You forfeit the ClaudeStone match.' }),
    );
    expect(emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Your opponent forfeited the ClaudeStone match. You win!' }),
    );
  });

  it('forfeitMatch still credits normally once at least one round has been won', () => {
    const { ctx, emit, bumpDeedStat, players } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    playHighLow(ctx, match);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.roundWins).toBe(1);
    forfeitCardDuelMatch(ctx, 2);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(bumpDeedStat).toHaveBeenCalledTimes(1);
    expect(bumpDeedStat.mock.calls[0][0]).toBe(players.get(1));
    expect(bumpDeedStat.mock.calls[0][1]).toBe('cardDuelsWon');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'You forfeit the ClaudeStone match.', pid: 2 }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your opponent forfeited the ClaudeStone match. You win!',
        pid: 1,
      }),
    );
  });

  it('forfeitCardDuelMatch lets a player in a live match forfeit on demand and re-queue afterward', () => {
    const { ctx, error } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
    forfeitCardDuelMatch(ctx, 1);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    // The player is now free to re-queue: before the fix this errored
    // 'already_in_duel' forever, since nothing ever cleared ctx.cardDuels.
    joinCardMinigameQueue(ctx, 1);
    expect(error).not.toHaveBeenCalledWith(1, 'You are already in a ClaudeStone match.');
    expect(ctx.cardDuelQueue).toContain(1);
  });

  it('forfeitCardDuelMatch errors when not in a live match', () => {
    const { ctx, error } = makeCtx();
    forfeitCardDuelMatch(ctx, 3);
    expect(error).toHaveBeenCalledWith(3, 'You are not in a ClaudeStone match.');
  });

  it('an expired round deadline forfeits the side that never played the round', () => {
    const { ctx, emit, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // Play out one full round first so roundsA + roundsB > 0 (finding 3's
    // anti-farm gate voids an AFK forfeit before any round has been won, same
    // as the both-idle case), so this exercises the CREDIT path deliberately.
    playHighLow(ctx, match);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.roundWins).toBe(1);
    // Side A plays round 2; side B goes idle (an unresponsive opponent).
    const live = cardDuelMatchFor(ctx, 1);
    if (!live) throw new Error('expected a live match');
    skipNarration(ctx, live);
    playCardInDuel(ctx, live.state.a.cards.hand[0].iid, 1);
    (ctx as unknown as { time: number }).time = live.roundDeadline + 1;
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(bumpDeedStat).toHaveBeenCalledTimes(1);
    expect(bumpDeedStat.mock.calls[0][1]).toBe('cardDuelsWon');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'You forfeit the ClaudeStone match.', pid: 2 }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your opponent forfeited the ClaudeStone match. You win!',
        pid: 1,
      }),
    );
  });

  it('an expired round deadline forfeits side A when A is the one who went idle (mirror arm)', () => {
    const { ctx, emit, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // Play out one full round first so roundsA + roundsB > 0 (see the sibling
    // test above for why the zero-round anti-farm gate requires this here).
    playHighLow(ctx, match);
    expect(cardDuelMatchFor(ctx, 1)?.state.a.roundWins).toBe(1);
    // Side B plays round 2; side A goes idle. Without this arm, a regression
    // that always forfeits match.b (the constant that also satisfies the
    // other test) would go undetected.
    const live = cardDuelMatchFor(ctx, 1);
    if (!live) throw new Error('expected a live match');
    skipNarration(ctx, live);
    playCardInDuel(ctx, live.state.b.cards.hand[0].iid, 2);
    (ctx as unknown as { time: number }).time = live.roundDeadline + 1;
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(bumpDeedStat).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'You forfeit the ClaudeStone match.', pid: 1 }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your opponent forfeited the ClaudeStone match. You win!',
        pid: 2,
      }),
    );
  });

  it('an expired round deadline with both sides idle voids the match without crediting anyone', () => {
    const { ctx, emit, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // Neither side plays a card before the deadline expires.
    (ctx as unknown as { time: number }).time = match.roundDeadline + 1;
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(cardDuelMatchFor(ctx, 2)).toBeNull();
    expect(bumpDeedStat).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your ClaudeStone match is void: neither side played in time.',
        pid: 1,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Your ClaudeStone match is void: neither side played in time.',
        pid: 2,
      }),
    );
  });

  it('a normally progressing match refreshes its deadline each round and never auto-forfeits', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    const startDeadline = match.roundDeadline;
    // Advance sim time to just before the deadline started at, then resolve
    // a round: without the per-round refresh, the match would auto-forfeit one
    // clock after it STARTED rather than after its last completed round.
    (ctx as unknown as { time: number }).time = startDeadline - 1;
    playCardInDuel(ctx, match.state.a.cards.hand[0].iid, 1);
    playCardInDuel(ctx, match.state.b.cards.hand[0].iid, 2);
    expect(match.roundDeadline).toBeGreaterThan(startDeadline - 1);
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
  });

  it('both clocks expiring AFTER a card was played is a recorded draw, crediting nobody', () => {
    const { ctx, emit, bumpDeedStat } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // One full round is played, so the match HAS content...
    playCardInDuel(ctx, match.state.a.cards.hand[0].iid, 1);
    playCardInDuel(ctx, match.state.b.cards.hand[0].iid, 2);
    expect(match.anyCardPlayed).toBe(true);
    // ...then both sides go idle and the clock runs out on the next round.
    (ctx as unknown as { time: number }).time = match.roundDeadline + 1;
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
    expect(bumpDeedStat).not.toHaveBeenCalled();
    for (const pid of [1, 2]) {
      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Your ClaudeStone match ends in a draw.', pid }),
      );
      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cardDuelMatchEnd', won: false, draw: true, pid }),
      );
    }
  });

  it('the draw and the void turn on DIFFERENT questions, and conflating them is the bug', () => {
    // draw vs unrecorded splits on whether any CARD was played; the manual
    // forfeit void splits on whether any ROUND was won. A match with one
    // push has cards played but no round won: it draws on the clock, and
    // voids on a manual forfeit.
    const { ctx, emit } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    const five = cardOfValue(5);
    const otherFive = cardOfValue(5);
    match.state.a.cards.hand[0] = five;
    match.state.b.cards.hand[0] = otherFive;
    playCardInDuel(ctx, five.iid, 1);
    playCardInDuel(ctx, otherFive.iid, 2);
    // A push: cards played, no round won.
    expect(match.state.a.roundWins + match.state.b.roundWins).toBe(0);
    expect(match.anyCardPlayed).toBe(true);
    (ctx as unknown as { time: number }).time = match.roundDeadline + 1;
    updateCardDuelDeadlines(ctx);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Your ClaudeStone match ends in a draw.', pid: 1 }),
    );
  });

  it('refills both hands back to four after every round', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    expect(match.state.a.cards.hand.length).toBe(4);
    playCardInDuel(ctx, match.state.a.cards.hand[0].iid, 1);
    playCardInDuel(ctx, match.state.b.cards.hand[0].iid, 2);
    // Refill, not draw-one: the hand is back to four even though a card left it.
    expect(match.state.a.cards.hand.length).toBe(4);
    expect(match.state.b.cards.hand.length).toBe(4);
  });

  it('deals both seats a legal twenty-card deck from the shipping catalog', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    for (const side of [match.state.a, match.state.b]) {
      const pool = [...side.cards.hand, ...side.cards.deck, ...side.cards.discard];
      expect(pool.length).toBe(20);
      const entries = pool.map((c) => ({ cardId: c.cardId, value: c.value }));
      expect(validateDeck(entries, CARD_CATALOG).ok).toBe(true);
      // Every dealt card resolves in the catalog, so no effect can silently
      // fail to fire because its definition is missing.
      for (const card of pool) expect(CARD_CATALOG.get(card.cardId)).toBeDefined();
    }
  });

  it('replaces an illegal saved deck with the default rather than refusing the match', () => {
    // A deck legal when saved can become illegal as the catalog changes, so
    // the authoritative host validates at every match start, never on save
    // alone, and degrades instead of blocking play.
    const illegal = [{ cardId: 'briarpack_wolves_howl', value: 3 as const }];
    expect(deckForPlayer(illegal)).toBe(DEFAULT_DECK_LIST);
    expect(deckForPlayer(undefined)).toBe(DEFAULT_DECK_LIST);
    expect(deckForPlayer(DEFAULT_DECK_LIST)).toBe(DEFAULT_DECK_LIST);
  });

  it('reports the round clock in the snapshot, counting down and never negative', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    expect(buildCardMinigameInfo(ctx, 1).match?.secondsLeft).toBe(CARD_DUEL_ROUND_DEADLINE_S);
    (ctx as unknown as { time: number }).time = match.roundDeadline - 10;
    expect(buildCardMinigameInfo(ctx, 1).match?.secondsLeft).toBe(10);
    (ctx as unknown as { time: number }).time = match.roundDeadline + 100;
    expect(buildCardMinigameInfo(ctx, 1).match?.secondsLeft).toBe(0);
  });

  it('one clock covers both sides: it is 45 seconds and it refreshes per round', () => {
    // The number itself is pinned because it is the whole disconnect policy
    // too: there is no separate linkdead grace.
    expect(CARD_DUEL_ROUND_DEADLINE_S).toBe(45);
  });

  it('takes health off the loser of a round, by the margin between the two cards', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    playCardInDuel(ctx, highestCard(match.state.a.cards.hand).iid, 1);
    playCardInDuel(ctx, lowestCard(match.state.b.cards.hand).iid, 2);
    const live = cardDuelMatchFor(ctx, 1);
    if (!live) throw new Error('one round cannot end a match from full health');
    // The margin is read off the values the comparison USED (a card's effects
    // can move them), which is the same pair the stage shows the player.
    const played = live.state.history.slice(-2);
    const aValue = played.find((entry) => entry.owner === 'a')?.effectiveValue ?? 0;
    const bValue = played.find((entry) => entry.owner === 'b')?.effectiveValue ?? 0;
    const margin = aValue - bValue;
    expect(margin).toBeGreaterThan(0);
    // The winner is untouched and the loser is down exactly the margin: the
    // player can read the hit off the two cards before it lands.
    expect(live.state.a.hp).toBe(CARD_DUEL_START_HP);
    expect(live.state.b.hp).toBe(CARD_DUEL_START_HP - margin);
    expect(live.state.a.damageDealt).toBe(margin);
    expect(live.state.a.bestHit?.amount).toBe(margin);
  });

  it('ends the match when a seat runs out of health, and not before', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    // One point of health left, and a round A is about to win: the match ends
    // on the damage, not on any round count.
    match.state.b.hp = 1;
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
    const high = highestCard(match.state.a.cards.hand);
    const low = lowestCard(match.state.b.cards.hand);
    playCardInDuel(ctx, high.iid, 1);
    playCardInDuel(ctx, low.iid, 2);
    expect(cardDuelMatchFor(ctx, 1)).toBeNull();
  });

  it('a round win with no margin ends nothing: winning rounds is not the win condition', () => {
    // Two round wins used to take the match. Now a round that took no health
    // (a winTies push, or a margin that rounded to nothing) leaves the match
    // exactly where it was.
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    const match = cardDuelMatchFor(ctx, 1);
    if (!match) throw new Error('expected a live match');
    match.state.a.roundWins = 5;
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
    expect(match.state.b.hp).toBe(CARD_DUEL_START_HP);
  });

  it('cardMinigameAvailable ignores Fiesta bots (offline bot matches must not fake availability)', () => {
    const { ctx, error } = makeCtx();
    (ctx.players.get(2) as unknown as { isFiestaBot?: boolean }).isFiestaBot = true;
    (ctx.players.get(3) as unknown as { isFiestaBot?: boolean }).isFiestaBot = true;
    // Only pids 2 and 3 exist besides 1, and both are bots: no queueable
    // human opponent exists, so joining must still be refused.
    joinCardMinigameQueue(ctx, 1);
    expect(error).toHaveBeenCalledWith(1, 'ClaudeStone requires another player online.');
    expect(ctx.cardDuelQueue).toEqual([]);
  });

  it('does not forfeit a match before its round deadline has passed', () => {
    const { ctx } = makeCtx();
    joinCardMinigameQueue(ctx, 1);
    joinCardMinigameQueue(ctx, 2);
    updateCardDuelQueue(ctx);
    (ctx as unknown as { time: number }).time = CARD_DUEL_ROUND_DEADLINE_S - 1;
    updateCardDuelDeadlines(ctx);
    expect(cardDuelMatchFor(ctx, 1)).not.toBeNull();
  });
});

// Root CLAUDE.md bans "?? 'English'" fallbacks interpolated into player-visible
// text, and the S3 i18n guard (tests/localization_fixes.test.ts) only scrapes
// the outer literal at an emit site, so a fallback hidden inside a template
// string's ${...} interpolation is invisible to it. This is a source scan, not
// a runtime probe, precisely because that gap means a runtime test could pass
// while the pattern still ships: it asserts the banned shape never reappears
// in this file's emit paths, regardless of which emit call it hides in.
describe('card_duel.ts source: no ?? English-literal fallback inside a template interpolation', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/sim/social/card_duel.ts', import.meta.url)),
    'utf8',
  );

  // biome-ignore lint/suspicious/noTemplateCurlyInString: the title names the banned template pattern literally.
  it('has no `${... ?? \'literal\'}` or `${... ?? "literal"}` pattern', () => {
    const bannedInTemplate = /\$\{[^}]*\?\?\s*(['"])[^'"]*\1[^}]*\}/g;
    const hits = [...src.matchAll(bannedInTemplate)].map((m) => m[0]);
    expect(hits).toEqual([]);
  });
});
