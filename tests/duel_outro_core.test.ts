// The match ENDING (src/ui/cards/duel_outro_core.ts) and the completion hook it
// hangs off (src/ui/cards/duel_theater.ts).
//
// The defect these are written around: the sim emits cardDuelMatchEnd in the
// SAME tick as the final cardRoundResolved, and the window answered it by
// stopping the theater and rendering the summary. So the round that decided the
// match was the one round a player never got to watch. The rule pinned here is
// that a queued ending waits for the round to finish speaking, then plays its
// own beats, and only then does the summary take the window.

import { describe, expect, it } from 'vitest';
import {
  buildDuelStage,
  type DuelBeatCue,
  type DuelBeatPhase,
} from '../src/ui/cards/duel_beats_core';
import {
  buildDuelOutro,
  DUEL_OUTRO_GAP_MS,
  DUEL_OUTRO_LEAD_MS,
  duelOutroSpanMs,
  isDuelOutroBeat,
} from '../src/ui/cards/duel_outro_core';
import { DuelTheater, type DuelTheaterHost } from '../src/ui/cards/duel_theater';

function fakeHost() {
  const phases: DuelBeatPhase[] = [];
  const cues: DuelBeatCue[] = [];
  const timers = new Map<number, { at: number; fn: () => void }>();
  let now = 0;
  let nextHandle = 1;
  const host: DuelTheaterHost = {
    open: (beat) => phases.push(beat.phase),
    play: (cue) => cues.push(cue),
    schedule(ms, fn) {
      const handle = nextHandle++;
      timers.set(handle, { at: now + ms, fn });
      return handle;
    },
    cancel(handle) {
      timers.delete(handle);
    },
  };
  return {
    host,
    phases,
    cues,
    pending: () => timers.size,
    advance(ms: number) {
      now += ms;
      for (const [handle, timer] of [...timers].sort((x, y) => x[1].at - y[1].at)) {
        if (timer.at > now) continue;
        timers.delete(handle);
        timer.fn();
      }
    },
  };
}

const winStage = buildDuelStage({
  mine: 7,
  theirs: 4,
  mineBase: 5,
  theirsBase: 4,
  outcome: 'win',
  reshuffled: false,
  damage: 3,
  damageTo: 'theirs',
});

const PAST_THE_ROUND = 60_000;

describe('duel outro core', () => {
  it('plays three beats in order, each with room to be watched', () => {
    const beats = buildDuelOutro('win', 'full');
    expect(beats.map((b) => b.phase)).toEqual(['finish', 'glory', 'curtain']);
    // Strictly increasing, so no two beats open in the same frame: a beat a
    // player cannot tell apart from its neighbour is not a beat.
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].at).toBeGreaterThan(beats[i - 1].at);
    }
    // The first beat waits: the round's settled picture is owed a frame of its
    // own before the ending starts writing over it.
    expect(beats[0].at).toBe(DUEL_OUTRO_LEAD_MS);
    expect(beats[0].at).toBeGreaterThan(0);
    expect(beats[1].at).toBe(DUEL_OUTRO_LEAD_MS + DUEL_OUTRO_GAP_MS.finish);
    expect(beats[2].at).toBe(
      DUEL_OUTRO_LEAD_MS + DUEL_OUTRO_GAP_MS.finish + DUEL_OUTRO_GAP_MS.glory,
    );
  });

  it('points the finishing beat at the health bar that actually ran out', () => {
    // A win means THEIR bar emptied. Getting this backwards would put the gold
    // ring on the winner's own health, which is the one bar that did not decide
    // anything.
    expect(buildDuelOutro('win', 'full')[0].spotlight).toBe('theirs-hp');
    expect(buildDuelOutro('lose', 'full')[0].spotlight).toBe('mine-hp');
    // A draw is about the table, not about a seat.
    expect(buildDuelOutro('draw', 'full')[0].spotlight).toBeNull();
  });

  it('gives calm motion every beat at the same times, exactly like a round', () => {
    // The fairness ladder in src/ui/cards/CLAUDE.md: the lowest preset and
    // reduced motion lose the MOVEMENT (dropped in CSS), never the beats.
    const full = buildDuelOutro('win', 'full');
    const calm = buildDuelOutro('win', 'calm');
    expect(calm.map((b) => b.phase)).toEqual(full.map((b) => b.phase));
    expect(calm.map((b) => b.at)).toEqual(full.map((b) => b.at));
  });

  it('has no timeline at all for a stage nobody is watching', () => {
    // `none` is the driver's catch-up answer (a closed window). An outro owes
    // that case nothing: the match is already over and the summary is the only
    // correct picture.
    expect(buildDuelOutro('win', 'none')).toEqual([]);
    expect(duelOutroSpanMs([])).toBe(0);
  });

  it('counts the last beat OWN hold into the span, not just when it opens', () => {
    // The span is when the summary is owed the window. Measuring it as the last
    // beat's start would cut the curtain beat off before it has held for a
    // single frame.
    const beats = buildDuelOutro('win', 'full');
    const span = duelOutroSpanMs(beats);
    expect(span).toBe(beats[2].at + DUEL_OUTRO_GAP_MS.curtain);
    expect(span).toBeGreaterThan(beats[2].at);
  });

  it('gives every ending beat a cue, and the verdict rides `glory`', () => {
    // These used to be silent, on the reasoning that the match end "already
    // has its own sound fired by the event handler". That was true and it was
    // the defect: the sound fired on the EVENT, which the sim emits in the
    // same tick as the final round, so a player heard the match end while the
    // round that decided it was still being told, and then watched three more
    // beats go by in silence.
    const cues = (outcome: 'win' | 'lose' | 'draw') =>
      buildDuelOutro(outcome, 'full').map((b) => b.cue);
    expect(cues('win')).toEqual(['finish', 'matchWin', 'curtain']);
    expect(cues('lose')).toEqual(['finish', 'matchLose', 'curtain']);
    // A drawn match takes the vocabulary's existing word for "neither side
    // took it" rather than minting a fourth verdict sound.
    expect(cues('draw')).toEqual(['finish', 'push', 'curtain']);
    for (const outcome of ['win', 'lose', 'draw'] as const) {
      expect(cues(outcome)).not.toContain(null);
    }
  });

  it('tells an outro beat from a round beat', () => {
    for (const beat of buildDuelOutro('win', 'full')) expect(isDuelOutroBeat(beat)).toBe(true);
    expect(
      isDuelOutroBeat({ phase: 'settle', at: 0, cue: null, step: null, spotlight: null }),
    ).toBe(false);
    expect(
      isDuelOutroBeat({ phase: 'verdict', at: 0, cue: null, step: null, spotlight: null }),
    ).toBe(false);
  });
});

