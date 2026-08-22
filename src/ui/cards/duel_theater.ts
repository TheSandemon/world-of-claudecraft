// The driver that plays a round timeline: it walks the beats duel_beats_core.ts
// decided and tells a host when each one opens.
//
// Deliberately tiny and injectable. It owns no element, no timer API, and no
// audio object: the host it is handed does the writing, so a test drives a
// whole round on a fake clock and the window supplies the real one. The only
// state it keeps is the handle of the beat it is waiting on, which is what
// makes a second round arriving mid-timeline safe rather than a race.

import {
  buildDuelBeats,
  type DuelBeat,
  type DuelBeatCue,
  type DuelMotion,
  type DuelStageModel,
  duelCues,
} from './duel_beats_core';

export interface DuelTheaterHost {
  /** Opens a beat: the stage paints itself for it. Takes the whole beat rather
   *  than its phase name because a `step` beat also carries WHICH effect it is
   *  narrating, and that is the difference between "something changed" and
   *  "their Nullstone silenced your wolf". */
  open(beat: DuelBeat): void;
  /** Fires one audio cue. */
  play(cue: DuelBeatCue): void;
  /** Schedules `fn` in `ms`, returning a cancellable handle. */
  schedule(ms: number, fn: () => void): number;
  cancel(handle: number): void;
}

/** The finished picture, as a beat: what a jumped-to or collapsed timeline
 *  opens. */
const SETTLED: DuelBeat = { phase: 'settle', at: 0, cue: null, step: null };

export class DuelTheater {
  private pending: number[] = [];
  private stage: DuelStageModel | null = null;

  constructor(private readonly host: DuelTheaterHost) {}

  /** The round currently on the stage, finished or mid-play. */
  get current(): DuelStageModel | null {
    return this.stage;
  }

  /** True while beats are still scheduled: the stage belongs to the timeline
   *  and no snapshot repaint may take it. */
  get isPlaying(): boolean {
    return this.pending.length > 0;
  }

  /**
   * Plays one resolved round.
   *
   * A round already playing is FINISHED first rather than interrupted: the
   * previous round's result stays on the board for the instant before the new
   * one lands, and no half-played beat is left owning the stage. Rounds cannot
   * legally overlap (the next one cannot resolve until both seats commit
   * again), so this only fires when a client stalls or a window reopens.
   */
  play(stage: DuelStageModel, motion: DuelMotion): void {
    if (this.stage) this.finishNow();
    this.stage = stage;
    const beats = buildDuelBeats(stage, motion);
    if (motion === 'none') {
      // The collapsed timeline still owes the player every cue: they are
      // information (a push, a reshuffle), not decoration.
      this.openCollapsed(beats[0] ?? SETTLED, duelCues(stage));
      return;
    }
    for (const beat of beats) this.schedule(beat);
  }

  /** Jumps to the finished picture and drops every beat still scheduled. Used
   *  when the stage stops being watched (the window closed) or the next round
   *  arrives, so a timeline can never paint over a later truth. */
  finishNow(): void {
    if (this.pending.length === 0) return;
    this.clear();
    this.host.open(SETTLED);
  }

  /** Drops the timeline without touching the stage (the window is closing). */
  stop(): void {
    this.clear();
    this.stage = null;
  }

  private openCollapsed(beat: DuelBeat, cues: readonly DuelBeatCue[]): void {
    this.host.open(beat);
    for (const cue of cues) this.host.play(cue);
  }

  private schedule(beat: DuelBeat): void {
    const open = () => {
      this.host.open(beat);
      if (beat.cue) this.host.play(beat.cue);
    };
    if (beat.at <= 0) {
      open();
      return;
    }
    const handle = this.host.schedule(beat.at, () => {
      this.pending = this.pending.filter((h) => h !== handle);
      open();
    });
    this.pending.push(handle);
  }

  private clear(): void {
    for (const handle of this.pending) this.host.cancel(handle);
    this.pending = [];
  }
}
