<!-- src/ui/cards/: the Card Duel card face. src/ui/CLAUDE.md owns the HUD-wide
     contracts (pure cores, painters, i18n, the perf budget); the rules engine
     lives in src/sim/minigames/card_duel/. Don't repeat either here. -->

# src/ui/cards - the card face

One component, three sizes: the hand, the reveal stage, and a collection cell
paint the SAME model through the SAME markup, and only a CSS size variant
differs. Every surface that shows a Card Duel card goes through this pair, so a
card cannot look or read differently depending on where it appears.

| File | What it is |
|---|---|
| `card_face_view.ts` | the pure core: ids, values, the signed delta, tribes, rarity, display states. Registered in `UI_PURE_CORES`. |
| `card_face_markup.ts` | the thin consumer: model in, markup out. Touches no DOM. |
| `card_round_feedback.ts` | what a resolved round does to the client: the audio cues plus the reveal stage |

## Why the consumer is not called a painter

A `*_painter.ts` in this repo writes DOM on the `PainterHost` seam under the
per-frame write contract. This module writes no DOM at all: every surface that
shows a face is COLD and event-driven, rebuilding its own subtree behind an
invalidation signature, so a face is markup that rebuild inserts. Naming it a
painter would enter it into a gate whose contract it cannot meaningfully
satisfy, and would claim a cadence it does not have.

## The fairness rule, concretely

Animation is cosmetic; the numbers are not. Motion lives entirely in CSS
(`transform` and `opacity` only), and the lowest graphics preset and
`prefers-reduced-motion` each collapse it independently.

**Never tiered, at any preset, on any device, with no hover requirement and no
animation delay:** the effective value, the printed value, the signed modifier
delta, the rules text, revealed opponent cards, the round score, the round
clock, and whose commit is outstanding. Information is never gated on an
animation completing: numbers are correct and readable the instant the snapshot
arrives, and the animation plays over already-true state. With a 45 second
round clock that is not academic, since a delayed number eats a real fraction
of the decision window. `tests/card_duel_window_clock.test.ts` pins it.

## The clock and the reveal

The **clock** is driven from the snapshot deadline, never a client-side timer
that could drift out of agreement with the server, and it sits OUTSIDE the
window's repaint signature: folding it in would rebuild the window every
second, and putting it behind the early return would freeze the one number the
round is racing.

The **reveal** is driven from the `cardRoundResolved` event, never the snapshot.
The window returns early on an unchanged signature, so a snapshot-driven stage
would be stomped by the next render, and staging the snapshot itself would
delay information. The snapshot keeps painting the truth underneath; the reveal
only tells the story over it.
