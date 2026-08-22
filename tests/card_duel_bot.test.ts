import { describe, expect, it } from 'vitest';
import {
  CARD_BOT_TIERS,
  type CardBotView,
  chooseCard,
  novicePolicy,
  policyFor,
} from '../src/sim/minigames/card_duel/bot';
import { Rng } from '../src/sim/rng';
import { cardOfValue, countingRng } from './helpers/card_duel_fixtures';

/** A hand-built view: no Sim, no match, no server. That the policies are
 *  testable this way IS the design (docs/prd/card-duel-v2.md section 9.2). */
function view(over: Partial<CardBotView> = {}): CardBotView {
  return {
    hand: [cardOfValue(2), cardOfValue(5), cardOfValue(9)],
    deckCount: 13,
    discardCount: 4,
    myRounds: 0,
    opponentRounds: 0,
    myHp: 100,
    opponentHp: 100,
    maxHp: 100,
    round: 1,
    myCounters: {},
    opponentCounters: {},
    opponentRevealed: [],
    opponentPlayedValues: [],
    ...over,
  };
}

describe('card_duel bot', () => {
  it('every declared tier resolves to a policy', () => {
    for (const tier of CARD_BOT_TIERS) expect(policyFor(tier)).toBeTypeOf('function');
  });

  it('always names a card the hand actually holds', () => {
    const v = view();
    const held = new Set(v.hand.map((c) => c.iid));
    for (let seed = 0; seed < 25; seed++) {
      const pick = chooseCard(v, new Rng(seed));
      expect(pick).not.toBeNull();
      expect(held.has(pick as number)).toBe(true);
    }
  });

  it('the same view and seed always yield the same card', () => {
    const v = view();
    expect(chooseCard(v, new Rng(4242))).toBe(chooseCard(v, new Rng(4242)));
  });

  it('novice spreads across the whole hand rather than always taking one slot', () => {
    const v = view();
    const picked = new Set<number | null>();
    for (let seed = 0; seed < 40; seed++) picked.add(chooseCard(v, new Rng(seed)));
    expect(picked.size).toBe(v.hand.length);
  });

  it('novice draws exactly one number per decision', () => {
    const rng = countingRng([0.5]);
    novicePolicy(view(), rng);
    expect(rng.draws).toBe(1);
  });

  it('an empty hand yields null rather than a card the seat cannot play', () => {
    const rng = countingRng();
    expect(novicePolicy(view({ hand: [] }), rng)).toBeNull();
    expect(rng.draws).toBe(0);
  });

  it('the view carries no opponent hand for a policy to read', () => {
    // The projection is the anti-cheat: a policy cannot peek because the
    // information is absent from its input, not because it declines to look.
    const keys = Object.keys(view());
    expect(keys).not.toContain('opponentHand');
    expect(keys).toContain('opponentRevealed');
  });
});
