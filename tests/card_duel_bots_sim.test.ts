import { describe, expect, it } from 'vitest';
import { CARD_MASTER_NPC_ID } from '../src/sim/content/card_master';
import { CARD_OPPONENTS } from '../src/sim/content/cards';
import { Sim } from '../src/sim/sim';
import { isCardBotPid } from '../src/sim/social/card_duel_bots';
import { groundHeight } from '../src/sim/world';

function makeWorld(seed = 42) {
  return new Sim({ seed, playerClass: 'warrior', noPlayer: true });
}

function seatAtCardMaster(sim: Sim, name: string): number {
  const pid = sim.addPlayer('warrior', name);
  const e = sim.entities.get(pid);
  if (!e) throw new Error('expected an entity');
  // Stand at the LIVE Card Master (startCardDuelAgainstOpponent gates on
  // cardMasterInRange); resolved from the world rather than a literal, since
  // the Eastbrook harbor move relocated the inn he anchors to and a hardcoded
  // seat silently stops being in range. The same resolution the other Card
  // Duel suites use.
  const master = [...sim.entities.values()].find((n) => n.templateId === CARD_MASTER_NPC_ID);
  if (!master) throw new Error('card_master missing');
  e.pos.x = master.pos.x;
  e.pos.z = master.pos.z;
  e.pos.y = groundHeight(master.pos.x, master.pos.z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  return pid;
}

/** Drives ticks until the match ends or the cap is hit, playing the human seat
 *  as soon as it is that seat's turn. */
/**
 * Brings both seats within a couple of rounds of zero.
 *
 * A match runs to 100 health at margin damage, which is 20-plus rounds and
 * (played tick by tick against a bot that thinks between them) minutes of sim
 * time. Every one of those rounds takes the SAME code path, so the tests here
 * shorten the health rather than the path: what they are checking is that a bot
 * match resolves through the shipping resolver and ends, not how long 100
 * health takes to spend.
 */
function shortenMatch(sim: Sim, pid: number): void {
  const match = sim.cardDuelMatchFor(pid);
  if (!match) throw new Error('expected a live match to shorten');
  match.state.a.hp = 12;
  match.state.b.hp = 12;
}

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

  it('sends the regular content id on the snapshot, since it has no player name', () => {
    // A bot seat is deliberately absent from ctx.players, so `name` is empty
    // for every one of these matches. The id is what the client resolves the
    // displayed name from, and the sim stays language-agnostic by sending it
    // rather than English.
    const sim = makeWorld();
    const pid = seatAtCardMaster(sim, 'Aleph');
    sim.startCardDuelAgainstOpponent('gravedigger_ossa', pid);
    const opponent = sim.cardMinigameInfoFor(pid).match?.opponent;
    expect(opponent?.name).toBe('');
    expect(opponent?.opponentId).toBe('gravedigger_ossa');
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
    shortenMatch(sim, pid);
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
    shortenMatch(sim, pid);
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
    // Same shortening the bot arms use: a 100-health match is 20-plus rounds of
    // the SAME code path, and what this arm checks is that a human match credits
    // one win, not how long the health takes to spend.
    shortenMatch(sim, a);
    let guard = 0;
    while (sim.cardDuelMatchFor(a) !== null && guard++ < 400) {
      const live = sim.cardDuelMatchFor(a);
      if (!live) break;
      const high = [...live.state.a.cards.hand].sort((x, y) => y.value - x.value)[0];
      const low = [...live.state.b.cards.hand].sort((x, y) => x.value - y.value)[0];
      if (high) sim.playCardInDuel(high.iid, a);
      if (low) sim.playCardInDuel(low.iid, b);
      // A resolved round now plays its narration out before the next one opens,
      // and narration advances on the sim clock: without a tick the match never
      // reaches a second round and nothing is ever credited.
      sim.tick();
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
