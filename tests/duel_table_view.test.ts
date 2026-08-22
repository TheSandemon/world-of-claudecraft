import { describe, expect, it } from 'vitest';
import {
  buildDuelClock,
  buildDuelCounters,
  buildDuelHealth,
  buildDuelSeat,
  buildDuelTable,
  DUEL_CLOCK_URGENT_S,
  type DuelTableInput,
} from '../src/ui/cards/duel_table_view';

function tableInput(over: Partial<DuelTableInput> = {}): DuelTableInput {
  return {
    waitingOnOpponent: false,
    opponentCommitted: false,
    myRounds: 0,
    opponentRounds: 0,
    myHp: 100,
    opponentHp: 100,
    maxHp: 100,
    myCounters: {},
    opponentCounters: {},
    secondsLeft: 45,
    roundWindow: 45,
    opponentRevealed: [],
    ...over,
  };
}

describe('duel clock model', () => {
  it('reads whole seconds up, so a player never reads a second they no longer have', () => {
    expect(buildDuelClock(12.4, 45).seconds).toBe(13);
    expect(buildDuelClock(0.2, 45).seconds).toBe(1);
  });

  it('drains the ratio against the real round window', () => {
    expect(buildDuelClock(45, 45).ratio).toBe(1);
    expect(buildDuelClock(9, 45).ratio).toBeCloseTo(0.2);
    expect(buildDuelClock(0, 45).ratio).toBe(0);
  });

  it('names the urgency band at the same threshold the number changes color at', () => {
    expect(buildDuelClock(DUEL_CLOCK_URGENT_S + 1, 45).band).toBe('calm');
    expect(buildDuelClock(DUEL_CLOCK_URGENT_S, 45).band).toBe('urgent');
    expect(buildDuelClock(0, 45).band).toBe('out');
  });

  it('never reports a negative second or an out-of-range ratio', () => {
    const past = buildDuelClock(-3, 45);
    expect(past.seconds).toBe(0);
    expect(past.ratio).toBe(0);
    expect(buildDuelClock(90, 45).ratio).toBe(1);
  });

  it('leaves the ring full rather than dividing by zero on a windowless table', () => {
    // The standalone hot seat has no server deadline. A broken ring must never
    // make a live clock read as expired.
    expect(buildDuelClock(10, 0).ratio).toBe(1);
    expect(buildDuelClock(null, 45)).toEqual({ seconds: 0, ratio: 0, band: 'out' });
  });
});

describe('duel health model', () => {
  it('reads the exact number and the share of the pool it is', () => {
    expect(buildDuelHealth(68, 100)).toEqual({ hp: 68, max: 100, ratio: 0.68, band: 'healthy' });
  });

  it('names the band a stylesheet acts on, at the thresholds it declares', () => {
    expect(buildDuelHealth(51, 100).band).toBe('healthy');
    expect(buildDuelHealth(50, 100).band).toBe('hurt');
    expect(buildDuelHealth(26, 100).band).toBe('hurt');
    expect(buildDuelHealth(25, 100).band).toBe('critical');
    expect(buildDuelHealth(0, 100).band).toBe('critical');
  });

  it('never overflows its track and never goes negative', () => {
    // Both are rendering bugs that would be reported as rules bugs.
    expect(buildDuelHealth(140, 100)).toEqual({ hp: 100, max: 100, ratio: 1, band: 'healthy' });
    expect(buildDuelHealth(-20, 100)).toEqual({ hp: 0, max: 100, ratio: 0, band: 'critical' });
  });

  it('leaves the bar empty rather than dividing by a zero pool', () => {
    expect(buildDuelHealth(0, 0)).toEqual({ hp: 0, max: 0, ratio: 0, band: 'critical' });
  });
});

describe('duel counter tokens', () => {
  it('drops a counter spent back to nothing', () => {
    expect(buildDuelCounters({ Web: 2, Dread: 0 })).toEqual([{ key: 'Web', count: 2 }]);
  });

  it('drops a negative counter too', () => {
    expect(buildDuelCounters({ Web: -1 })).toEqual([]);
  });

  it('orders by key, so the token row never reshuffles between two equal snapshots', () => {
    expect(buildDuelCounters({ Web: 1, Dread: 2 }).map((token) => token.key)).toEqual([
      'Dread',
      'Web',
    ]);
    expect(buildDuelCounters({ Dread: 2, Web: 1 }).map((token) => token.key)).toEqual([
      'Dread',
      'Web',
    ]);
  });
});

describe('duel table model', () => {
  it('names whose commit the round is waiting on, in all four states', () => {
    const waitingOn = (over: Partial<DuelTableInput>) => buildDuelTable(tableInput(over)).waitingOn;
    expect(waitingOn({})).toBe('both');
    expect(waitingOn({ waitingOnOpponent: true })).toBe('them');
    expect(waitingOn({ opponentCommitted: true })).toBe('me');
    expect(waitingOn({ waitingOnOpponent: true, opponentCommitted: true })).toBe('nobody');
  });

  it('lamps each seat from its own commit, never from the other one', () => {
    const model = buildDuelTable(tableInput({ waitingOnOpponent: true }));
    expect(model.mine.commit).toBe('locked');
    expect(model.theirs.commit).toBe('choosing');
  });

  it('keeps each side score and counters on its own band', () => {
    const model = buildDuelTable(
      tableInput({
        myRounds: 1,
        opponentRounds: 0,
        myCounters: { Web: 3 },
        opponentCounters: { Dread: 1 },
      }),
    );
    expect(model.mine.roundWins).toBe(1);
    expect(model.theirs.roundWins).toBe(0);
    expect(model.mine.counters).toEqual([{ key: 'Web', count: 3 }]);
    expect(model.theirs.counters).toEqual([{ key: 'Dread', count: 1 }]);
  });

  it('builds a lone seat band the same way the table builds both', () => {
    // The standalone hot seat has two symmetric seats and no "opponent".
    const seat = buildDuelSeat({
      committed: true,
      roundWins: 1,
      hp: 100,
      maxHp: 100,
      counters: { Web: 1 },
    });
    expect(seat).toEqual(
      buildDuelTable(tableInput({ waitingOnOpponent: true, myRounds: 1, myCounters: { Web: 1 } }))
        .mine,
    );
  });
});
