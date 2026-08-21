import { describe, expect, it } from 'vitest';
import { CARD_MASTER_NPC_ID } from '../src/sim/content/card_master';
import { Sim } from '../src/sim/sim';
import { groundHeight } from '../src/sim/world';
import { handValues } from './helpers/card_duel_fixtures';

// Sim-level coverage for cardMinigameInfoFor (sim.ts, delegating to
// buildCardMinigameInfo in src/sim/social/card_duel.ts): the IWorldCardMinigame
// read surface both hosts (Sim, ClientWorld) serve. tests/card_duel_view.test.ts
// only pins a hand-written literal shape; this drives the real producer and
// proves it never leaks the opponent's actual hand (only counts/ids), since
// that is exactly the property the whole design depends on.

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function teleportToCardMaster(sim: Sim, pid: number) {
  const e = sim.entities.get(pid)!;
  // Stand at the live card master (joinCardDuelQueue gates on cardMasterInRange);
  // resolved from the world rather than a literal since the Eastbrook harbor
  // move (d19aa33f76, docs/design/eastbrook-revamp/site-plan.md) relocated the
  // inn he anchors to.
  const master = [...sim.entities.values()].find((n) => n.templateId === CARD_MASTER_NPC_ID);
  if (!master) throw new Error('card_master missing');
  const x = master.pos.x;
  const z = master.pos.z;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  (sim as unknown as { rebucket(e: unknown): void }).rebucket(e);
}

function queueDuo(sim: Sim, aName = 'Aleph', bName = 'Bet') {
  const a = sim.addPlayer('warrior', aName);
  const b = sim.addPlayer('mage', bName);
  teleportToCardMaster(sim, a);
  teleportToCardMaster(sim, b);
  sim.joinCardDuelQueue(a);
  sim.joinCardDuelQueue(b);
  sim.tick(); // updateCardDuelQueue() matchmakes the pair
  return { a, b };
}

