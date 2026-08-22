import { describe, expect, it } from 'vitest';
import {
  buildDuelSummary,
  DUEL_SUMMARY_ROW_MS,
  type DuelSummaryInput,
  summaryRowDelayMs,
} from '../src/ui/cards/duel_summary_view';

function finished(over: Partial<DuelSummaryInput> = {}): DuelSummaryInput {
  return {
    won: true,
    rounds: 9,
    myHp: 34,
    theirHp: 0,
    maxHp: 100,
    damageDealt: 100,
    damageTaken: 66,
    bestHit: { round: 4, cardId: 'pack_alpha', amount: 14 },
    opponentId: 'gravedigger_ossa',
    ...over,
  };
}

describe('duel summary model', () => {
  it('reads the result the player actually got, draw included', () => {
    expect(buildDuelSummary(finished()).outcome).toBe('win');
    expect(buildDuelSummary(finished({ won: false })).outcome).toBe('loss');
    // A draw is not a loss with extra steps: both flags arrive and draw wins.
    expect(buildDuelSummary(finished({ won: false, draw: true })).outcome).toBe('draw');
  });

  it('lays the match out in the order it is read: what is left, then what happened', () => {
    const model = buildDuelSummary(finished());
    expect(model.rows.map((row) => row.kind)).toEqual([
      'health',
      'rounds',
      'dealt',
      'taken',
      'bestHit',
    ]);
    expect(model.rows[0]).toEqual({ kind: 'health', value: 34, of: 100 });
    expect(model.rows[4]).toEqual({
      kind: 'bestHit',
      value: 14,
      cardId: 'pack_alpha',
      round: 4,
    });
  });

  it('drops the best hit rather than showing an empty one', () => {
    // A player who lost without ever connecting should not be handed a row
    // that says so with a blank.
    const none = buildDuelSummary(finished({ bestHit: undefined }));
    expect(none.rows.some((row) => row.kind === 'bestHit')).toBe(false);
    const zero = buildDuelSummary(
      finished({ bestHit: { round: 2, cardId: 'grave_rat', amount: 0 } }),
    );
    expect(zero.rows.some((row) => row.kind === 'bestHit')).toBe(false);
  });

  it('offers a rematch only against an opponent that can be sat down against again', () => {
    // The regulars are always at the table; a human has to be queued for.
    expect(buildDuelSummary(finished()).canRematch).toBe(true);
    expect(
      buildDuelSummary(finished({ opponentId: undefined, opponentName: 'Bo' })).canRematch,
    ).toBe(false);
  });

  it('never shows a negative number, whatever arrives', () => {
    const model = buildDuelSummary(
      finished({ myHp: -12, rounds: -1, damageDealt: -5, damageTaken: -7 }),
    );
    expect(model.rows.every((row) => row.value >= 0)).toBe(true);
  });

  it('lands the rows one at a time', () => {
    expect(summaryRowDelayMs(0)).toBe(0);
    expect(summaryRowDelayMs(3)).toBe(DUEL_SUMMARY_ROW_MS * 3);
    // The whole panel is still readable in well under a second.
    expect(summaryRowDelayMs(5)).toBeLessThan(1000);
  });
});
