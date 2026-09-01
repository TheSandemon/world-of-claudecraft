import { describe, expect, it } from 'vitest';
import type { CardDefinition, CardInstance, CardMatchState } from '../src/sim/minigames/card_duel';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import { recordHistory } from '../src/sim/minigames/card_duel/match_state';
import {
  EFFECT_PRIORITY,
  MAX_NARRATED_STEPS,
  MAX_RESOLUTION_STEPS,
  NON_COMMUTATIVE_EFFECTS,
  resolveCardRound,
} from '../src/sim/minigames/card_duel/resolve';
import { Rng } from '../src/sim/rng';
import {
  countingRng,
  defineCard,
  effect,
  instanceOf,
  lockIn,
  makeCatalog,
  makeMatch,
} from './helpers/card_duel_fixtures';

// The brief's own example cards, authored purely as data over the primitives.
const plain3 = defineCard('plain3', { value: 3 });
const plain5 = defineCard('plain5', { value: 5 });
const plain7 = defineCard('plain7', { value: 7 });

const forestWolf = defineCard('forest_wolf', {
  value: 3,
  tribes: ['Beast'],
  effects: [
    effect({
      conditions: { type: 'hasTribe', card: 'myPreviousCard', tribe: 'Beast' },
      effect: { type: 'modifyValue', amount: constant(1) },
    }),
  ],
});

const sablewebHexer = defineCard('sableweb_hexer', {
  value: 4,
  tribes: ['Spider'],
  effects: [
    effect({
      conditions: { type: 'hasTribe', card: 'opponentCard', tribe: 'Human' },
      target: { type: 'opponentCard' },
      effect: { type: 'modifyValue', amount: constant(-2) },
    }),
  ],
});

const doppelganger = defineCard('doppelganger', {
  value: 5,
  tribes: ['Spirit'],
  effects: [
    effect({
      effect: {
        type: 'setValue',
        amount: { type: 'cardValue', card: 'opponentCard', value: 'base' },
      },
    }),
  ],
});

const nullstone = defineCard('nullstone', {
  value: 4,
  tribes: ['Construct'],
  effects: [effect({ target: { type: 'opponentCard' }, effect: { type: 'silence' } })],
});

const graveCandle = defineCard('grave_candle', {
  value: 2,
  tribes: ['Spirit'],
  effects: [
    effect({
      trigger: 'onLose',
      target: { type: 'nextCard', owner: 'self', match: { tribe: 'Undead' } },
      effect: { type: 'modifyValue', amount: constant(3) },
      duration: 'untilTriggered',
    }),
  ],
});

const ghoul = defineCard('ghoul', { value: 2, tribes: ['Undead'] });

const grix = defineCard('grix', {
  value: 10,
  tribes: ['Burrower'],
  effects: [
    effect({
      trigger: 'onWin',
      target: { type: 'nextCard', owner: 'self' },
      effect: { type: 'modifyValue', amount: constant(-3) },
      duration: 'untilTriggered',
    }),
  ],
});

const mudfinScout = defineCard('mudfin_scout', {
  value: 1,
  tribes: ['Mudfin'],
  effects: [
    effect({
      trigger: 'onLose',
      target: { type: 'zone', owner: 'opponent', zone: 'hand', select: 'random', count: 2 },
      effect: { type: 'reveal' },
    }),
  ],
});

const tieBreaker = defineCard('tie_breaker', {
  value: 5,
  effects: [effect({ effect: { type: 'winTies' } })],
});

const contrarian = defineCard('contrarian', {
  value: 2,
  effects: [effect({ effect: { type: 'reverseComparison' } })],
});

const catalog = makeCatalog([
  plain3,
  plain5,
  plain7,
  forestWolf,
  sablewebHexer,
  doppelganger,
  nullstone,
  graveCandle,
  ghoul,
  grix,
  mudfinScout,
  tieBreaker,
  contrarian,
]);

/** Locks one card in per seat and resolves the round, refills off by default so
 *  a test's zones stay exactly what it built. */