describe('Sim.cardMinigameInfoFor', () => {
  it('reports available:false and not-queued when nobody else is present (offline single-player)', () => {
    const sim = makeWorld();
    const info = sim.cardMinigameInfoFor(sim.primaryId);
    expect(info.available).toBe(false);
    expect(info.queued).toBe(false);
    expect(info.match).toBeNull();
  });

  it('reports available:true and queued once a second player joins the queue', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    teleportToCardMaster(sim, a);
    teleportToCardMaster(sim, b);
    sim.joinCardDuelQueue(a);
    const info = sim.cardMinigameInfoFor(a);
    expect(info.available).toBe(true);
    expect(info.queued).toBe(true);
    expect(info.match).toBeNull();
  });

  it('tells each side whether the opponent has committed, without naming the card', () => {
    // WHOSE commit the round is waiting on is public; the card is not. Without
    // it, a pause before a reveal is indistinguishable from a stalled client.
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);
    const match = sim.cardDuelMatchFor(a)!;
    expect(sim.cardMinigameInfoFor(a).match?.opponentCommitted).toBe(false);
    expect(sim.cardMinigameInfoFor(b).match?.opponentCommitted).toBe(false);

    const bCard = match.state.b.cards.hand[0];
    sim.playCardInDuel(bCard.iid, b);
    const infoA = sim.cardMinigameInfoFor(a);
    expect(infoA.match?.opponentCommitted).toBe(true);
    // A has not played, so A is not waiting on B; and B's card is still absent
    // from A's whole snapshot.
    expect(infoA.match?.waitingOnOpponent).toBe(false);
    expect(JSON.stringify(infoA)).not.toContain(String(bCard.iid));
    expect(sim.cardMinigameInfoFor(b).match?.opponentCommitted).toBe(false);
  });

  it('reports the opponent hand SIZE without a single card in it', () => {
    // The size is public (a hand refills to four and a commit takes one) and is
    // what gives a revealed card a place on the table. The identities are not:
    // the count must arrive with none of their instance ids anywhere near it.
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);
    const match = sim.cardDuelMatchFor(a)!;
    const infoA = sim.cardMinigameInfoFor(a);
    expect(infoA.match?.opponentHandCount).toBe(match.state.b.cards.hand.length);
    for (const card of match.state.b.cards.hand) {
      expect(JSON.stringify(infoA)).not.toContain(`"iid":${card.iid}`);
    }
    // And it shrinks the moment they commit, so the row is their real hand.
    sim.playCardInDuel(match.state.b.cards.hand[0].iid, b);
    expect(sim.cardMinigameInfoFor(a).match?.opponentHandCount).toBe(
      match.state.b.cards.hand.length,
    );
  });

  it('reports a live match snapshot for each side, without leaking the opponent hand', () => {
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);

    const infoA = sim.cardMinigameInfoFor(a);
    const infoB = sim.cardMinigameInfoFor(b);
    expect(infoA.match).not.toBeNull();
    expect(infoB.match).not.toBeNull();
    if (!infoA.match || !infoB.match) throw new Error('expected live matches');

    // Each side sees the OTHER pid/name as opponent, and only its own hand.
    expect(infoA.match.opponent.pid).toBe(b);
    expect(infoB.match.opponent.pid).toBe(a);

    // The read surface exposes no opponentHand / raw card field at all. The
    // cross-referenced data is counts, identity, public play history, and the
    // REVEALED set (cards a reveal effect entitled this viewer to see), never
    // the opponent's held cards. Pinned as an exact key set so a new field
    // cannot be added without this assertion being reconsidered.
    expect(Object.keys(infoA.match).sort()).toEqual(
      [
        'opponent',
        'hand',
        'deckCount',
        'discardCount',
        'myRounds',
        'opponentRounds',
        'roundsToWin',
        'round',
        'waitingOnOpponent',
        'opponentCommitted',
        'opponentHandCount',
        'activeEffects',
        'secondsLeft',
        'myCounters',
        'opponentCounters',
        'opponentRevealed',
        'opponentPlayedValues',
      ].sort(),
    );
    expect(Object.keys(infoA.match.opponent).sort()).toEqual(['name', 'pid']);

    // A's reported hand must be A's actual hand, not B's, and vice versa: a
    // perspective-flip bug (B-side hand leaking into A's view) would fail this.
    const rawMatch = sim.cardDuelMatchFor(a);
    if (!rawMatch) throw new Error('expected a live match on the sim');
    expect(infoA.match.hand.map((c) => c.iid).sort()).toEqual(
      rawMatch.state.a.cards.hand.map((c) => c.iid).sort(),
    );
    expect(infoB.match.hand.map((c) => c.iid).sort()).toEqual(
      rawMatch.state.b.cards.hand.map((c) => c.iid).sort(),
    );
    // And A's view must NOT equal B's actual hand (unless coincidentally
    // identical multiset, which the deck's two-of-each shuffle makes
    // exceedingly unlikely for a 4-card starting hand from the same seed
    // pool; assert the two producer hands are tracked independently instead).
    expect(rawMatch.state.a.cards).not.toBe(rawMatch.state.b.cards);

    // Nothing has been revealed, so neither side's snapshot names a single one
    // of the opponent's instance ids anywhere in it.
    const bIids = new Set(rawMatch.state.b.cards.hand.map((c) => c.iid));
    const aIids = new Set(rawMatch.state.a.cards.hand.map((c) => c.iid));
    expect(infoA.match.opponentRevealed).toEqual([]);
    expect(infoB.match.opponentRevealed).toEqual([]);
    for (const iid of JSON.stringify(infoA.match).match(/\d+/g) ?? []) {
      expect(bIids.has(Number(iid))).toBe(false);
    }
    for (const iid of JSON.stringify(infoB.match).match(/\d+/g) ?? []) {
      expect(aIids.has(Number(iid))).toBe(false);
    }
  });

  it('serializes an opponent card ONLY once a reveal effect entitled the viewer to it', () => {
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);
    const match = sim.cardDuelMatchFor(a);
    if (!match) throw new Error('expected a live match');
    const revealed = match.state.b.cards.hand[1];
    // The engine records the entitlement on the OWNER's side; the snapshot
    // builder is what turns it into bytes for the other viewer.
    match.state.b.revealedToOpponent.push(revealed.iid);

    const infoA = sim.cardMinigameInfoFor(a);
    const infoB = sim.cardMinigameInfoFor(b);
    if (!infoA.match || !infoB.match) throw new Error('expected live matches');
    expect(infoA.match.opponentRevealed.map((c) => c.iid)).toEqual([revealed.iid]);
    expect(infoA.match.opponentRevealed[0].cardId).toBe(revealed.cardId);
    // And only that one: the rest of B's hand is still absent from A's view.
    const stillHidden = match.state.b.cards.hand
      .filter((c) => c.iid !== revealed.iid)
      .map((c) => c.iid);
    for (const iid of JSON.stringify(infoA.match).match(/\d+/g) ?? []) {
      expect(stillHidden.includes(Number(iid))).toBe(false);
    }
    // B gains nothing from revealing its own card.
    expect(infoB.match.opponentRevealed).toEqual([]);
  });
});

