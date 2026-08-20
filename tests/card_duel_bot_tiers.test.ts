import { describe, expect, it } from 'vitest';
import { CARD_DUEL_ROUND_DEADLINE_S } from '../src/sim/minigames/card_duel';
import {
  BOT_COMMIT_TICKS,
  beatChance,
  botCommitDelayTicks,
  CARD_BOT_TIERS,
  type CardBotView,
  chooseCard,
  masterPolicy,
  opponentRemainingValues,
  sharpPolicy,
  steadyPolicy,
} from '../src/sim/minigames/card_duel/bot';
import { Rng } from '../src/sim/rng';
import { TICK_RATE } from '../src/sim/types';
import { cardOfValue, countingRng } from './helpers/card_duel_fixtures';

/** A hand-built view: no Sim, no match, no server. */
function view(over: Partial<CardBotView> = {}): CardBotView {
  return {
    hand: [cardOfValue(2), cardOfValue(5), cardOfValue(9)],
    deckCount: 13,
    discardCount: 4,
    myRounds: 0,
    opponentRounds: 0,
    roundsToWin: 2,
    round: 1,
    myCounters: {},
    opponentCounters: {},
    opponentRevealed: [],
    opponentPlayedValues: [],
    ...over,
  };
}

/** The face value of the card a policy picked, for readable assertions. */
const pickedValue = (v: CardBotView, iid: number | null) =>
  v.hand.find((c) => c.iid === iid)?.value ?? null;

describe('card_duel bot tiers', () => {
  it('every tier always names a card the hand actually holds', () => {
    const v = view();
    const held = new Set(v.hand.map((c) => c.iid));
    for (const tier of CARD_BOT_TIERS) {
      for (let seed = 0; seed < 20; seed++) {
        const pick = chooseCard(v, new Rng(seed), tier);
        expect(held.has(pick as number), `${tier} named a card it does not hold`).toBe(true);
      }
    }
  });

  it('every tier is deterministic for a given view and seed', () => {
    const v = view();
    for (const tier of CARD_BOT_TIERS) {
      expect(chooseCard(v, new Rng(77), tier)).toBe(chooseCard(v, new Rng(77), tier));
    }
  });

  it('Steady commits its highest card on the round that decides the match', () => {
    // One win from the threshold, either way: this round matters.
    const mine = view({ myRounds: 1 });
    expect(pickedValue(mine, steadyPolicy(mine, new Rng(1)))).toBe(9);
    const theirs = view({ opponentRounds: 1 });
    expect(pickedValue(theirs, steadyPolicy(theirs, new Rng(1)))).toBe(9);
  });

  it('Steady sheds a low card on a round that decides nothing', () => {
    const v = view();
    // The 0.75 arm: most seeds dump the cheapest card rather than burning a 9.
    const picks = Array.from({ length: 20 }, (_, seed) =>
      pickedValue(v, steadyPolicy(v, new Rng(seed))),
    );
    const low = picks.filter((value) => value === 2).length;
    expect(low).toBeGreaterThan(picks.length / 2);
  });

  it('Sharp reads the public play history that Steady ignores', () => {
    // The opponent just spent a 10, so their next card is likely small and a
    // middling card takes the round cheaply.
    const v = view({ opponentPlayedValues: [10] });
    expect(pickedValue(v, sharpPolicy(v, new Rng(3)))).toBe(5);
    // With no such tell it falls back to the Steady behavior.
    const plain = view();
    expect(pickedValue(plain, sharpPolicy(plain, new Rng(3)))).toBe(
      pickedValue(plain, steadyPolicy(plain, new Rng(3))),
    );
  });

  it('counting the opponent deck is arithmetic, not a guess', () => {
    // Every legal deck holds exactly two of each value, so what the opponent
    // has played tells the bot the EXACT multiset they can still hold.
    const fresh = opponentRemainingValues(view());
    expect(fresh.length).toBe(20);
    expect(fresh.filter((v) => v === 10).length).toBe(2);
    const seen = opponentRemainingValues(view({ opponentPlayedValues: [10, 10, 9] }));
    expect(seen.filter((v) => v === 10).length).toBe(0);
    expect(seen.filter((v) => v === 9).length).toBe(1);
    expect(seen.length).toBe(17);
  });

  it('beatChance counts a tie as half, because a push scores for neither side', () => {
    expect(beatChance(10, [1, 2, 3])).toBe(1);
    expect(beatChance(1, [2, 3])).toBe(0);
    expect(beatChance(5, [5])).toBe(0.5);
    expect(beatChance(5, [])).toBe(1);
  });

  it('Master plays the surest card when the round decides the match', () => {
    const v = view({ myRounds: 1, opponentPlayedValues: [] });
    expect(pickedValue(v, masterPolicy(v, new Rng(1)))).toBe(9);
  });

  it('Master spends its worst card first when the round decides nothing', () => {
    const v = view();
    expect(pickedValue(v, masterPolicy(v, new Rng(1)))).toBe(2);
  });

  it('Master exploits a counted-out deck: nothing left can beat a 9 once both tens are gone', () => {
    const v = view({ myRounds: 1, opponentPlayedValues: [10, 10] });
    const remaining = opponentRemainingValues(v);
    // A 9 can still be TIED by the two remaining nines (a push, counted as
    // half), but it can no longer be beaten, which is what the count buys.
    expect(remaining.filter((value) => value > 9)).toEqual([]);
    expect(beatChance(9, remaining)).toBeGreaterThan(
      beatChance(9, opponentRemainingValues(view())),
    );
    expect(pickedValue(v, masterPolicy(v, new Rng(2)))).toBe(9);
  });

  it('every tier commits after a delay, and always inside the round window', () => {
    const windowTicks = CARD_DUEL_ROUND_DEADLINE_S * TICK_RATE;
    for (const tier of CARD_BOT_TIERS) {
      const [min, max] = BOT_COMMIT_TICKS[tier];
      // Never instant: an opponent that locks in the moment the round opens
      // both breaks the feel and announces itself as a bot.
      expect(min).toBeGreaterThan(0);
      // And never long enough to time itself out.
      expect(max).toBeLessThan(windowTicks);
      for (let seed = 0; seed < 10; seed++) {
        const delay = botCommitDelayTicks(tier, new Rng(seed));
        expect(delay).toBeGreaterThanOrEqual(min);
        expect(delay).toBeLessThanOrEqual(max);
      }
    }
  });

  it('the higher tiers deliberate longer than the lower ones', () => {
    expect(BOT_COMMIT_TICKS.novice[1]).toBeLessThan(BOT_COMMIT_TICKS.master[0]);
  });

  it('the delay draws exactly one number', () => {
    const rng = countingRng([0.5]);
    botCommitDelayTicks('sharp', rng);
    expect(rng.draws).toBe(1);
  });

  it('an empty hand yields null at every tier rather than a card it cannot play', () => {
    const empty = view({ hand: [] });
    for (const tier of CARD_BOT_TIERS) {
      expect(chooseCard(empty, new Rng(1), tier)).toBeNull();
    }
  });

  it('no tier can read the opponent hand, because the view does not carry one', () => {
    expect(Object.keys(view())).not.toContain('opponentHand');
  });
});
