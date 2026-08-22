import { describe, expect, it } from 'vitest';
import { CARD_NARRATION_MAX_S } from '../src/sim/minigames/card_duel/narration';
import {
  buildDuelBeats,
  buildDuelStage,
  DUEL_BEAT_GAP_MS,
  type DuelRoundInput,
  duelBeatSpan,
  duelCues,
} from '../src/ui/cards/duel_beats_core';

/** One narrated effect, as the wire carries it. */
function step(amount: number) {
  return {
    side: 'mine' as const,
    cardId: 'stablemaster',
    effect: 'modifyValue',
    target: 'mine' as const,
    amount,
    valueAfter: 7 + amount,
  };
}

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

  it('gives every effect that happened its own beat, and a plain round none', () => {
    // The whole shape of the fix: a round is as long as it earned. A player
    // watching three effects land sees three moments, and a player whose round
    // was two bare numbers waits through nothing at all.
    const plain = buildDuelBeats(buildDuelStage(plainWin));
    const busy = buildDuelBeats(buildDuelStage({ ...plainWin, steps: [step(2), step(-1)] }));
    expect(plain.map((b) => b.phase)).toEqual(['deal', 'reveal', 'clash', 'verdict', 'settle']);
    expect(busy.map((b) => b.phase)).toEqual([
      'deal',
      'reveal',
      'step',
      'step',
      'clash',
      'verdict',
      'settle',
    ]);
    // And each step beat carries WHICH effect it narrates, or the line it shows
    // could only ever say "something changed".
    expect(busy.filter((b) => b.phase === 'step').map((b) => b.step?.amount)).toEqual([2, -1]);
    expect(duelBeatSpan(busy)).toBe(duelBeatSpan(plain) + DUEL_BEAT_GAP_MS.step * 2);
  });

  it('pays for the hit only on a round that dealt one', () => {
    const hit = buildDuelBeats(buildDuelStage({ ...plainWin, damage: 3, damageTo: 'theirs' }));
    const bloodless = buildDuelBeats(buildDuelStage({ ...plainWin, damage: 0 }));
    expect(hit.some((b) => b.phase === 'damage')).toBe(true);
    expect(bloodless.some((b) => b.phase === 'damage')).toBe(false);
    expect(duelBeatSpan(hit)).toBe(duelBeatSpan(bloodless) + DUEL_BEAT_GAP_MS.damage);
  });

  it('keeps even a busy round inside the engine cap it shares with the sim', () => {
    // The sim stops the round clock for exactly as long as this timeline runs,
    // so an unbounded story would be an unbounded pause.
    const longest = buildDuelBeats(
      buildDuelStage({
        ...plainWin,
        steps: Array.from({ length: 12 }, (_, i) => step(i + 1)),
        damage: 9,
        damageTo: 'theirs',
        outcome: 'push',
        reshuffled: true,
      }),
    );
    expect(duelBeatSpan(longest)).toBeLessThanOrEqual(CARD_NARRATION_MAX_S * 1000);
    // Squeezed, never truncated: all twelve effects still get a moment.
    expect(longest.filter((b) => b.phase === 'step').length).toBe(12);
  });

  it('holds the face-down beat under a third of a second', () => {
    // The stage's ONE bounded delay: the cards of an already-decided round stay
    // face-down while they land. Anything longer starts to read as a stall.
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    const reveal = beats.find((b) => b.phase === 'reveal');
    expect(reveal?.at).toBeLessThan(300);
  });

  it('puts each cue on the beat it belongs to, one per effect included', () => {
    const push = buildDuelBeats(
      buildDuelStage({
        ...plainWin,
        outcome: 'push',
        reshuffled: true,
        steps: [step(2)],
        damage: 4,
        damageTo: 'mine',
      }),
    );
    const cueAt = (phase: string) => push.find((b) => b.phase === phase)?.cue;
    expect(cueAt('reveal')).toBe('reveal');
    expect(cueAt('step')).toBe('effect');
    expect(cueAt('damage')).toBe('hit');
    expect(cueAt('verdict')).toBe('push');
    expect(cueAt('settle')).toBe('shuffle');
    expect(cueAt('deal')).toBeNull();
  });

  it('fires no push cue on a decided round and no shuffle without a reshuffle', () => {
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    expect(beats.filter((b) => b.cue !== null).map((b) => b.cue)).toEqual(['reveal']);
  });

  it('gives the low preset the same beats as the full timeline, not a collapse', () => {
    // 'steps' sheds the motion, never the pacing: the difference between it and
    // 'full' lives in the stylesheet, so the beats and their times must match
    // exactly. A collapse here would be the bug this mode exists to fix.
    const stage = buildDuelStage({ ...plainWin, mine: 9, mineBase: 7 });
    expect(buildDuelBeats(stage, 'steps')).toEqual(buildDuelBeats(stage, 'full'));
  });

  it('collapses to a single settled beat at zero when motion is off', () => {
    // The whole reason the collapse is legal: it shows the same result at the
    // same instant, so reduced motion and the low preset cost no information.
    const beats = buildDuelBeats(buildDuelStage(plainWin), 'none');
    expect(beats).toEqual([{ phase: 'settle', at: 0, cue: null, step: null }]);
    expect(duelBeatSpan(beats)).toBe(0);
  });

  it('still owes every cue when the timeline is collapsed, one per effect', () => {
    // A collapsed round must still SOUND like the round it was: three effects
    // is three ticks, not one.
    const stage = buildDuelStage({
      ...plainWin,
      outcome: 'push',
      reshuffled: true,
      steps: [step(1), step(-2)],
      damage: 5,
      damageTo: 'mine',
    });
    expect(duelCues(stage)).toEqual(['reveal', 'effect', 'effect', 'hit', 'push', 'shuffle']);
    expect(duelCues(buildDuelStage(plainWin))).toEqual(['reveal']);
  });

  it('is a pure function of the round', () => {
    const stage = buildDuelStage(plainWin);
    expect(buildDuelBeats(stage)).toEqual(buildDuelBeats(buildDuelStage(plainWin)));
  });
});