describe('Sim.removePlayer tears down Card Duel state', () => {
  it('forfeits a live match and frees the survivor to re-queue', () => {
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);
    expect(sim.cardDuelMatchFor(a)).not.toBeNull();

    sim.removePlayer(a);

    // The departed pid's match is gone, and so is the survivor's (both sides
    // of a live match key the same shared object).
    expect(sim.cardDuelMatchFor(b)).toBeNull();

    // The survivor must be free to re-queue immediately: before this fix,
    // ctx.cardDuels never cleared for the offline Sim / headless env, so a
    // leftover entry permanently blocked joinCardDuelQueue with
    // 'already_in_duel'.
    const c = sim.addPlayer('mage', 'Gimel');
    teleportToCardMaster(sim, b);
    teleportToCardMaster(sim, c);
    sim.joinCardDuelQueue(b);
    const info = sim.cardMinigameInfoFor(b);
    expect(info.queued).toBe(true);
  });

  it('the AFK deadline sweep runs from the real Sim.tick(), not just when called directly', () => {
    // Regression guard: updateCardDuelDeadlines was only ever exercised by
    // calling it directly in tests, so deleting its registration from
    // sim.ts's tick loop (and the parity golden, which draws no rng here)
    // would not have been caught. Drive it through the actual tick.
    const sim = makeWorld();
    const { a, b } = queueDuo(sim);
    const match = sim.cardDuelMatchFor(a);
    if (!match) throw new Error('expected a live match');
    sim.time = match.roundDeadline + 1;
    sim.tick();
    expect(sim.cardDuelMatchFor(a)).toBeNull();
    expect(sim.cardDuelMatchFor(b)).toBeNull();
  });

  it('drops a queued (not yet matched) departed player from the queue', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const bystander = sim.addPlayer('mage', 'Bystander');
    teleportToCardMaster(sim, a);
    sim.joinCardDuelQueue(a);
    expect(sim.cardMinigameInfoFor(a).queued).toBe(true);

    sim.removePlayer(a);

    // Assert the real queue state directly. `a`'s pid is never recycled
    // (Sim.nextId is monotonic, sim.ts), so re-adding at a fresh pid reports
    // queued:false trivially regardless of whether removePlayer ever touched
    // cardDuelQueue: that made the previous version of this assertion pass
    // even if Sim.removePlayer never called leaveCardMinigameEntirely.
    expect(sim.cardDuelQueue).toEqual([]);
    expect(bystander).toBeGreaterThan(0);
  });
});