describe('duel theater completion hook', () => {
  it('does not run the ending until the round has finished being told', () => {
    // THE regression. The ending must not land on the deal beat, which is where
    // the match-end event actually arrives.
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    let endedAfter: DuelBeatPhase[] | null = null;
    theater.play(winStage, 'full', () => {
      endedAfter = [...rig.phases];
    });
    expect(rig.phases).toEqual(['deal']);
    expect(endedAfter).toBeNull();

    rig.advance(PAST_THE_ROUND);
    // It ran, and by the time it ran the whole round had been told.
    expect(endedAfter).not.toBeNull();
    expect(endedAfter).toEqual(['deal', 'reveal', 'clash', 'damage', 'verdict', 'settle']);
  });

  it('runs the ending exactly once, even if the timeline is finished early', () => {
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    let calls = 0;
    theater.play(winStage, 'full', () => {
      calls++;
    });
    // A stalled client: the driver jumps to the settled picture. The ending is
    // still owed its turn, or a slow frame would silently swallow the summary.
    theater.finishNow();
    expect(calls).toBe(1);
    theater.finishNow();
    rig.advance(PAST_THE_ROUND);
    expect(calls).toBe(1);
  });

  it('drops a queued ending when the window closes', () => {
    // stop() means the window is going away: there is no stage left to play an
    // ending on, so it must not fire into a torn-down surface.
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    let calls = 0;
    theater.play(winStage, 'full', () => {
      calls++;
    });
    theater.stop();
    rig.advance(PAST_THE_ROUND);
    expect(calls).toBe(0);
  });

  it('plays the outro beats over the finished stage, then hands off', () => {
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    let handedOff = false;
    const beats = buildDuelOutro('win', 'full');
    theater.playBeats(
      beats,
      () => {
        handedOff = true;
      },
      duelOutroSpanMs(beats),
    );
    // Nothing opens synchronously any more: the lead keeps the settled round
    // on screen first.
    expect(rig.phases).toEqual([]);
    rig.advance(DUEL_OUTRO_LEAD_MS);
    expect(rig.phases).toEqual(['finish']);
    expect(handedOff).toBe(false);
    rig.advance(DUEL_OUTRO_GAP_MS.finish);
    expect(rig.phases).toEqual(['finish', 'glory']);
    expect(handedOff).toBe(false);
    rig.advance(DUEL_OUTRO_GAP_MS.glory);
    expect(rig.phases).toEqual(['finish', 'glory', 'curtain']);
    // The curtain beat has OPENED but not yet held: handing the window over
    // here would delete it, which is the same defect one layer down.
    expect(handedOff).toBe(false);
    rig.advance(DUEL_OUTRO_GAP_MS.curtain);
    expect(handedOff).toBe(true);
  });

  it('hands off at once when there is no outro to play', () => {
    const rig = fakeHost();
    let handedOff = false;
    new DuelTheater(rig.host).playBeats(buildDuelOutro('win', 'none'), () => {
      handedOff = true;
    });
    expect(handedOff).toBe(true);
    expect(rig.phases).toEqual([]);
  });
});