function playRound(
  a: CardDefinition | null,
  b: CardDefinition | null,
  build?: (
    state: CardMatchState,
    cards: { a: CardInstance | null; b: CardInstance | null },
  ) => void,
  opts: { rng?: { next(): number }; skipRefill?: boolean } = {},
) {
  const cardA = a ? instanceOf(a) : null;
  const cardB = b ? instanceOf(b) : null;
  const state = makeMatch(cardA ? [cardA] : [], cardB ? [cardB] : []);
  build?.(state, { a: cardA, b: cardB });
  lockIn(state, cardA, cardB);
  const res = resolveCardRound(state, catalog, opts.rng ?? new Rng(3), {
    skipRefill: opts.skipRefill ?? true,
  });
  return { state, res, cardA, cardB };
}

describe('card_duel resolve', () => {
  it('a plain round is decided on the printed numbers', () => {
    const { res } = playRound(plain7, plain5);
    expect(res.aValue).toBe(7);
    expect(res.bValue).toBe(5);
    expect(res.winner).toBe('a');
    expect(res.aResult).toBe('win');
    expect(res.bResult).toBe('lose');
  });

  it('equal values push, and neither streak survives it', () => {
    const { state, res } = playRound(plain5, plain5);
    expect(res.winner).toBeNull();
    expect(state.a.roundWins).toBe(0);
    expect(state.b.roundWins).toBe(0);
    expect(state.a.previousResult).toBe('tie');
  });

  it('Forest Wolf: +1 only when the previous card was a Beast', () => {
    const withBeast = playRound(forestWolf, plain5, (state) => {
      const prev = instanceOf(forestWolf);
      recordHistory(state, 'a', prev, 3, ['Beast'], 'win');
      state.a.previousCard = prev;
      state.round = 2;
    });
    expect(withBeast.res.aValue).toBe(4);

    const withoutBeast = playRound(forestWolf, plain5, (state) => {
      const prev = instanceOf(plain5);
      recordHistory(state, 'a', prev, 5, [], 'win');
      state.a.previousCard = prev;
      state.round = 2;
    });
    expect(withoutBeast.res.aValue).toBe(3);
  });

  it('Sableweb Hexer: the opponent Human takes -2, a non-Human does not', () => {
    const human = defineCard('human5', { value: 5, tribes: ['Human'] });
    const localCatalog = makeCatalog([sablewebHexer, human, plain5]);
    const hexer = instanceOf(sablewebHexer);
    const target = instanceOf(human);
    const state = makeMatch([hexer], [target]);
    lockIn(state, hexer, target);
    const res = resolveCardRound(state, localCatalog, new Rng(1), { skipRefill: true });
    expect(res.bValue).toBe(3);
    expect(res.winner).toBe('a');

    const plain = playRound(sablewebHexer, plain5);
    expect(plain.res.bValue).toBe(5);
    expect(plain.res.winner).toBe('b');
  });

  it("Doppelganger: setValue copies the opponent's BASE value, and the round pushes", () => {
    const { res } = playRound(doppelganger, plain7);
    expect(res.aValue).toBe(7);
    expect(res.winner).toBeNull();
  });

  it('Nullstone: silence stops the opponent card resolving its own effects', () => {
    const { res } = playRound(nullstone, forestWolf, (state) => {
      const prev = instanceOf(forestWolf);
      recordHistory(state, 'b', prev, 3, ['Beast'], 'win');
      state.b.previousCard = prev;
      state.round = 2;
    });
    // Without the silence the wolf would be a 4 (its previous card was a
    // Beast); silenced it stays a printed 3 and loses to the 4.
    expect(res.bValue).toBe(3);
    expect(res.winner).toBe('a');
  });

  it('silence resolves before the effects it suppresses, whichever seat played it', () => {
    const fromB = playRound(forestWolf, nullstone, (state) => {
      const prev = instanceOf(forestWolf);
      recordHistory(state, 'a', prev, 3, ['Beast'], 'win');
      state.a.previousCard = prev;
      state.round = 2;
    });
    expect(fromB.res.aValue).toBe(3);
  });

  it('Grave Candle: the parked buff waits for the next matching card, then is spent', () => {
    const candle = instanceOf(graveCandle);
    const first = instanceOf(ghoul);
    const second = instanceOf(ghoul);
    const state = makeMatch(
      [candle, first, second],
      [instanceOf(plain7), instanceOf(plain3), instanceOf(plain3)],
    );
    lockIn(state, candle, state.b.cards.hand[0]);
    const round1 = resolveCardRound(state, catalog, new Rng(1), { skipRefill: true });
    expect(round1.winner).toBe('b');
    expect(state.modifiers.length).toBe(1);

    lockIn(state, first, state.b.cards.hand[0]);
    const round2 = resolveCardRound(state, catalog, new Rng(1), { skipRefill: true });
    // 2 printed, +3 from the parked buff.
    expect(round2.aValue).toBe(5);

    lockIn(state, second, state.b.cards.hand[0]);
    const round3 = resolveCardRound(state, catalog, new Rng(1), { skipRefill: true });
    // Spent: the second Undead gets nothing.
    expect(round3.aValue).toBe(2);
  });

  it('Grix: winning parks a penalty on your own next card', () => {
    const grixCard = instanceOf(grix);
    const follow = instanceOf(plain7);
    const state = makeMatch([grixCard, follow], [instanceOf(plain3), instanceOf(plain3)]);
    lockIn(state, grixCard, state.b.cards.hand[0]);
    const first = resolveCardRound(state, catalog, new Rng(1), { skipRefill: true });
    expect(first.winner).toBe('a');
    lockIn(state, follow, state.b.cards.hand[0]);
    const second = resolveCardRound(state, catalog, new Rng(1), { skipRefill: true });
    expect(second.aValue).toBe(4);
  });

  it('Mudfin Scout: losing reveals two of the opponent hand, and only those two', () => {
    const scout = instanceOf(mudfinScout);
    const state = makeMatch([scout], [instanceOf(plain7)]);
    state.b.cards.hand.push(instanceOf(plain3), instanceOf(plain3), instanceOf(plain5));
    lockIn(state, scout, state.b.cards.hand[0]);
    const res = resolveCardRound(state, catalog, new Rng(9), { skipRefill: true });
    expect(res.winner).toBe('b');
    expect(state.b.revealedToOpponent.length).toBe(2);
    // Every revealed id is a card the opponent actually holds.
    const held = new Set([...state.b.cards.hand, ...state.b.cards.discard].map((c) => c.iid));
    for (const iid of state.b.revealedToOpponent) expect(held.has(iid)).toBe(true);
  });

  it('winTies takes a tied comparison; two of them cancel back to a push', () => {
    const oneSided = playRound(tieBreaker, plain5);
    expect(oneSided.res.aValue).toBe(oneSided.res.bValue);
    expect(oneSided.res.winner).toBe('a');

    const both = playRound(tieBreaker, tieBreaker);
    expect(both.res.winner).toBeNull();
  });

  it('reverseComparison makes the lower value win, and two reversals cancel', () => {
    const one = playRound(contrarian, plain7);
    expect(one.res.winner).toBe('a');
    const both = playRound(contrarian, contrarian);
    // Same card, same value: a push either way, but the reversal must not
    // apply twice and flip an actual comparison.
    expect(both.res.winner).toBeNull();
  });

  it('a seat that played nothing loses the round whatever the numbers say', () => {
    const { res } = playRound(null, plain3);
    expect(res.winner).toBe('b');
    const neither = playRound(null, null);
    expect(neither.res.winner).toBeNull();
  });

  it('records history with the value the round was DECIDED on, not the printed one', () => {
    const { state } = playRound(forestWolf, plain5, (s) => {
      const prev = instanceOf(forestWolf);
      recordHistory(s, 'a', prev, 3, ['Beast'], 'win');
      s.a.previousCard = prev;
      s.round = 2;
    });
    const entry = state.history[state.history.length - 2];
    expect(entry.owner).toBe('a');
    expect(entry.value).toBe(3);
    expect(entry.effectiveValue).toBe(4);
  });

  it('advances streaks, the round number, and the previous-card pointers', () => {
    const { state } = playRound(plain7, plain5);
    expect(state.round).toBe(2);
    expect(state.a.consecutiveWins).toBe(1);
    expect(state.b.consecutiveLosses).toBe(1);
    expect(state.a.previousCard?.cardId).toBe('plain7');
    expect(state.a.playedThisRound).toBeNull();
  });

  it('refills both hands back to four, continuing through a mid-refill reshuffle', () => {
    const a = instanceOf(plain7);
    const b = instanceOf(plain5);
    const state = makeMatch([a], [b]);
    // Side A's deck runs dry on the second of the three draws its refill needs,
    // so the discard must shuffle back in and the SAME refill continue.
    state.a.cards.deck = [instanceOf(plain3)];
    state.a.cards.discard = [instanceOf(plain3), instanceOf(plain3)];
    state.b.cards.deck = [
      instanceOf(plain3),
      instanceOf(plain3),
      instanceOf(plain3),
      instanceOf(plain3),
    ];
    lockIn(state, a, b);
    const res = resolveCardRound(state, catalog, new Rng(4));
    expect(state.a.cards.hand.length).toBe(4);
    expect(state.b.cards.hand.length).toBe(4);
    expect(res.refillA.reshuffled).toBe(true);
    expect(res.refillB.reshuffled).toBe(false);
  });

  it('a pool too small to fill four leaves a smaller hand rather than spinning', () => {
    const a = instanceOf(plain7);
    const state = makeMatch([a], [instanceOf(plain5)]);
    state.a.cards.deck = [];
    lockIn(state, a, state.b.cards.hand[0]);
    const res = resolveCardRound(state, catalog, new Rng(4));
    // Only the card just played is in the pool, so it comes back and stops.
    expect(state.a.cards.hand.length).toBe(1);
    expect(res.refillA.drawn.length).toBe(1);
  });

  it('every non-commutative primitive holds a priority no other one shares', () => {
    const seen = new Map<number, string>();
    for (const type of NON_COMMUTATIVE_EFFECTS) {
      const priority = EFFECT_PRIORITY[type];
      expect(priority).toBeTypeOf('number');
      const clash = seen.get(priority);
      expect(
        clash,
        `${type} shares priority ${priority} with ${clash}: order-dependent primitives need their own rung`,
      ).toBeUndefined();
      seen.set(priority, type);
    }
  });

  it('resolution is seat-symmetric: mirroring the seats mirrors the result exactly', () => {
    const human = defineCard('human5', { value: 5, tribes: ['Human'] });
    const mirrorCatalog = makeCatalog([sablewebHexer, human]);
    const run = (hexerSeat: 'a' | 'b') => {
      const hexer = instanceOf(sablewebHexer);
      const target = instanceOf(human);
      const state = hexerSeat === 'a' ? makeMatch([hexer], [target]) : makeMatch([target], [hexer]);
      lockIn(state, hexerSeat === 'a' ? hexer : target, hexerSeat === 'a' ? target : hexer);
      return resolveCardRound(state, mirrorCatalog, new Rng(1), { skipRefill: true });
    };
    const asA = run('a');
    const asB = run('b');
    expect(asA.winner).toBe('a');
    expect(asB.winner).toBe('b');
    expect(asA.aValue).toBe(asB.bValue);
    expect(asA.bValue).toBe(asB.aValue);
  });

  it('effect limits cap how often one effect fires', () => {
    const once = defineCard('once', {
      value: 5,
      effects: [
        effect({
          effect: { type: 'addCounter', counter: 'Pack', amount: constant(1) },
          target: { type: 'player', owner: 'self' },
          limits: { oncePerMatch: true },
        }),
      ],
    });
    const limited = makeCatalog([once, plain3]);
    const first = instanceOf(once);
    const second = instanceOf(once);
    const state = makeMatch([first, second], [instanceOf(plain3), instanceOf(plain3)]);
    lockIn(state, first, state.b.cards.hand[0]);
    resolveCardRound(state, limited, new Rng(1), { skipRefill: true });
    expect(state.a.counters.Pack).toBe(1);
    lockIn(state, second, state.b.cards.hand[0]);
    resolveCardRound(state, limited, new Rng(1), { skipRefill: true });
    expect(state.a.counters.Pack).toBe(1);
  });

  it('a cyclic card hits the resolution ceiling and the round still resolves', () => {
    // A genuine cycle over a CLOSED pool: being drawn discards a card, being
    // discarded draws one, and every card in the pool does both, so the loop
    // never ends on its own. Without the ceiling this spins inside one 20 Hz
    // tick and takes the whole realm down with it.
    const churn = defineCard('churn', {
      value: 6,
      effects: [
        effect({
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
        effect({
          trigger: 'onDraw',
          target: { type: 'zone', owner: 'self', zone: 'hand', select: 'first' },
          effect: { type: 'discard' },
        }),
        effect({
          trigger: 'onDiscard',
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
      ],
    });
    const cyclic = makeCatalog([churn, plain3]);
    const opener = instanceOf(churn);
    const state = makeMatch([opener], [instanceOf(plain3)]);
    state.a.cards.deck = [instanceOf(churn), instanceOf(churn)];
    lockIn(state, opener, state.b.cards.hand[0]);
    const messages: string[] = [];
    const res = resolveCardRound(state, cyclic, new Rng(2), {
      skipRefill: true,
      onOverflow: (m) => messages.push(m),
    });
    expect(res.overflow).toBe(true);
    expect(res.steps).toBeLessThanOrEqual(MAX_RESOLUTION_STEPS);
    // Reported exactly once, to the dev channel, not once per step.
    expect(messages.length).toBe(1);
    // The round is still decided rather than left hanging.
    expect(res.winner).toBe('a');
  });

  it('an ordinary round costs a handful of steps, nowhere near the ceiling', () => {
    const { res } = playRound(forestWolf, sablewebHexer);
    expect(res.steps).toBeLessThan(10);
    expect(res.overflow).toBe(false);
  });

  it('a round with no rng-drawing effect draws nothing at all', () => {
    const rng = countingRng();
    playRound(plain7, plain5, undefined, { rng, skipRefill: true });
    expect(rng.draws).toBe(0);
  });
});

// The narration log: what a client needs to tell the story of a round instead
// of announcing its result. Nothing in the engine reads it back, so these are
// the only assertions that hold its shape.
describe('card_duel resolve: the narration log', () => {
  it('records the card that moved a value, and by how much', () => {
    // A Hexer that reads its opponent's tribe: the -2 it applies is exactly the
    // kind of number that used to appear on the table with no explanation.
    const human = defineCard('human5', { value: 5, tribes: ['Human'] });
    const localCatalog = makeCatalog([sablewebHexer, human]);
    const hexer = instanceOf(sablewebHexer);
    const target = instanceOf(human);
    const state = makeMatch([target], [hexer]);
    lockIn(state, target, hexer);
    const res = resolveCardRound(state, localCatalog, new Rng(1), { skipRefill: true });
    const step = res.log.find((entry) => entry.source === 'sableweb_hexer');
    expect(step).toBeDefined();
    expect(step?.seat).toBe('b');
    // It moved the OPPONENT's card, which is the half a "who did this to whom"
    // narration cannot get wrong.
    expect(step?.target).toBe('a');
    expect(step?.amount).toBe(-2);
    expect(step?.valueAfter).toBe(3);
  });

  it('records nothing for an effect whose conditions did not hold', () => {
    // A Hexer against a Beast does nothing, and narrating a beat for it would
    // be the client claiming something happened.
    const { res } = playRound(forestWolf, sablewebHexer, undefined, {
      rng: countingRng(),
      skipRefill: true,
    });
    expect(res.log.some((entry) => entry.source === 'sableweb_hexer')).toBe(false);
  });

  it('leaves a plain round with nothing to narrate', () => {
    const { res } = playRound(plain7, plain5, undefined, { skipRefill: true });
    expect(res.log).toEqual([]);
  });

  it('bounds the log however long the round runs', () => {
    // The same closed cycle the resolution ceiling exists for: the narration
    // must not be able to hold the table for a minute either, so it has its own
    // much smaller bound.
    const churn = defineCard('churn', {
      value: 6,
      effects: [
        effect({
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
        effect({
          trigger: 'onDraw',
          target: { type: 'zone', owner: 'self', zone: 'hand', select: 'first' },
          effect: { type: 'discard' },
        }),
        effect({
          trigger: 'onDiscard',
          target: { type: 'player', owner: 'self' },
          effect: { type: 'draw', amount: constant(1) },
        }),
      ],
    });
    const cyclic = makeCatalog([churn, plain3]);
    const opener = instanceOf(churn);
    const state = makeMatch([opener], [instanceOf(plain3)]);
    state.a.cards.deck = [instanceOf(churn), instanceOf(churn)];
    lockIn(state, opener, state.b.cards.hand[0]);
    const res = resolveCardRound(state, cyclic, new Rng(2), {
      skipRefill: true,
      onOverflow: () => {},
    });
    expect(res.overflow).toBe(true);
    expect(res.log.length).toBeLessThanOrEqual(MAX_NARRATED_STEPS);
    expect(res.log.length).toBeLessThan(res.steps);
  });
});
