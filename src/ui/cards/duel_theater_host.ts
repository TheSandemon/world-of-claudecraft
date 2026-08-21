// The browser half of the round theater: the real timer, the real element, and
// the one decision about whether the timeline plays at all.
//
// duel_beats_core.ts decides WHAT happens and when; duel_theater.ts walks it;
// this module is the only piece that knows there is a document. Keeping the
// split means a test drives a whole round on a fake clock, and means the
// standalone /cards slice and the in-game window share one answer to "does
// this player want motion" instead of each inventing their own.

import type { DuelBeatCue, DuelMotion } from './duel_beats_core';
import type { DuelTheaterHost } from './duel_theater';

/** The three Card Duel cues, narrowed to what a host needs to fire. */
export interface DuelCueAudio {
  cardReveal(): void;
  cardRoundPush(): void;
  cardShuffle(): void;
}

/**
 * Whether the round timeline plays out or lands whole.
 *
 * Three independent authorities can each collapse it, and any one of them is
 * enough: the in-game reduced-motion setting (`body.reduce-motion`), the OS
 * preference, and the lowest graphics preset (`data-fx-level="low"`). This
 * mirrors exactly what the stylesheet already does to the card face, so the
 * JavaScript pacing and the CSS motion can never disagree and leave a player
 * watching a two second silence with nothing moving in it.
 *
 * Collapsing is always safe: the beats narrate numbers the snapshot has
 * already painted, so 'none' shows the same result at the same instant.
 */
export function resolveDuelMotion(doc: Document = document): DuelMotion {
  if (doc.documentElement.dataset.fxLevel === 'low') return 'none';
  if (doc.body?.classList.contains('reduce-motion')) return 'none';
  const view = doc.defaultView;
  if (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'none';
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
