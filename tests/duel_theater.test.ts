import { describe, expect, it } from 'vitest';
import {
  buildDuelStage,
  type DuelBeatCue,
  type DuelBeatPhase,
} from '../src/ui/cards/duel_beats_core';
import { DuelTheater, type DuelTheaterHost } from '../src/ui/cards/duel_theater';

/** A host over a fake clock: the theater owns no timer API, which is the whole
 *  reason a whole round can be driven here in plain Node. */
function fakeHost() {
  const phases: DuelBeatPhase[] = [];
  const cues: DuelBeatCue[] = [];
  const timers = new Map<number, { at: number; fn: () => void }>();
  let now = 0;
  let nextHandle = 1;
  const host: DuelTheaterHost = {
    setPhase: (phase) => phases.push(phase),
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
});

describe('duel theater', () => {
  it('opens the first beat synchronously, then walks the rest on the clock', () => {
    const rig = fakeHost();
    new DuelTheater(rig.host).play(winStage, 'full');
    expect(rig.phases).toEqual(['deal']);
    rig.advance(5000);
    expect(rig.phases).toEqual(['deal', 'reveal', 'shift', 'clash', 'verdict', 'settle']);
    expect(rig.pending()).toBe(0);
  });

  it('fires each cue as its own beat opens, not all at once', () => {
    const rig = fakeHost();
    const push = buildDuelStage({ mine: 4, theirs: 4, outcome: 'push', reshuffled: true });
    new DuelTheater(rig.host).play(push, 'full');
    expect(rig.cues).toEqual([]);
    rig.advance(300);
    expect(rig.cues).toEqual(['reveal']);
    rig.advance(5000);
    expect(rig.cues).toEqual(['reveal', 'push', 'shuffle']);
  });

  it('lands on the settled picture at once when motion is off, cues and all', () => {
    const rig = fakeHost();
    const push = buildDuelStage({ mine: 4, theirs: 4, outcome: 'push', reshuffled: true });
    new DuelTheater(rig.host).play(push, 'none');
    expect(rig.phases).toEqual(['settle']);
    expect(rig.cues).toEqual(['reveal', 'push', 'shuffle']);
    // Nothing left to fire: a collapsed timeline costs no timers either.
    expect(rig.pending()).toBe(0);
  });

  it('finishes a running round before starting the next one', () => {
    // Rounds cannot legally overlap, so this only fires when a client stalls or
    // a window reopens; when it does, no half-played beat may own the stage.
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    theater.play(winStage, 'full');
    rig.advance(300);
    expect(rig.phases).toEqual(['deal', 'reveal']);
    theater.play(winStage, 'full');
    expect(rig.phases).toEqual(['deal', 'reveal', 'settle', 'deal']);
    rig.advance(5000);
    expect(rig.phases[rig.phases.length - 1]).toBe('settle');
  });

  it('drops every scheduled beat when the stage stops being watched', () => {
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    theater.play(winStage, 'full');
    theater.stop();
    expect(rig.pending()).toBe(0);
    rig.advance(5000);
    // A closed window paints no further beats at an element nobody is watching.
    expect(rig.phases).toEqual(['deal']);
    expect(theater.current).toBeNull();
  });

  it('jumps a running timeline straight to the settled picture', () => {
    const rig = fakeHost();
    const theater = new DuelTheater(rig.host);
    theater.play(winStage, 'full');
    theater.finishNow();
    expect(rig.phases).toEqual(['deal', 'settle']);
    rig.advance(5000);
    expect(rig.phases).toEqual(['deal', 'settle']);
  });
});
