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
 * The rule is one clear moment per thing that happened, and the measure of
 * "one moment" is a HUMAN one: long enough to look at the thing that changed,
 * read it, and still be looking when the next beat opens. A plain round runs
 * about eight seconds and a three-effect round about thirteen.
 *
 * These have been doubled twice from the original set, both times for the same
 * playtest note: the beats were landing faster than an eye could follow them,
 * so a round read as a blur of things that had already happened rather than a
 * sequence of things happening. Slower is the point, not a side effect.
 */
export const CARD_NARRATION_BEATS = {
  /** The two cards land face-down on the table. */
  deal: 1.04,
  /** Both faces turn at once. Simultaneous, because simultaneous hidden
   *  selection is the game. */
  reveal: 2,
  /** One effect landing: a chip flies onto the card it moved and the value
   *  ticks. Paid once PER narrated step. */
  step: 1.8,
  /** The two cards strike. */
  clash: 1.2,
  /** The hit: the loser's health drops by the margin. Only on a round that
   *  dealt damage. */
  damage: 1.8,
  /** The winner surges and the banner reads the result. */
  verdict: 2,
} as const;

/**
 * The ceiling on one round's telling. A cap rather than a trusted sum: the
 * step count is already bounded (`MAX_NARRATED_STEPS`), and this is the second
 * bound, so no card chain can hold the table open indefinitely.
 *
 * It is deliberately NOT tied to a share of the round clock. The clock does not
 * run while a round is being told (`resolvingUntil` holds it and play is closed
 * for exactly that window), so a longer telling costs a player no think time:
 * it only delays the next round.
 *
 * It moves WITH the beats, and has to. The cap's only job is to stop a
 * pathological card chain running forever; a cap that sat below an ordinary
 * round would instead squeeze every ordinary round faster, which is the exact
 * opposite of what the beat lengths above are for. At the current lengths a
 * round with up to eight narrated effects is told in full, and only a chain
 * past that is told faster.
 */
export const CARD_NARRATION_MAX_S = 24;

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
