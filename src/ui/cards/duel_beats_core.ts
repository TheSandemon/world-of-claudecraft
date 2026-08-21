// The round theater, as data: one resolved Card Duel round turned into an
// ordered timeline of beats.
//
// Why this exists. A round used to arrive as a finished fact: both numbers,
// the outcome, and three audio cues, all in the same millisecond. Everything
// the round DID (a card flipped, an effect moved a value, one card beat the
// other) happened between two frames, so a player could read the result but
// never watch the cause. This core spreads that one fact across a short
// sequence a human can follow, and names which audio cue rides which beat, so
// the picture and the sound tell the same story at the same moment.
//
// It is a pure function of the round: same round in, same timeline out, on
// every host and at every graphics tier. The DOM half (duel_theater.ts) only
// schedules what this decides.
//
// THE FAIRNESS RULE THIS CORE MUST NOT BREAK: the timeline narrates state the
// snapshot has ALREADY painted underneath. No number a player acts on waits on
// a beat, so collapsing the whole timeline (reduced motion, the low graphics
// preset) is always legal and always shows exactly the same numbers.

/** The ordered phases of a resolved round. */
export type DuelBeatPhase = 'deal' | 'reveal' | 'shift' | 'clash' | 'verdict' | 'settle';

/** The audio cues the four shipped Card Duel sounds map onto. */
export type DuelBeatCue = 'reveal' | 'push' | 'shuffle';

export type DuelOutcome = 'win' | 'lose' | 'push';

/** One side of the stage: what the card was worth, and what it ended up worth. */
export interface DuelStageSide {
  /** The value the comparison used. */
  value: number;
  /** The printed value the card was dealt with. */
  base: number;
  /** value - base: what the round's effects did to this card, signed. */
  delta: number;
  /** The card that was played, when the round told us. Null keeps the stage
   *  working against an older event that carried numbers only. */
  cardId: string | null;
}

export interface DuelStageModel {
  mine: DuelStageSide;
  theirs: DuelStageSide;
  outcome: DuelOutcome;
  /** True when this side's refill had to shuffle the discard pile back in. */
  reshuffled: boolean;
  /** True when either card's value moved: the stage has a shift beat to play. */
  shifted: boolean;
}

export interface DuelRoundInput {
  mine: number;
  theirs: number;
  mineBase?: number;
  theirsBase?: number;
  mineCardId?: string;
  theirsCardId?: string;
  outcome: DuelOutcome;
  reshuffled: boolean;
}

export interface DuelBeat {
  phase: DuelBeatPhase;
  /** Milliseconds from the start of the timeline. */
  at: number;
  /** The cue that fires as this beat opens, if any. */
  cue: DuelBeatCue | null;
}

/**
 * How long each beat waits before the NEXT one opens, in milliseconds.
 *
 * Tuned for reading, not for spectacle: the whole timeline is about two
 * seconds against a 45 second round clock, and the clock is not even running
 * during it (the deadline refreshes when the round resolves). Named here so
 * one edit retunes the pacing everywhere it plays.
 */
export const DUEL_BEAT_GAP_MS: Readonly<Record<DuelBeatPhase, number>> = {
  // The cards land face-down on the stage: where they came from is legible
  // before anything is known about them.
  deal: 260,
  // Both faces turn at once. Simultaneous, because simultaneous hidden
  // selection is the game: neither side reveals first.
  reveal: 640,
  // The effects land: a delta chip flies onto the card it moved, and the value
  // ticks. The longest gap, because this is the beat that explains the round.
  shift: 400,
  // The two cards lean in and strike.
  clash: 260,
  // The winner surges, the loser recoils, the banner reads the result.
  verdict: 540,
  // The stage holds the finished picture until the next round replaces it.
  settle: 0,
};

/** Whether the timeline plays out or lands whole. */
export type DuelMotion = 'full' | 'none';

/** Builds the stage picture for one resolved round. */
export function buildDuelStage(input: DuelRoundInput): DuelStageModel {
  const mineBase = input.mineBase ?? input.mine;
  const theirsBase = input.theirsBase ?? input.theirs;
  const mine: DuelStageSide = {
    value: input.mine,
    base: mineBase,
    delta: input.mine - mineBase,
    cardId: input.mineCardId ?? null,
  };
  const theirs: DuelStageSide = {
    value: input.theirs,
    base: theirsBase,
    delta: input.theirs - theirsBase,
    cardId: input.theirsCardId ?? null,
  };
  return {
    mine,
    theirs,
    outcome: input.outcome,
    reshuffled: input.reshuffled,
    shifted: mine.delta !== 0 || theirs.delta !== 0,
  };
}

/** The cue that rides one beat, or null when that beat is silent. */
function cueFor(phase: DuelBeatPhase, stage: DuelStageModel): DuelBeatCue | null {
  if (phase === 'reveal') return 'reveal';
  if (phase === 'verdict' && stage.outcome === 'push') return 'push';
  if (phase === 'settle' && stage.reshuffled) return 'shuffle';
  return null;
}

/**
 * The timeline for one round.
 *
 * With `motion: 'none'` (reduced motion, or the lowest graphics preset) this
 * collapses to a SINGLE settle beat at zero: the finished picture, at once,
 * with every cue that would have played folded into it. That is the whole
 * reason the cues are named on the beats rather than fired by the caller.
 *
 * A round where no effect moved either value has no `shift` beat at all, and
 * everything after it pulls forward: a plain round should not sit through a
 * pause explaining a change that never happened.
 */
export function buildDuelBeats(stage: DuelStageModel, motion: DuelMotion = 'full'): DuelBeat[] {
  if (motion === 'none') {
    return [{ phase: 'settle', at: 0, cue: null }];
  }
  const phases: DuelBeatPhase[] = stage.shifted
    ? ['deal', 'reveal', 'shift', 'clash', 'verdict', 'settle']
    : ['deal', 'reveal', 'clash', 'verdict', 'settle'];
  const beats: DuelBeat[] = [];
  let at = 0;
  for (const phase of phases) {
    beats.push({ phase, at, cue: cueFor(phase, stage) });
    at += DUEL_BEAT_GAP_MS[phase];
  }
  return beats;
}

/** Every cue the timeline will fire, in order. A collapsed timeline still owes
 *  the player all of them, so the driver folds this into its one beat. */
export function duelCues(stage: DuelStageModel): DuelBeatCue[] {
  const cues: DuelBeatCue[] = ['reveal'];
  if (stage.outcome === 'push') cues.push('push');
  if (stage.reshuffled) cues.push('shuffle');
  return cues;
}

/** When the last beat opens. Zero for a collapsed timeline. */
export function duelBeatSpan(beats: readonly DuelBeat[]): number {
  return beats.length === 0 ? 0 : beats[beats.length - 1].at;
}
