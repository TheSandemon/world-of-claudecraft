import { describe, expect, it } from 'vitest';
import {
  buildDuelClock,
  buildDuelCounters,
  buildDuelPips,
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
    roundsToWin: 2,
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

describe('duel score pips', () => {
  it('draws one pip per round the match needs, filling the ones already won', () => {
    expect(buildDuelPips(1, 2)).toEqual([
      { index: 0, filled: true },
      { index: 1, filled: false },
    ]);
  });

  it('never grows the track past the match length', () => {
    // A snapshot arriving one round late must not add a pip.
    const pips = buildDuelPips(5, 2);
    expect(pips.length).toBe(2);
    expect(pips.every((pip) => pip.filled)).toBe(true);
  });

  it('handles a zero-length track without throwing', () => {
    expect(buildDuelPips(0, 0)).toEqual([]);
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
    expect(model.mine.pips.filter((pip) => pip.filled).length).toBe(1);
    expect(model.theirs.pips.filter((pip) => pip.filled).length).toBe(0);
    expect(model.mine.counters).toEqual([{ key: 'Web', count: 3 }]);
    expect(model.theirs.counters).toEqual([{ key: 'Dread', count: 1 }]);
  });

  it('builds a lone seat band the same way the table builds both', () => {
    // The standalone hot seat has two symmetric seats and no "opponent".
    const seat = buildDuelSeat({
      committed: true,
      roundWins: 1,
      roundsToWin: 2,
      counters: { Web: 1 },
    });
    expect(seat).toEqual(
      buildDuelTable(tableInput({ waitingOnOpponent: true, myRounds: 1, myCounters: { Web: 1 } }))
        .mine,
    );
  });
});
