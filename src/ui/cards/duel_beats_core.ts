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
// The BEAT LENGTHS are not this module's to invent: they come from the engine
// (minigames/card_duel/narration.ts), because the sim stops the round clock for
// exactly as long as the telling takes. One set of numbers, two consumers.
//
// THE FAIRNESS RULE THIS CORE MUST NOT BREAK: the timeline narrates state the
// snapshot has ALREADY painted underneath. No number a player acts on waits on
// a beat, so collapsing the whole timeline (reduced motion) is always legal and
// always shows exactly the same numbers. The lowest graphics preset keeps the
// beats and sheds only the motion (see DuelMotion): pacing is how a round is
// read, and a preset may shed richness, never legibility.

import {
  CARD_NARRATION_BEATS,
  CARD_NARRATION_MAX_S,
} from '../../sim/minigames/card_duel/narration';

/**
 * The ordered phases of a resolved round.
 *
 * `step` is the one that repeats: a round plays one step beat per effect that
 * actually did something, which is why a timeline is as long as the round
 * earned rather than a fixed length.
 */
export type DuelBeatPhase =
  | 'deal'
  | 'reveal'
  | 'step'
  | 'clash'
  | 'damage'
  | 'verdict'
  | 'settle'
  // The MATCH ending, after the last round has finished being told. Built by
  // duel_outro_core.ts, played by the same driver onto the same attribute, so
  // there is one beat vocabulary rather than two.
  | 'finish'
  | 'glory'
  | 'curtain';

/** The audio cues the Card Duel sounds map onto. */
export type DuelBeatCue = 'reveal' | 'effect' | 'hit' | 'push' | 'shuffle';

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

/**
 * One thing an effect did, as the stage narrates it: the engine's step log
 * (`CardRoundStep`) already rewritten to this viewer's point of view by the
 * event.
 */
export interface DuelStageStep {
  /** Whose card did it. */
  side: 'mine' | 'theirs';
  cardId: string;
  /** The engine's effect primitive name. */
  effect: string;
  /** Whose value moved, when one did. */
  target: 'mine' | 'theirs' | null;
  amount: number | null;
  valueAfter: number | null;
}

export interface DuelStageModel {
  mine: DuelStageSide;
  theirs: DuelStageSide;
  outcome: DuelOutcome;
  /** True when this side's refill had to shuffle the discard pile back in. */
  reshuffled: boolean;
  /** True when either card's value moved. */
  shifted: boolean;
  /** What the round DID, in order: one beat each. */
  steps: DuelStageStep[];
  /** Health the round took off, and from whom. */
  damage: number;
  damageTo: 'mine' | 'theirs' | null;
  /** Health after the round, for the bar the damage beat drains. */
  myHp: number | null;
  theirHp: number | null;
  maxHp: number | null;
}

/**
 * A step as the WIRE carries it: the same thing as a DuelStageStep with the
 * "nothing here" fields simply absent rather than null, which is how the event
 * union spells an optional field. Normalized on the way in
 * (`buildDuelStage`), so nothing downstream has to check two spellings of
 * empty.
 */
export interface DuelRoundStepInput {
  side: 'mine' | 'theirs';
  cardId: string;
  effect: string;
  target?: 'mine' | 'theirs';
  amount?: number;
  valueAfter?: number;
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
  steps?: readonly DuelRoundStepInput[];
  damage?: number;
  damageTo?: 'mine' | 'theirs';
  myHp?: number;
  theirHp?: number;
  maxHp?: number;
}

/**
 * What a beat is POINTING AT: the one thing on the table this moment is about.
 *
 * The beats were legible as a sequence and illegible as a story: a value
 * ticked, a bar dropped, and a player watching the middle of the table had no
 * way to know which of the two cards a `+2` had just landed on. Naming the
 * subject here (rather than leaving the stylesheet to guess from the phase)
 * lets one gold outline say "this one" on exactly the card or bar that moved.
 *
 * `mine`/`theirs` are the two stage cards; the `-hp` pair are the seat health
 * bars, which live OUTSIDE the stage element, which is why the attribute this
 * resolves into is written on the table container (see duel_theater_host.ts).
 */
export type DuelSpotlight = 'mine' | 'theirs' | 'both' | 'mine-hp' | 'theirs-hp' | null;

export interface DuelBeat {
  phase: DuelBeatPhase;
  /** Milliseconds from the start of the timeline. */
  at: number;
  /** The cue that fires as this beat opens, if any. */
  cue: DuelBeatCue | null;
  /** The effect this beat narrates, on a `step` beat only. */
  step: DuelStageStep | null;
  /** What this beat is pointing at, for the gold outline. Null on a beat that
   *  is about the table as a whole. */
  spotlight: DuelSpotlight;
}

