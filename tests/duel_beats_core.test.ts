import { describe, expect, it } from 'vitest';
import {
  buildDuelBeats,
  buildDuelStage,
  DUEL_BEAT_GAP_MS,
  type DuelRoundInput,
  duelBeatSpan,
  duelCues,
} from '../src/ui/cards/duel_beats_core';

const plainWin: DuelRoundInput = {
  mine: 7,
  theirs: 4,
  mineBase: 7,
  theirsBase: 4,
  outcome: 'win',
  reshuffled: false,
};

describe('duel stage model', () => {
  it('reads the signed delta an effect applied to each side', () => {
    const stage = buildDuelStage({
      mine: 9,
      theirs: 2,
      mineBase: 7,
      theirsBase: 4,
      outcome: 'win',
      reshuffled: false,
    });
    expect(stage.mine.delta).toBe(2);
    expect(stage.theirs.delta).toBe(-2);
    expect(stage.shifted).toBe(true);
  });

  it('falls back to the effective value when an older event carried no base', () => {
    // The two base fields arrived with the rules engine; an event minted before
    // it must still stage, as a round where nothing moved.
    const stage = buildDuelStage({ mine: 5, theirs: 3, outcome: 'win', reshuffled: false });
    expect(stage.mine.base).toBe(5);
    expect(stage.mine.delta).toBe(0);
    expect(stage.shifted).toBe(false);
    expect(stage.mine.cardId).toBeNull();
  });

  it('carries the two card ids the round clashed', () => {
    const stage = buildDuelStage({
      ...plainWin,
      mineCardId: 'forest_wolf',
      theirsCardId: 'grave_rat',
    });
    expect(stage.mine.cardId).toBe('forest_wolf');
    expect(stage.theirs.cardId).toBe('grave_rat');
  });
});

describe('duel beat timeline', () => {
  it('opens on the deal and ends on the settle, in order, never going backwards', () => {
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    expect(beats[0].phase).toBe('deal');
    expect(beats[0].at).toBe(0);
    expect(beats[beats.length - 1].phase).toBe('settle');
    for (let i = 1; i < beats.length; i++) expect(beats[i].at).toBeGreaterThan(beats[i - 1].at);
  });

  it('skips the shift beat when no effect moved a value, and pulls the rest forward', () => {
    // A plain round should not sit through a pause explaining a change that
    // never happened.
    const plain = buildDuelBeats(buildDuelStage(plainWin));
    const shifted = buildDuelBeats(
      buildDuelStage({ ...plainWin, mine: 9, mineBase: 7, theirs: 4, theirsBase: 4 }),
    );
    expect(plain.map((b) => b.phase)).toEqual(['deal', 'reveal', 'clash', 'verdict', 'settle']);
    expect(shifted.map((b) => b.phase)).toEqual([
      'deal',
      'reveal',
      'shift',
      'clash',
      'verdict',
      'settle',
    ]);
    expect(duelBeatSpan(plain)).toBe(duelBeatSpan(shifted) - DUEL_BEAT_GAP_MS.shift);
  });

  it('stays inside two and a half seconds, so a round never outlives its own moment', () => {
    const longest = buildDuelBeats(
      buildDuelStage({ ...plainWin, mine: 9, mineBase: 7, outcome: 'push', reshuffled: true }),
    );
    expect(duelBeatSpan(longest)).toBeLessThanOrEqual(2500);
  });

  it('holds the face-down beat under a third of a second', () => {
    // The stage's ONE bounded delay: the cards of an already-decided round stay
    // face-down while they land. Anything longer starts to read as a stall.
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    const reveal = beats.find((b) => b.phase === 'reveal');
    expect(reveal?.at).toBeLessThan(300);
  });

  it('puts each cue on the beat it belongs to', () => {
    const push = buildDuelBeats(buildDuelStage({ ...plainWin, outcome: 'push', reshuffled: true }));
    const cueAt = (phase: string) => push.find((b) => b.phase === phase)?.cue;
    expect(cueAt('reveal')).toBe('reveal');
    expect(cueAt('verdict')).toBe('push');
    expect(cueAt('settle')).toBe('shuffle');
    expect(cueAt('deal')).toBeNull();
  });

  it('fires no push cue on a decided round and no shuffle without a reshuffle', () => {
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    expect(beats.filter((b) => b.cue !== null).map((b) => b.cue)).toEqual(['reveal']);
  });

  it('collapses to a single settled beat at zero when motion is off', () => {
    // The whole reason the collapse is legal: it shows the same result at the
    // same instant, so reduced motion and the low preset cost no information.
    const beats = buildDuelBeats(buildDuelStage(plainWin), 'none');
    expect(beats).toEqual([{ phase: 'settle', at: 0, cue: null }]);
    expect(duelBeatSpan(beats)).toBe(0);
  });

  it('still owes every cue when the timeline is collapsed', () => {
    const stage = buildDuelStage({ ...plainWin, outcome: 'push', reshuffled: true });
    expect(duelCues(stage)).toEqual(['reveal', 'push', 'shuffle']);
    expect(duelCues(buildDuelStage(plainWin))).toEqual(['reveal']);
  });

  it('is a pure function of the round', () => {
    const stage = buildDuelStage(plainWin);
    expect(buildDuelBeats(stage)).toEqual(buildDuelBeats(buildDuelStage(plainWin)));
  });
});
