import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/types';
import {
  applyCardRoundFeedback,
  type CardRoundRevealInput,
} from '../src/ui/cards/card_round_feedback';
import { buildDuelStage, duelCues } from '../src/ui/cards/duel_beats_core';
import { recordingCueAudio } from './helpers/card_duel_fixtures';

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
  const { cues, audio } = recordingCueAudio();
  const seen: CardRoundRevealInput[] = [];
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
    // hear their round resolve, in full: every beat the played round would
    // have narrated, not the three the old hand-written list happened to name.
    const { cues, audio, stage } = rig(false);
    applyCardRoundFeedback(resolved({ outcome: 'push', reshuffled: true }), audio, stage);
    expect(cues).toEqual(['deal', 'reveal', 'clash', 'push', 'shuffle']);
  });

  it('tells the shut-window round exactly as the stage would have told it', () => {
    // The teeth: the closed arm reads its cues off the SAME timeline the
    // theater plays (duelCues -> buildDuelBeats), so a cue can never exist in
    // one arm and not the other. That failure mode is invisible by
    // construction, because it only ever reaches players who are not looking
    // at the window.
    for (const ev of [
      resolved({ outcome: 'win', reshuffled: false }),
      resolved({ outcome: 'lose', reshuffled: true }),
      resolved({ outcome: 'push', damage: 3, damageTo: 'mine' }),
    ]) {
      const shut = rig(false);
      applyCardRoundFeedback(ev, shut.audio, shut.stage);
      expect(shut.cues).toEqual(
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
  });

  it('gives a decided round its own verdict cue and a quiet settle', () => {
    // A won round used to fire ONE sound in total. Four of its five beats were
    // silent, so the audio said "a round happened" and nothing about which way
    // it went.
    const { cues, audio, stage } = rig(false);
    applyCardRoundFeedback(resolved({ outcome: 'win', reshuffled: false }), audio, stage);
    expect(cues).toEqual(['deal', 'reveal', 'clash', 'roundWin', 'settle']);
  });
});