/**
 * How long each beat waits before the NEXT one opens, in milliseconds.
 *
 * NOT a second set of numbers: these are the engine's own narration beats
 * (`CARD_NARRATION_BEATS`, seconds) in the unit the DOM uses. The sim pauses
 * the round clock for exactly the sum of them, so a second copy here would be
 * a story that finishes after the clock restarts, or a clock held for a story
 * that already ended.
 *
 * The pacing rule they encode: one clear moment per thing that happened, each
 * long enough to WATCH. A plain round runs about four seconds; a three-effect
 * round under seven, because it had three times as much to say.
 */
export const DUEL_BEAT_GAP_MS: Readonly<Record<DuelBeatPhase, number>> = {
  // The cards land face-down on the stage: where they came from is legible
  // before anything is known about them.
  deal: CARD_NARRATION_BEATS.deal * 1000,
  // Both faces turn at once. Simultaneous, because simultaneous hidden
  // selection is the game: neither side reveals first.
  reveal: CARD_NARRATION_BEATS.reveal * 1000,
  // ONE effect landing: a chip flies onto the card it moved and the value
  // ticks. Paid once per narrated step, which is what makes a busy round take
  // longer than a plain one.
  step: CARD_NARRATION_BEATS.step * 1000,
  // The two cards lean in and strike.
  clash: CARD_NARRATION_BEATS.clash * 1000,
  // The hit lands: the loser's health drops by the margin.
  damage: CARD_NARRATION_BEATS.damage * 1000,
  // The winner surges, the loser recoils, the banner reads the result.
  verdict: CARD_NARRATION_BEATS.verdict * 1000,
  // The stage holds the finished picture until the next round replaces it.
  settle: 0,
  // The outro beats own their own gaps (DUEL_OUTRO_GAP_MS): they are not part
  // of the sim's held-clock budget, and a round timeline never contains one.
  finish: 0,
  glory: 0,
  curtain: 0,
};

/**
 * How a timeline is played.
 *
 * THE RULE ABOVE BOTH OF THEM: a round is never told all at once, at any
 * performance level. The beats are how a round is READ; a table that drops the
 * whole result into one frame cannot be followed by anyone, and the machine
 * with the least frame budget is exactly the one whose player has the least
 * attention to spare for catching up. So every level below gets every beat, at
 * the same times, and they differ only in how much the picture MOVES.
 *
 * - `full`: every beat with the motion that goes with it (cards land and lunge,
 *   chips fly, the value ticks, the ring flashes).
 * - `calm`: every beat, same times, with the movement dropped and only the
 *   cheap channel kept: opacity fades and the gold ring. Nothing translates,
 *   scales or lunges, so a beat costs a composited opacity and nothing else.
 *   This is what the LOWEST GRAPHICS PRESET gets, and what REDUCED MOTION gets:
 *   the two ask for different things (one is a frame budget, the other is a
 *   comfort request) and both are answered by removing MOVEMENT rather than
 *   information. A fade and an outline are not the motion a reduced-motion
 *   player is protecting themselves from; a round they cannot follow is a real
 *   loss.
 * - `none`: one settled beat at zero. Nothing SELECTS this any more; it stays
 *   for the driver's own catch-up path (`finishNow`, a stage nobody is
 *   watching), where the finished picture is the only correct answer.
 */
export type DuelMotion = 'full' | 'calm' | 'none';

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
    steps: (input.steps ?? []).map((step) => ({
      side: step.side,
      cardId: step.cardId,
      effect: step.effect,
      target: step.target ?? null,
      amount: step.amount ?? null,
      valueAfter: step.valueAfter ?? null,
    })),
    damage: input.damage ?? 0,
    damageTo: input.damageTo ?? null,
    myHp: input.myHp ?? null,
    theirHp: input.theirHp ?? null,
    maxHp: input.maxHp ?? null,
  };
}

/** The cue that rides one beat, or null when that beat is silent. */
function cueFor(phase: DuelBeatPhase, stage: DuelStageModel): DuelBeatCue | null {
  if (phase === 'reveal') return 'reveal';
  // Every effect gets its own sound as well as its own moment: a round where
  // three things happened should not sound like a round where one did.
  if (phase === 'step') return 'effect';
  if (phase === 'damage') return 'hit';
  if (phase === 'verdict' && stage.outcome === 'push') return 'push';
  if (phase === 'settle' && stage.reshuffled) return 'shuffle';
  return null;
}

