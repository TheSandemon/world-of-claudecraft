// What a resolved ClaudeStone round does to the client: the audio cues plus the
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
import { buildDuelStage, duelCues } from './duel_beats_core';
import { type DuelCueAudio, playDuelCues } from './duel_cue_audio';

type CardRoundResolved = Extract<SimEvent, { type: 'cardRoundResolved' }>;

/** The audio surface this needs: every ClaudeStone cue, because a round played
 *  with the window shut is owed exactly the round a played one is. */
export type CardRoundAudio = DuelCueAudio;

/** What the theater narrates for one resolved round: the whole round event,
 *  minus the wire bookkeeping. */
export interface CardRoundRevealInput {
  mine: number;
  theirs: number;
  mineBase?: number;
  theirsBase?: number;
  mineCardId?: string;
  theirsCardId?: string;
  outcome: 'win' | 'lose' | 'push';
  reshuffled: boolean;
  /** What the round DID, one beat each (src/sim/.../resolve.ts CardRoundStep,
   *  already viewer-relative). */
  steps?: readonly {
    side: 'mine' | 'theirs';
    cardId: string;
    effect: string;
    target?: 'mine' | 'theirs';
    amount?: number;
    valueAfter?: number;
  }[];
  damage?: number;
  damageTo?: 'mine' | 'theirs';
  myHp?: number;
  theirHp?: number;
  maxHp?: number;
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
      steps: ev.steps,
      damage: ev.damage,
      damageTo: ev.damageTo,
      myHp: ev.myHp,
      theirHp: ev.theirHp,
      maxHp: ev.maxHp,
    },
    audio,
  );
  if (taken) return;
  // No stage to ride, so the cues are fired here instead. They are the SAME
  // cues, read off the same timeline the stage would have played
  // (`duelCues` -> `buildDuelBeats`), rather than a second hand-written list of
  // the same decisions: a round told with the window shut is owed exactly the
  // round a watched one is, and the way that promise breaks is a cue added to
  // one arm and forgotten in the other, silently, for the players who by
  // definition cannot see that anything is missing.
  playDuelCues(
    audio,
    duelCues(
      buildDuelStage({
        mine: ev.mine,
        theirs: ev.theirs,
        outcome: ev.outcome,
        reshuffled: ev.reshuffled,
        steps: ev.steps,
        damage: ev.damage,
        damageTo: ev.damageTo,
      }),
    ),
  );
}
