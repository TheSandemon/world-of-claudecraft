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
const SETTLED: DuelBeat = { phase: 'settle', at: 0, cue: null, step: null, spotlight: null };

export class DuelTheater {
  private pending: number[] = [];
  private stage: DuelStageModel | null = null;
  /**
   * What to run when the timeline reaches its last beat.
   *
   * The seam a MATCH ending hangs off. The sim emits the match-end event in the
   * same tick as the final round's resolution, so a window that acted on it
   * straight away tore down the one round that decided the match. Handing the
   * caller a "the round has finished speaking" moment lets the ending queue
   * behind it instead of preempting it.
   *
   * Fires at most once per timeline, and is cleared when it fires so a later
   * finishNow() cannot run it a second time.
   */
  private done: (() => void) | null = null;

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
  play(stage: DuelStageModel, motion: DuelMotion, onDone?: () => void): void {
    if (this.stage) this.finishNow();
    this.stage = stage;
    this.done = onDone ?? null;
    const beats = buildDuelBeats(stage, motion);
    if (motion === 'none') {
      // The collapsed timeline still owes the player every cue: they are
      // information (a push, a reshuffle), not decoration.
      this.openCollapsed(beats[0] ?? SETTLED, duelCues(stage));
      this.fireDone();
      return;
    }
    const last = beats.length - 1;
    beats.forEach((beat, index) => {
      this.schedule(beat, index === last);
    });
  }

  /**
   * Plays a timeline that is not a round: the match outro
   * (duel_outro_core.ts), in the same grammar and through the same host.
   *
   * It does not touch `stage`, because there is no new picture to own: the
   * outro plays OVER the finished round, which is the last thing the match had
   * to say. An empty list (motion `none`, a stage nobody is watching) runs
   * `onDone` at once rather than scheduling nothing and stranding the caller.
   */
  playBeats(beats: readonly DuelBeat[], onDone?: () => void, doneAfterMs = 0): void {
    this.clear();
    this.done = onDone ?? null;
    if (beats.length === 0) {
      this.fireDone();
      return;
    }
    // `doneAfterMs` exists because the last beat of an outro is not over when
    // it OPENS: it has its own hold, and handing the window to the summary on
    // the opening frame deletes that beat exactly the way the whole ending was
    // being deleted before. With it, the callback is its own timer at the end
    // of the span; without it, the last beat opening is the end (which is what
    // a round wants, since a round's last beat is the picture it rests on).
    const timed = doneAfterMs > 0;
    const last = beats.length - 1;
    beats.forEach((beat, index) => {
      this.schedule(beat, !timed && index === last);
    });
    if (!timed) return;
    const handle = this.host.schedule(doneAfterMs, () => {
      this.pending = this.pending.filter((h) => h !== handle);
      this.fireDone();
    });
    this.pending.push(handle);
  }

  /** Jumps to the finished picture and drops every beat still scheduled. Used
   *  when the stage stops being watched (the window closed) or the next round
   *  arrives, so a timeline can never paint over a later truth. */
  finishNow(): void {
    if (this.pending.length === 0) return;
    this.clear();
    this.host.open(SETTLED);
    // The round is over, just told all at once. Anything queued BEHIND it (a
    // match ending) is still owed its turn, or it would be lost every time a
    // client stalled.
    this.fireDone();
  }

  /** Drops the timeline without touching the stage (the window is closing).
   *
   *  Unlike finishNow(), this DISCARDS the completion callback: the window is
   *  going away, so a queued ending has nowhere to play. */
  stop(): void {
    this.clear();
    this.done = null;
    this.stage = null;
  }

  private fireDone(): void {
    const done = this.done;
    this.done = null;
    done?.();
  }

  private openCollapsed(beat: DuelBeat, cues: readonly DuelBeatCue[]): void {
    this.host.open(beat);
    for (const cue of cues) this.host.play(cue);
  }

  private schedule(beat: DuelBeat, isLast = false): void {
    const open = () => {
      this.host.open(beat);
      if (beat.cue) this.host.play(beat.cue);
      if (isLast) this.fireDone();
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
