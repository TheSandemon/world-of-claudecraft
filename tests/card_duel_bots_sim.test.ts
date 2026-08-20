import { describe, expect, it } from 'vitest';
import { CARD_OPPONENTS } from '../src/sim/content/cards';
import { Sim } from '../src/sim/sim';
import { isCardBotPid } from '../src/sim/social/card_duel_bots';
import { groundHeight } from '../src/sim/world';

// The Card Master stands in Eastbrook at {13, 2}; the join gates check range.
function makeWorld(seed = 42) {
  return new Sim({ seed, playerClass: 'warrior', noPlayer: true });
}

function seatAtCardMaster(sim: Sim, name: string): number {
  const pid = sim.addPlayer('warrior', name);
  const e = sim.entities.get(pid);
  if (!e) throw new Error('expected an entity');
  e.pos.x = 13;
  e.pos.z = 2;
  e.pos.y = groundHeight(13, 2, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  return pid;
}

/** Drives ticks until the match ends or the cap is hit, playing the human seat
 *  as soon as it is that seat's turn. */
function playOut(sim: Sim, pid: number, maxTicks = 20 * 240): void {
  for (let i = 0; i < maxTicks; i++) {
    const match = sim.cardDuelMatchFor(pid);
    if (!match) return;
    if (match.state.a.playedThisRound === null && match.state.a.cards.hand.length > 0) {
      sim.playCardInDuel(match.state.a.cards.hand[0].iid, pid);
    }
    sim.tick();
  }
}

describe('Card Duel against a named regular', () => {
  it('starts directly, without touching the matchmaking queue', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('dockhand_pell', pid);
    const match = sim.cardDuelMatchFor(pid);
    expect(match).not.toBeNull();
    expect(match?.bot?.opponentId).toBe('dockhand_pell');
    // The queue is untouched: it stays a human-versus-human path.
    expect(sim.isQueuedForCardMinigame(pid)).toBe(false);
  });

  it('works in a world with no other player at all', () => {
    // The whole point: a single-player world, an empty realm, or 3am.
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Solo');
    // The QUEUE would refuse here, and still does.
    sim.joinCardDuelQueue(pid);
    expect(sim.cardDuelMatchFor(pid)).toBeNull();
    sim.startCardDuelAgainstOpponent('huntsman_bregg', pid);
    expect(sim.cardDuelMatchFor(pid)).not.toBeNull();
  });

  it('seats the bot on a reserved pid that is not a player or an entity', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('dockhand_pell', pid);
    const match = sim.cardDuelMatchFor(pid);
    if (!match) throw new Error('expected a live match');
    expect(isCardBotPid(match.b)).toBe(true);
    // No fake player leaks into the roster, interest scoping, or teardown.
    expect(sim.players.has(match.b)).toBe(false);
    expect(sim.entities.has(match.b)).toBe(false);
  });

  it('the bot does not commit instantly, and does commit inside the window', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('the_card_master', pid);
    const match = sim.cardDuelMatchFor(pid);
    if (!match) throw new Error('expected a live match');
    sim.tick();
    expect(match.state.b.playedThisRound).toBeNull();
    // Well inside the 45 second round clock.
    for (let i = 0; i < 20 * 10; i++) {
      sim.tick();
      if (match.state.b.playedThisRound !== null) break;
    }
    expect(match.state.b.playedThisRound).not.toBeNull();
  });

  it('plays a full match through the SAME resolution path a human match uses', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('gravedigger_ossa', pid);
    playOut(sim, pid);
    expect(sim.cardDuelMatchFor(pid)).toBeNull();
  });

  it('a completed bot match credits NO cardDuelsWon (the PvP anti-farm rule)', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    const meta = sim.players.get(pid);
    if (!meta) throw new Error('expected player meta');
    const before = meta.deedStats.counters.cardDuelsWon ?? 0;
    sim.startCardDuelAgainstOpponent('dockhand_pell', pid);
    playOut(sim, pid);
    expect(sim.cardDuelMatchFor(pid)).toBeNull();
    // Whoever won, the pvp stat is untouched: pvp_card_duel_first_win reads it,
    // and beating a Novice must not make that deed a formality.
    expect(meta.deedStats.counters.cardDuelsWon ?? 0).toBe(before);
  });

  it('a real human match still bumps the stat exactly once (the control arm)', () => {
    const sim = makeWorld();
    const a = seatAtCardMaster(sim, 'Aleph');
    const b = seatAtCardMaster(sim, 'Bet');
    sim.joinCardDuelQueue(a);
    sim.joinCardDuelQueue(b);
    sim.tick();
    const match = sim.cardDuelMatchFor(a);
    if (!match) throw new Error('expected a live match');
    expect(match.bot).toBeNull();
    let guard = 0;
    while (sim.cardDuelMatchFor(a) !== null && guard++ < 400) {
      const live = sim.cardDuelMatchFor(a);
      if (!live) break;
      const high = [...live.state.a.cards.hand].sort((x, y) => y.value - x.value)[0];
      const low = [...live.state.b.cards.hand].sort((x, y) => x.value - y.value)[0];
      if (high) sim.playCardInDuel(high.iid, a);
      if (low) sim.playCardInDuel(low.iid, b);
    }
    const metaA = sim.players.get(a);
    const metaB = sim.players.get(b);
    // Exactly one of them won, and exactly one credit was written.
    const credited =
      (metaA?.deedStats.counters.cardDuelsWon ?? 0) + (metaB?.deedStats.counters.cardDuelsWon ?? 0);
    expect(credited).toBe(1);
  });

  it('refuses an opponent that is not at the table', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    const events = sim.tick();
    void events;
    sim.startCardDuelAgainstOpponent('nobody_by_that_name', pid);
    expect(sim.cardDuelMatchFor(pid)).toBeNull();
  });

  it('refuses to seat a second match while one is live', () => {
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('dockhand_pell', pid);
    const first = sim.cardDuelMatchFor(pid);
    sim.startCardDuelAgainstOpponent('huntsman_bregg', pid);
    expect(sim.cardDuelMatchFor(pid)).toBe(first);
  });

  it('every shipped regular can actually be sat down against', () => {
    for (const opponent of CARD_OPPONENTS) {
      const sim = makeWorld();
      const pid = seatAtCardMaster(sim, 'Aleph');
      sim.startCardDuelAgainstOpponent(opponent.id, pid);
      const match = sim.cardDuelMatchFor(pid);
      expect(match, `${opponent.id} could not be seated`).not.toBeNull();
      expect(match?.bot?.tier).toBe(opponent.difficulty);
      // Both seats got a full twenty-card pool.
      for (const side of [match?.state.a, match?.state.b]) {
        const pool = [
          ...(side?.cards.hand ?? []),
          ...(side?.cards.deck ?? []),
          ...(side?.cards.discard ?? []),
        ];
        expect(pool.length).toBe(20);
      }
    }
  });
});
