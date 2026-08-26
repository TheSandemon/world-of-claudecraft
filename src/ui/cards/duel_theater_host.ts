// The browser half of the round theater: the real timer, the real element, and
// the one decision about whether the timeline plays at all.
//
// duel_beats_core.ts decides WHAT happens and when; duel_theater.ts walks it;
// this module is the only piece that knows there is a document. Keeping the
// split means a test drives a whole round on a fake clock, and means the
// standalone /cards slice and the in-game window share one answer to "how much
// of this round does this player want played" instead of each inventing their
// own.

import type { DuelBeat, DuelBeatCue, DuelMotion } from './duel_beats_core';
import type { DuelTheaterHost } from './duel_theater';

/** The Card Duel cues, narrowed to what a host needs to fire. */
export interface DuelCueAudio {
  cardReveal(): void;
  cardRoundPush(): void;
  cardShuffle(): void;
  /** One effect landing. Fired once per narrated effect, so a round where three
   *  things happened does not sound like a round where one did. */
  cardEffect(): void;
  /** The hit: health coming off. */
  cardHit(): void;
}

/**
 * How the round timeline is played here.
 *
 * NOTHING HERE RETURNS 'none', and that is the point. Both authorities that get
 * a say (reduced motion, in-game or OS; and the lowest graphics preset) resolve
 * to 'calm': every beat, at the same times, with the movement dropped and the
 * fades plus the gold ring kept.
 *
 * It used to collapse the whole round for reduced motion, and that was the bug
 * this function is written around. A collapsed round is not a calmer round, it
 * is an UNREADABLE one: both cards, every effect, the hit and the winner all
 * arrive in the same frame, and the player is left with a result and no idea
 * what produced it. That is worse for the player on the cheap machine and
 * worse for the player who asked for less motion, because neither of them
 * asked to stop being told what happened. What reduced motion is owed is the
 * absence of MOVEMENT (things flying, lunging, scaling), and `calm` gives them
 * exactly that.
 *
 * The numbers are unaffected either way: the beats narrate what the snapshot
 * has already painted underneath.
 */
export function resolveDuelMotion(doc: Document = document): DuelMotion {
  if (doc.body?.classList.contains('reduce-motion')) return 'calm';
  const view = doc.defaultView;
  if (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'calm';
  if (doc.documentElement.dataset.fxLevel === 'low') return 'calm';
  return 'full';
}

export interface BrowserTheaterHostOptions {
  /** Turns a beat into the line the stage shows while it plays. Injected
   *  because it needs i18n and the catalog, neither of which belongs in a
   *  module whose whole job is the timer and the element. */
  caption?: (beat: DuelBeat) => string;
  /**
   * The element the SPOTLIGHT is written on, as `data-spot`.
   *
   * A second element rather than the stage, for one reason: the damage beat
   * points at a seat's HEALTH BAR, and the bars sit in the seat bands OUTSIDE
   * the stage. Passing the table container (their common ancestor, which
   * survives every region repaint) lets one attribute reach both the stage
   * cards and the bars. Omit it and the timeline simply runs with no
   * spotlight, which is what a surface with no table container gets.
   */
  spotlight?: HTMLElement | null;
  /**
   * How much this round will move, stamped on the spotlight element as
   * `data-motion` so the stylesheet has ONE hook for it.
   *
   * The two authorities that resolve to `calm` (reduced motion and the lowest
   * preset) are a media query and a root attribute; keying the calm rules on
   * either would mean writing every one of them twice and would silently miss
   * the case where only the other applies. The theater already resolved the
   * question once, so it publishes the ANSWER and the sheet keys on that.
   */
  motion?: DuelMotion;
  /** Called as each beat opens, after the writes. The seam the card FLIGHTS
   *  hang off (a card leaving the stage for the discard pile on `settle`),
   *  because those need rectangles, which is emphatically not this module's
   *  job. */
  onBeat?: (beat: DuelBeat) => void;
}

/**
 * A host that writes each beat onto the stage as `data-beat`, the thing it
 * points at as `data-spot`, and fires the cue that rides it.
 *
 * At most three attribute/text writes per beat, each elided against what is
 * already there: every visual the beats produce is a CSS rule keyed on those
 * attributes, so the timeline never reads layout and costs the same on a phone
 * as on a desktop.
 */
export function browserTheaterHost(
  el: HTMLElement,
  audio: DuelCueAudio | null,
  timers: Pick<Window, 'setTimeout' | 'clearTimeout'> = window,
  opts: BrowserTheaterHostOptions = {},
): DuelTheaterHost {
  const { caption, spotlight, onBeat, motion } = opts;
  const captionEl = el.querySelector('[data-cd-beatline]') as HTMLElement | null;
  // Written once per round rather than per beat: how much this round moves
  // cannot change while it plays.
  if (spotlight && motion) spotlight.dataset.motion = motion;
  return {
    open(beat) {
      el.dataset.beat = beat.phase;
      if (spotlight) {
        // A beat that points at nothing CLEARS the attribute rather than
        // leaving the last one lit: a stale gold outline says "this one" about
        // a moment that has passed.
        const spot = beat.spotlight ?? '';
        if (spotlight.dataset.spot !== spot) spotlight.dataset.spot = spot;
      }
      if (captionEl && caption) {
        const text = caption(beat);
        if (captionEl.textContent !== text) captionEl.textContent = text;
      }
      onBeat?.(beat);
    },
    play(cue: DuelBeatCue) {
      if (!audio) return;
      if (cue === 'reveal') audio.cardReveal();
      else if (cue === 'effect') audio.cardEffect();
      else if (cue === 'hit') audio.cardHit();
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