/**
 * What one beat points at.
 *
 * A `step` follows the VALUE, not the author: their card silencing yours is a
 * moment about YOUR card, because yours is the number that moved. Only when a
 * step moved no value at all (a draw, a reveal) does it fall back to the card
 * that did it, which is then the only thing on the table it could mean.
 */
function spotlightFor(
  phase: DuelBeatPhase,
  stage: DuelStageModel,
  step: DuelStageStep | null,
): DuelSpotlight {
  if (phase === 'reveal' || phase === 'clash') return 'both';
  if (phase === 'step') return step ? (step.target ?? step.side) : null;
  if (phase === 'damage') return stage.damageTo === 'mine' ? 'mine-hp' : 'theirs-hp';
  if (phase === 'verdict') {
    if (stage.outcome === 'win') return 'mine';
    if (stage.outcome === 'lose') return 'theirs';
    return 'both';
  }
  // deal (nothing is known yet) and settle (the round is over, and the picture
  // it leaves is the whole table) point at nothing.
  return null;
}

/** Whether this round has a damage beat: a hit is only worth a moment when one
 *  actually landed. */
function hasDamageBeat(stage: DuelStageModel): boolean {
  return stage.damage > 0 && stage.damageTo !== null;
}

/**
 * The timeline for one round.
 *
 * `motion: 'calm'` returns exactly the timeline `full` does. The two differ in
 * the DOM, not here: at `calm` the stylesheet keeps the fades and the ring and
 * drops everything that moves, so the same beats land at the same moments with
 * a quieter picture. The beat NAMES are what each surface keys on, so a phase
 * always means the same thing whatever the preset.
 *
 * With `motion: 'none'` this collapses to a SINGLE settle beat at zero: the
 * finished picture, at once, with every cue that would have played folded into
 * it. That is the whole reason the cues are named on the beats rather than
 * fired by the caller. Nothing a player can configure selects it: it is the
 * driver's catch-up answer for a stage nobody is watching.
 *
 * The timeline is CONTENT-SHAPED. A plain round has no step beats at all and a
 * round that dealt no damage has no damage beat, so nothing ever sits through
 * a pause explaining something that did not happen; a round where four effects
 * fired is four beats longer, because it has four things to say.
 */
export function buildDuelBeats(stage: DuelStageModel, motion: DuelMotion = 'full'): DuelBeat[] {
  if (motion === 'none') {
    return [{ phase: 'settle', at: 0, cue: null, step: null, spotlight: null }];
  }
  const beats: DuelBeat[] = [];
  let at = 0;
  const push = (phase: DuelBeatPhase, step: DuelStageStep | null = null) => {
    beats.push({
      phase,
      at,
      cue: cueFor(phase, stage),
      step,
      spotlight: spotlightFor(phase, stage, step),
    });
    at += DUEL_BEAT_GAP_MS[phase];
  };
  push('deal');
  push('reveal');
  for (const step of stage.steps) push('step', step);
  push('clash');
  if (hasDamageBeat(stage)) push('damage');
  push('verdict');
  push('settle');
  // The engine caps how long the sim will hold the round clock
  // (CARD_NARRATION_MAX_S), so a story longer than that would still be running
  // when the next round's think time started. A pathological round is told
  // FASTER rather than truncated: every effect still gets its own moment, the
  // moments are just shorter.
  const cap = CARD_NARRATION_MAX_S * 1000;
  const span = at;
  if (span > cap) {
    const squeeze = cap / span;
    for (const beat of beats) beat.at = Math.round(beat.at * squeeze);
  }
  return beats;
}

/** Every cue the timeline will fire, in order. A collapsed timeline still owes
 *  the player all of them, so the driver folds this into its one beat. */
export function duelCues(stage: DuelStageModel): DuelBeatCue[] {
  const cues: DuelBeatCue[] = ['reveal'];
  // One per effect, exactly as the played timeline would fire them, then the
  // hit: a collapsed round still SOUNDS like the round it was.
  for (const _step of stage.steps) cues.push('effect');
  if (hasDamageBeat(stage)) cues.push('hit');
  if (stage.outcome === 'push') cues.push('push');
  if (stage.reshuffled) cues.push('shuffle');
  return cues;
}

/** When the last beat opens. Zero for a collapsed timeline. */
export function duelBeatSpan(beats: readonly DuelBeat[]): number {
  return beats.length === 0 ? 0 : beats[beats.length - 1].at;
}
