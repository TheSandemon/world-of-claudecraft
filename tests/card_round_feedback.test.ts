import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/types';
import {
  applyCardMatchEndFeedback,
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

type CardDuelMatchEnd = Extract<SimEvent, { type: 'cardDuelMatchEnd' }>;

function matchEnd(over: Partial<CardDuelMatchEnd> = {}): CardDuelMatchEnd {
  return {
    type: 'cardDuelMatchEnd',
    won: true,
    draw: false,
    summary: {
      rounds: 3,
      myHp: 12,
      theirHp: 0,
      maxHp: 30,
      damageDealt: 30,
      damageTaken: 18,
    },
    ...over,
  };
}

function rig(taken: boolean) {
  const { cues, audio } = recordingCueAudio();
  const seen: CardRoundRevealInput[] = [];
  const ended: unknown[] = [];
  const stage = {
    showReveal(input: CardRoundRevealInput) {
      seen.push(input);
      return taken;
    },
    // `taken` doubles as "the window is open", which is the one thing both
    // entry points branch on.
    showMatchEnd(input: unknown) {
      ended.push(input);
      return taken;
    },
  };
  return { cues, seen, ended, audio, stage };
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

  it('lets the ENDING carry the match verdict when it will be narrated', () => {
    // The defect this closes: the sim emits cardDuelMatchEnd in the SAME tick
    // as the final cardRoundResolved, so firing the verdict on the event meant
    // a player heard the match end while the round that decided it was still
    // being told. It rides the outro's own `glory` beat now, so firing it here
    // as well would double it.
    const { cues, ended, audio, stage } = rig(true);
    applyCardMatchEndFeedback(matchEnd({ won: true }), audio, stage);
    expect(ended).toHaveLength(1);
    expect(cues).toEqual([]);
  });

  it('plays the verdict itself when nothing will narrate the ending', () => {
    // A shut window or a stalled theater. Owed the sound for exactly the
    // reason a shut window is owed the round's own cues one function up.
    const won = rig(false);
    applyCardMatchEndFeedback(matchEnd({ won: true }), won.audio, won.stage);
    expect(won.cues).toEqual(['matchWin']);

    const lost = rig(false);
    applyCardMatchEndFeedback(matchEnd({ won: false }), lost.audio, lost.stage);
    expect(lost.cues).toEqual(['matchLose']);
  });

  it('still sounds a VOID match, which has no summary to narrate', () => {
    // No payload means nothing to show, so `showMatchEnd` is never reached and
    // the ending cannot carry the cue. Silence here would drop the sound for a
    // whole class of match end.
    const { cues, ended, audio, stage } = rig(true);
    applyCardMatchEndFeedback({ ...matchEnd({ won: false }), summary: undefined }, audio, stage);
    expect(ended).toEqual([]);
    expect(cues).toEqual(['matchLose']);
  });
});
