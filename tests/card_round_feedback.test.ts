import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/types';
import {
  applyCardRoundFeedback,
  type CardRoundRevealInput,
} from '../src/ui/cards/card_round_feedback';

type CardRoundResolved = Extract<SimEvent, { type: 'cardRoundResolved' }>;

function resolved(over: Partial<CardRoundResolved> = {}): CardRoundResolved {
  return {
    type: 'cardRoundResolved',
    mine: 7,
    theirs: 4,
    mineBase: 5,
    theirsBase: 4,
    mineCardId: 'forest_wolf',
    theirsCardId: 'grave_rat',
    outcome: 'win',
    reshuffled: false,
    ...over,
  };
}

function rig(taken: boolean) {
  const cues: string[] = [];
  const seen: CardRoundRevealInput[] = [];
  const audio = {
    cardReveal: () => cues.push('reveal'),
    cardRoundPush: () => cues.push('push'),
    cardShuffle: () => cues.push('shuffle'),
  };
  const stage = {
    showReveal(input: CardRoundRevealInput) {
      seen.push(input);
      return taken;
    },
  };
  return { cues, seen, audio, stage };
}

describe('card round feedback', () => {
  it('hands the whole round to the stage, cards included', () => {
    const { seen, audio, stage } = rig(true);
    applyCardRoundFeedback(resolved(), audio, stage);
    expect(seen).toEqual([
      {
        mine: 7,
        theirs: 4,
        mineBase: 5,
        theirsBase: 4,
        mineCardId: 'forest_wolf',
        theirsCardId: 'grave_rat',
        outcome: 'win',
        reshuffled: false,
      },
    ]);
  });

  it('plays no cue itself when the stage took the round', () => {
    // The cues ride the beats there. Firing them here as well would double
    // every sound in the match.
    const { cues, audio, stage } = rig(true);
    applyCardRoundFeedback(resolved({ outcome: 'push', reshuffled: true }), audio, stage);
    expect(cues).toEqual([]);
  });

  it('plays every cue at once when the window is shut', () => {
    // A player can be mid-match with the window closed, and still deserves to
    // hear their round resolve.
    const { cues, audio, stage } = rig(false);
    applyCardRoundFeedback(resolved({ outcome: 'push', reshuffled: true }), audio, stage);
    expect(cues).toEqual(['reveal', 'push', 'shuffle']);
  });

  it('layers the closed-window cues rather than replacing the reveal', () => {
    const { cues, audio, stage } = rig(false);
    applyCardRoundFeedback(resolved({ outcome: 'win', reshuffled: false }), audio, stage);
    expect(cues).toEqual(['reveal']);
  });
});
