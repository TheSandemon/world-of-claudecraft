// What a resolved Card Duel round does to the client: the audio cues plus the
// reveal stage, in one place.
//
// It lives here rather than in the hud.ts event switch because both halves are
// about the same moment and neither needs Hud's private state: the switch arm
// is a single call, and the coordinator does not grow another cluster of
// per-event logic (root CLAUDE.md, Modularity).

import type { SimEvent } from '../../sim/types';

type CardRoundResolved = Extract<SimEvent, { type: 'cardRoundResolved' }>;

/** The audio surface this needs, narrowed to the four Card Duel cues. */
export interface CardRoundAudio {
  cardReveal(): void;
  cardRoundPush(): void;
  cardShuffle(): void;
}

/** The window surface this needs: just the reveal entry point. */
export interface CardRoundStage {
  showReveal(input: {
    mine: number;
    theirs: number;
    mineBase?: number;
    theirsBase?: number;
    outcome: 'win' | 'lose' | 'push';
    reshuffled: boolean;
  }): void;
}

/**
 * Plays the round's cues and narrates it on the reveal stage.
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
  audio.cardReveal();
  if (ev.outcome === 'push') audio.cardRoundPush();
  if (ev.reshuffled) audio.cardShuffle();
  stage.showReveal({
    mine: ev.mine,
    theirs: ev.theirs,
    mineBase: ev.mineBase,
    theirsBase: ev.theirsBase,
    outcome: ev.outcome,
    reshuffled: ev.reshuffled,
  });
}
