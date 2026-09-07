// What the two health bars SHOW while a round is being told.
//
// The snapshot paints the truth, and for every other region on the table that
// is the whole rule: the hand, the pips, the counters and the clock are all
// correct the instant the snapshot arrives. Health is the one exception, and it
// is an exception about PACING rather than about truth.
//
// A round resolves in the tick both cards land, so the seat bands dropped by
// the round's margin at the moment the cards were played, roughly six seconds
// before the `damage` beat that exists to show it happening. The hit was over
// before the story reached it: the beat lit a bar that had already moved, the
// spotlight pointed at a number nobody had seen change, and a player who lost
// the match watched their health reach zero while the cards were still turning.
//
// So the bars are HELD at what they read before the round, and released on the
// damage beat. Three things make that legal rather than a delay of information:
//
//  - Play is CLOSED for exactly this window. The sim holds the round clock for
//    `cardNarrationSeconds` and refuses a card played inside it, so there is no
//    decision the held number could affect; the bars are released before the
//    hand comes back.
//  - It is the same at every graphics preset, on every device, and under
//    reduced motion. `calm` keeps every beat at its own moment, so the damage
//    beat arrives at the same instant either way.
//  - It is bounded by the round. Anything that ends the telling early (a closed
//    window, a stalled client, a jumped-to timeline) drops the hold and the
//    snapshot's own numbers are on the bars again.
//
// Pure and host-free: the window owns WHEN, this owns WHAT.

/** The health both bars read BEFORE the round that is being told, viewer
 *  relative. */
export interface DuelHealthHold {
  myHp: number;
  opponentHp: number;
}

/** What a resolved round says about the hit it landed. The `CardRoundResolved`
 *  fields this needs, structural so a test can pass a plain object. */
export interface DuelHealthHoldInput {
  damage?: number;
  damageTo?: 'mine' | 'theirs';
  /** Health AFTER the round, as the event reports it. */
  myHp?: number;
  theirHp?: number;
}

/**
 * The health to hold the bars at while this round is told, or null when there
 * is nothing to hold.
 *
 * Reconstructed by adding the damage back onto the side that took it, rather
 * than remembered from the last paint: the last paint is not a reliable record
 * (a window opened mid-match, or reopened, has never painted the previous
 * round), and the event already carries both halves of the subtraction.
 *
 * Null on a round that took no health (a push, or a margin of zero), on one
 * that names no side, and on one whose event carries no health at all: a hold
 * with nothing to reveal would only freeze a bar that was never going to move.
 */
export function buildDuelHealthHold(input: DuelHealthHoldInput): DuelHealthHold | null {
  const damage = input.damage ?? 0;
  if (damage <= 0 || !input.damageTo) return null;
  if (input.myHp === undefined || input.theirHp === undefined) return null;
  return input.damageTo === 'mine'
    ? { myHp: input.myHp + damage, opponentHp: input.theirHp }
    : { myHp: input.myHp, opponentHp: input.theirHp + damage };
}

/** The snapshot's own reading of both bars. */
export interface DuelHealthSnapshot {
  myHp: number;
  opponentHp: number;
}

/**
 * What to paint: the held pair while a round is mid-telling, the snapshot
 * otherwise.
 *
 * The snapshot is the FALLBACK rather than something the hold overrides
 * permanently, which is what keeps a stale hold from being a way to show a
 * wrong number: the window clears it on the damage beat and on every path that
 * ends a timeline, and anything this function was never handed comes straight
 * off the snapshot.
 */
export function duelHealthShown(
  snapshot: DuelHealthSnapshot,
  hold: DuelHealthHold | null,
): DuelHealthSnapshot {
  return hold ?? snapshot;
}
