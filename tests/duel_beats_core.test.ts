import { describe, expect, it } from 'vitest';
import {
  CARD_NARRATION_MAX_S,
  cardNarrationSeconds,
} from '../src/sim/minigames/card_duel/narration';
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

  it('keeps the face-down beat the shortest one in the timeline', () => {
    // The stage's ONE bounded delay: the cards of an already-decided round stay
    // face-down while they land. It is pinned RELATIVELY rather than to a
    // number of milliseconds, because the beats are retuned as a set and an
    // absolute bound here would just be re-edited every time; what must stay
    // true is that the one beat showing nothing is the one that ends soonest.
    const beats = buildDuelBeats(buildDuelStage(plainWin));
    const reveal = beats.find((b) => b.phase === 'reveal');
    expect(reveal?.at).toBe(DUEL_BEAT_GAP_MS.deal);
    const others = (['reveal', 'step', 'clash', 'damage', 'verdict'] as const).map(
      (phase) => DUEL_BEAT_GAP_MS[phase],
    );
    expect(Math.min(...others)).toBeGreaterThan(DUEL_BEAT_GAP_MS.deal);
  });

  it('points each beat at the one thing it is about', () => {
    // The gold outline's whole job: "which of these two cards did that". A
    // step follows the VALUE that moved, not the card that did the moving, so
    // their card silencing yours lights YOURS.
    const beats = buildDuelBeats(
      buildDuelStage({
        ...plainWin,
        steps: [{ ...step(2), side: 'theirs', target: 'mine' }],
        damage: 3,
        damageTo: 'theirs',
      }),
    );
    const spotAt = (phase: string) => beats.find((b) => b.phase === phase)?.spotlight;
    expect(spotAt('deal')).toBeNull();
    expect(spotAt('reveal')).toBe('both');
    expect(spotAt('step')).toBe('mine');
    expect(spotAt('clash')).toBe('both');
    // The hit points at the BAR that drained, not at a card: it is the only
    // beat whose subject is not on the stage at all.
    expect(spotAt('damage')).toBe('theirs-hp');
    expect(spotAt('verdict')).toBe('mine');
    expect(spotAt('settle')).toBeNull();
  });

  it('points the verdict at the winner, whichever side that is, and at both on a push', () => {
    const spotOn = (input: DuelRoundInput) =>
      buildDuelBeats(buildDuelStage(input)).find((b) => b.phase === 'verdict')?.spotlight;
    expect(spotOn(plainWin)).toBe('mine');
    expect(spotOn({ ...plainWin, mine: 4, theirs: 7, outcome: 'lose' })).toBe('theirs');
    expect(spotOn({ ...plainWin, theirs: 7, outcome: 'push' })).toBe('both');
  });

  it('falls back to the acting card when a step moved no value at all', () => {
    // A draw or a reveal has no target: the card that did it is then the only
    // thing on the table the beat could mean.
    const beats = buildDuelBeats(
      buildDuelStage({
        ...plainWin,
        steps: [{ side: 'theirs', cardId: 'scout', effect: 'reveal' }],
      }),
    );
    expect(beats.find((b) => b.phase === 'step')?.spotlight).toBe('theirs');
  });

  it('ends its last beat exactly when the sim stops holding the round clock', () => {
    // The two halves of one number (see narration.ts): the sim holds play for
    // cardNarrationSeconds and the client spends it walking these beats. Drift
    // either way is a story still running after the clock restarts, or a clock
    // held for a story that already ended. Now that play is CLOSED for that
    // window, the drift would also be a hand that unlocks at the wrong moment.
    for (const steps of [0, 1, 3]) {
      const stage = buildDuelStage({
        ...plainWin,
        steps: Array.from({ length: steps }, (_, i) => step(i + 1)),
        damage: 3,
        damageTo: 'theirs',
      });
      const held = cardNarrationSeconds({ log: stage.steps, damage: stage.damage }) * 1000;
      expect(duelBeatSpan(buildDuelBeats(stage))).toBeCloseTo(held, 6);
    }
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
    expect(cueAt('deal')).toBe('deal');
    expect(cueAt('reveal')).toBe('reveal');
    expect(cueAt('step')).toBe('effect');
    expect(cueAt('clash')).toBe('clash');
    expect(cueAt('damage')).toBe('hit');
    expect(cueAt('verdict')).toBe('push');
    expect(cueAt('settle')).toBe('shuffle');
    // EVERY beat is audible. Half of them used to be silent (the deal, the
    // clash, a decided verdict, a settle with no reshuffle), so the round's
    // audio told a shorter story than its picture did, and told a player who
    // was not watching the window almost nothing at all.
    expect(push.filter((b) => b.cue === null)).toEqual([]);
  });

  it('branches the verdict and the settle on what actually happened', () => {
    // The two beats that carry two different pieces of news rather than two
    // volumes of the same one: who took the round, and whether the deck came
    // back around with it.
    const cueOn = (phase: string, input: Parameters<typeof buildDuelStage>[0]) =>
      buildDuelBeats(buildDuelStage(input)).find((b) => b.phase === phase)?.cue;
    expect(cueOn('verdict', plainWin)).toBe('roundWin');
    expect(cueOn('verdict', { ...plainWin, outcome: 'lose' })).toBe('roundLose');
    expect(cueOn('verdict', { ...plainWin, outcome: 'push' })).toBe('push');
    expect(cueOn('settle', plainWin)).toBe('settle');
    expect(cueOn('settle', { ...plainWin, reshuffled: true })).toBe('shuffle');
  });

  it('gives the calm level the same beats as the full timeline, never a collapse', () => {
    // The rule the whole level exists for: 'calm' sheds MOVEMENT, never the
    // pacing. The difference between it and 'full' lives entirely in the
    // stylesheet, so the beats and their times must match exactly. Both the
    // lowest preset and reduced motion resolve here, so a collapse in this
    // arm would be the original bug back again for both of them.
    const stage = buildDuelStage({ ...plainWin, mine: 9, mineBase: 7 });
    expect(buildDuelBeats(stage, 'calm')).toEqual(buildDuelBeats(stage, 'full'));
    // And it is a real sequence, not one beat wearing a different name.
    expect(buildDuelBeats(stage, 'calm').length).toBeGreaterThan(4);
  });

  it('collapses to a single settled beat at zero only when motion is off', () => {
    // 'none' is the driver's catch-up path (a stage nobody is watching), not
    // anything a player can select: resolveDuelMotion never returns it.
    const beats = buildDuelBeats(buildDuelStage(plainWin), 'none');
    expect(beats).toEqual([{ phase: 'settle', at: 0, cue: null, step: null, spotlight: null }]);
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
    expect(duelCues(stage)).toEqual([
      'deal',
      'reveal',
      'effect',
      'effect',
      'clash',
      'hit',
      'push',
      'shuffle',
    ]);
    expect(duelCues(buildDuelStage(plainWin))).toEqual([
      'deal',
      'reveal',
      'clash',
      'roundWin',
      'settle',
    ]);
  });

  it('reads the collapsed cues OFF the played timeline, so the two cannot drift', () => {
    // The teeth on the rewrite: duelCues used to be a second hand-written list
    // of the same decisions, which only has to be right and is never checked
    // at the moment it goes wrong. A round played with the window open and the
    // same round played with it shut would simply have sounded different.
    for (const input of [
      plainWin,
      { ...plainWin, outcome: 'lose' as const },
      { ...plainWin, outcome: 'push' as const, reshuffled: true },
      { ...plainWin, steps: [step(1), step(-2)], damage: 5, damageTo: 'mine' as const },
    ]) {
      const stage = buildDuelStage(input);
      expect(duelCues(stage)).toEqual(buildDuelBeats(stage, 'full').map((b) => b.cue));
    }
  });

  it('is a pure function of the round', () => {
    const stage = buildDuelStage(plainWin);
    expect(buildDuelBeats(stage)).toEqual(buildDuelBeats(buildDuelStage(plainWin)));
  });
});
