// The browser half of the round theater: the real timer, the real element, and
// the one decision about whether the timeline plays at all.
//
// duel_beats_core.ts decides WHAT happens and when; duel_theater.ts walks it;
// this module is the only piece that knows there is a document. Keeping the
// split means a test drives a whole round on a fake clock, and means the
// standalone /cards slice and the in-game window share one answer to "how much
// of this round does this player want played" instead of each inventing their
// own.

import type { DuelBeatCue, DuelMotion } from './duel_beats_core';
import type { DuelTheaterHost } from './duel_theater';

/** The three Card Duel cues, narrowed to what a host needs to fire. */
export interface DuelCueAudio {
  cardReveal(): void;
  cardRoundPush(): void;
  cardShuffle(): void;
}

/**
 * How the round timeline is played here, from the two authorities that get a
 * say, in the order they win.
 *
 * REDUCED MOTION comes first (the in-game `body.reduce-motion` class or the OS
 * preference) and collapses the timeline to 'none': a player who asked for no
 * staged sequence gets the finished picture at once, cues and all.
 *
 * The LOWEST GRAPHICS PRESET (`data-fx-level="low"`) resolves to 'steps', not
 * 'none'. It used to collapse, and that was the bug this function is written
 * around: the stylesheet drops every animation at that preset, so collapsing
 * the beats as well meant the entire round (both cards, the effects, who won)
 * appeared in a single frame with nothing to watch and nothing to read. A
 * preset may shed motion; it may not shed the PACING that makes a round
 * legible. At 'steps' the same beats open at the same times and the stage cuts
 * between settled pictures.
 *
 * Either way the numbers are unaffected: the beats narrate what the snapshot
 * has already painted underneath.
 */
export function resolveDuelMotion(doc: Document = document): DuelMotion {
  if (doc.body?.classList.contains('reduce-motion')) return 'none';
  const view = doc.defaultView;
  if (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'none';
  if (doc.documentElement.dataset.fxLevel === 'low') return 'steps';
  return 'full';
}

/**
 * A host that writes each beat onto one element as `data-beat` and fires the
 * cue that rides it.
 *
 * ONE attribute write per beat, and nothing else: every visual the beats
 * produce is a CSS rule keyed on that attribute, so the timeline never reads
 * layout, never touches a second node, and costs the same on a phone as on a
 * desktop.
 */
export function browserTheaterHost(
  el: HTMLElement,
  audio: DuelCueAudio | null,
  timers: Pick<Window, 'setTimeout' | 'clearTimeout'> = window,
): DuelTheaterHost {
  return {
    setPhase(phase) {
      el.dataset.beat = phase;
    },
    play(cue: DuelBeatCue) {
      if (!audio) return;
      if (cue === 'reveal') audio.cardReveal();
      else if (cue === 'push') audio.cardRoundPush();
      else audio.cardShuffle();
    },
    schedule(ms, fn) {
      return timers.setTimeout(fn, ms) as unknown as number;
    },
    cancel(handle) {
      timers.clearTimeout(handle);
    },
  };
}
