// How long a resolved round takes to TELL: the one clock the sim and the
// client both read.
//
// Why it lives in the engine rather than in the client's theater. The round
// clock must not run while a round is resolving (a player should never lose
// think time to an animation), so the sim has to know how long the telling
// takes before it sets the next deadline. The client has to know the same
// number to pace its beats. Two copies would be a rule that could silently
// disagree with itself, and the disagreement would show up as either a stolen
// second of think time or a stage still mid-story when the next round opened.
//
// Content-shaped rather than fixed: a plain round is short, and a round with
// four effects in it takes four beats longer, because "how long is a round"
// is not a constant a player should have to wait out.
//
// Pure and dependency-free, like rules.ts beside it.

/** What the pacing needs to know about a resolved round. Structural, so a test
 *  can drive it with a plain object and the caller can pass a whole
 *  `CardRoundResolution`. */
export interface CardNarrationInput {
  /** The narratable steps (resolve.ts `log`). */
  log: readonly unknown[];
  /** Health the round took off, if any: a hit is its own beat. */
  damage: number;
}

/**
 * Seconds per beat, and which beats every round has.
 *
 * These are deliberately SHORT. The rule is one clear moment per thing that
 * happened, not a cinematic: a plain round runs a little over a second, and a
 * three-effect round about two and a half.
 */
export const CARD_NARRATION_BEATS = {
  /** The two cards land face-down on the table. */
  deal: 0.26,
  /** Both faces turn at once. Simultaneous, because simultaneous hidden
   *  selection is the game. */
  reveal: 0.5,
  /** One effect landing: a chip flies onto the card it moved and the value
   *  ticks. Paid once PER narrated step. */
  step: 0.45,
  /** The two cards strike. */
  clash: 0.3,
  /** The hit: the loser's health drops by the margin. Only on a round that
   *  dealt damage. */
  damage: 0.45,
  /** The winner surges and the banner reads the result. */
  verdict: 0.5,
} as const;

/**
 * The ceiling on one round's telling. A cap rather than a trusted sum: the
 * step count is already bounded (`MAX_NARRATED_STEPS`), and this is the second
 * bound, so no card chain can ever hold the table for an unreasonable stretch
 * of a 45 second round clock.
 */
export const CARD_NARRATION_MAX_S = 6;

/**
 * How long the telling of this round takes, in seconds.
 *
 * The sim adds it to the next round's deadline and holds play for exactly that
 * long; the client spends it walking the same beats. Both read this function,
 * so the pause and the story are the same length by construction.
 */
export function cardNarrationSeconds(round: CardNarrationInput): number {
  const b = CARD_NARRATION_BEATS;
  const total =
    b.deal +
    b.reveal +
    b.step * round.log.length +
    b.clash +
    (round.damage > 0 ? b.damage : 0) +
    b.verdict;
  return Math.min(CARD_NARRATION_MAX_S, Math.round(total * 1000) / 1000);
}
