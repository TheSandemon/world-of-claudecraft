// What a resolved Card Duel round does to the client: the audio cues plus the
// round theater, in one place.
//
// It lives here rather than in the hud.ts event switch because both halves are
// about the same moment and neither needs Hud's private state: the switch arm
// is a single call, and the coordinator does not grow another cluster of
// per-event logic (root CLAUDE.md, Modularity).
//
// The cues are HANDED to the stage rather than fired here, because they belong
// on the beats: the reveal sound lands when the cards turn, the push sound
// lands on the verdict, and the shuffle lands when the hand refills. Firing all
// three the instant the event arrives is what made a round sound like one
// undifferentiated noise. A closed window has no beats to ride, so this module
// keeps the old all-at-once behavior for exactly that case: a player who is not
// looking at the table still hears their round resolve.

import type { SimEvent } from '../../sim/types';

type CardRoundResolved = Extract<SimEvent, { type: 'cardRoundResolved' }>;

/** The audio surface this needs, narrowed to the three Card Duel round cues. */
export interface CardRoundAudio {
  cardReveal(): void;
  cardRoundPush(): void;
  cardShuffle(): void;
}

/** What the theater narrates for one resolved round. */
export interface CardRoundRevealInput {
  mine: number;
  theirs: number;
  mineBase?: number;
  theirsBase?: number;
  mineCardId?: string;
  theirsCardId?: string;
  outcome: 'win' | 'lose' | 'push';
  reshuffled: boolean;
}

/** The window surface this needs: just the reveal entry point. It returns
 *  whether it TOOK the round, which is also the answer to "did it take the
 *  cues", so a closed window never silently eats them. */
export interface CardRoundStage {
  showReveal(input: CardRoundRevealInput, audio: CardRoundAudio): boolean;
}

/**
 * Plays the round's cues and narrates it on the stage.
 *
 * Driven from the EVENT rather than the snapshot on purpose: the window skips
 * a rebuild on an unchanged repaint signature, so a snapshot-driven stage
 * would be stomped by the next render, and staging the snapshot itself would
 * delay information the player acts on. The snapshot keeps painting the truth
 * underneath while this tells the story over it.
 */
export function applyCardRoundFeedback(
  ev: CardRoundResolved,
  audio: CardRoundAudio,
  stage: CardRoundStage,
): void {
  const taken = stage.showReveal(
    {
      mine: ev.mine,
      theirs: ev.theirs,
      mineBase: ev.mineBase,
      theirsBase: ev.theirsBase,
      mineCardId: ev.mineCardId,
      theirsCardId: ev.theirsCardId,
      outcome: ev.outcome,
      reshuffled: ev.reshuffled,
    },
    audio,
  );
  if (taken) return;
  audio.cardReveal();
  if (ev.outcome === 'push') audio.cardRoundPush();
  if (ev.reshuffled) audio.cardShuffle();
}
