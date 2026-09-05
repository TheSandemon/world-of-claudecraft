// The ClaudeStone audio surface, and which method each beat cue fires.
//
// Its own module because it has exactly TWO callers that must never disagree:
// the theater host (which fires one cue as each beat opens) and
// card_round_feedback.ts (which fires the whole round's worth at once when the
// window is shut). Those are the same round told two ways, and the moment they
// each own a copy of this mapping is the moment a cue can exist in one and not
// the other, silently, for exactly the players who are not looking at the
// window and so cannot notice.
//
// DOM-free and audio-object-free on purpose: it names methods, it does not
// know what plays them, so a test drives it with a counter.

import type { DuelBeatCue } from './duel_beats_core';

/**
 * Every ClaudeStone cue, one method each.
 *
 * The union it is keyed on is `DuelBeatCue`, so a cue added to the vocabulary
 * without a method here is a compile error rather than a silent fallback. That
 * matters because the arrangement it replaced ended in a bare `else
 * cardShuffle()`: a forgotten cue did not fail, it played the reshuffle sound.
 */
export interface DuelCueAudio {
  /** The two cards land face-down: the round has begun, nothing is known yet. */
  cardDeal(): void;
  /** Both faces turn at once. */
  cardReveal(): void;
  /** One effect landing. Fired once per narrated effect, so a round where three
   *  things happened does not sound like a round where one did. */
  cardEffect(): void;
  /** The two cards lean in and strike. */
  cardClash(): void;
  /** The hit: health coming off. */
  cardHit(): void;
  /** The verdict, one cue per way a round can go. Two cues rather than one
   *  because who took the round is the news, not that a round ended. */
  cardRoundWin(): void;
  cardRoundLose(): void;
  cardRoundPush(): void;
  /** The picture settles with the deck unchanged. Its louder sibling is
   *  `cardShuffle`, which rides the same beat when the deck came back around. */
  cardSettle(): void;
  cardShuffle(): void;
  /** The ending (duel_outro_core.ts): a health bar empties, the match is
   *  called, the table clears. `cardMatchWin` / `cardMatchLose` are the
   *  existing duel recordings, moved onto the beat that means them. */
  cardFinish(): void;
  cardMatchWin(): void;
  cardMatchLose(): void;
  cardCurtain(): void;
}

/** Which method each cue fires. Exhaustive over `DuelBeatCue` by its type. */
export const DUEL_CUE_METHOD: Readonly<Record<DuelBeatCue, keyof DuelCueAudio>> = {
  deal: 'cardDeal',
  reveal: 'cardReveal',
  effect: 'cardEffect',
  clash: 'cardClash',
  hit: 'cardHit',
  roundWin: 'cardRoundWin',
  roundLose: 'cardRoundLose',
  push: 'cardRoundPush',
  settle: 'cardSettle',
  shuffle: 'cardShuffle',
  finish: 'cardFinish',
  matchWin: 'cardMatchWin',
  matchLose: 'cardMatchLose',
  curtain: 'cardCurtain',
};

/** Fires one cue against an audio surface. */
export function playDuelCue(audio: DuelCueAudio, cue: DuelBeatCue): void {
  audio[DUEL_CUE_METHOD[cue]]();
}

/** Fires a whole run of cues in order: the closed-window arm, where a round
 *  the player is not watching still sounds like the round it was. */
export function playDuelCues(audio: DuelCueAudio, cues: readonly DuelBeatCue[]): void {
  for (const cue of cues) playDuelCue(audio, cue);
}
