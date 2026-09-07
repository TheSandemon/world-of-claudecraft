// The health bars are held at their pre-round reading until the damage beat.
//
// The defect: a round resolves in the tick both cards land, so the bars dropped
// the moment the cards were played, roughly six seconds before the beat whose
// whole job is to show the hit landing. The `damage` beat lit a bar that had
// already moved, and a losing player watched their health reach zero while the
// cards were still turning.

import { describe, expect, it } from 'vitest';
import { buildDuelHealthHold, duelHealthShown } from '../src/ui/cards/duel_health_core';

describe('the pre-round health a round is told over', () => {
  it('adds the damage back onto the side that took it', () => {
    // The viewer lost the round: 100 -> 93, so the bars are held at 100.
    expect(buildDuelHealthHold({ damage: 7, damageTo: 'mine', myHp: 93, theirHp: 80 })).toEqual({
      myHp: 100,
      opponentHp: 80,
    });
  });

  it('holds the OPPONENT bar when the hit went the other way', () => {
    expect(buildDuelHealthHold({ damage: 12, damageTo: 'theirs', myHp: 61, theirHp: 44 })).toEqual({
      myHp: 61,
      opponentHp: 56,
    });
  });

  it('reconstructs the reading a lethal round started from', () => {
    // The case the whole hold exists for: the bar that is about to empty must
    // still be full while the cards are turning.
    expect(buildDuelHealthHold({ damage: 9, damageTo: 'mine', myHp: 0, theirHp: 30 })).toEqual({
      myHp: 9,
      opponentHp: 30,
    });
  });

  it('holds nothing on a round that took no health', () => {
    // A push, and a margin of zero: there is no bar to reveal, so freezing one
    // would only delay the snapshot for nothing.
    expect(buildDuelHealthHold({ damage: 0, damageTo: 'mine', myHp: 90, theirHp: 90 })).toBeNull();
    expect(buildDuelHealthHold({ myHp: 90, theirHp: 90 })).toBeNull();
  });

  it('holds nothing when the round names no side or carries no health', () => {
    expect(buildDuelHealthHold({ damage: 5, myHp: 90, theirHp: 90 })).toBeNull();
    expect(buildDuelHealthHold({ damage: 5, damageTo: 'mine', theirHp: 90 })).toBeNull();
    expect(buildDuelHealthHold({ damage: 5, damageTo: 'mine', myHp: 90 })).toBeNull();
  });
});

describe('what the bars actually show', () => {
  const snapshot = { myHp: 93, opponentHp: 80 };

  it('shows the hold while one is set', () => {
    expect(duelHealthShown(snapshot, { myHp: 100, opponentHp: 80 })).toEqual({
      myHp: 100,
      opponentHp: 80,
    });
  });

  it('falls back to the snapshot with no hold, which is every other moment', () => {
    expect(duelHealthShown(snapshot, null)).toBe(snapshot);
  });
});
