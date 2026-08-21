<!-- src/ui/cards/: the Card Duel presentation layer (the card face, the duel
     table, the round theater). src/ui/CLAUDE.md owns the HUD-wide contracts
     (pure cores, painters, i18n, the perf budget); the rules engine lives in
     src/sim/minigames/card_duel/; the styling is src/styles/cards.css. Don't
     repeat any of them here. -->

# src/ui/cards - the Card Duel presentation layer

Everything that shows a Card Duel goes through this folder, and there are
exactly two consumers of it: the in-game window (`src/ui/card_duel_window.ts`)
and the standalone playtest slice (`src/cards/`). They share these modules and
one stylesheet, so the table a playtester judges and the table a player gets
cannot drift into looking like different games.

| File | What it is |
|---|---|
| `card_face_view.ts` | pure core: ids, values, the signed delta, tribes, rarity, display states. In `UI_PURE_CORES`. |
| `card_face_markup.ts` | thin consumer: face model in, markup out. Touches no DOM. |
| `duel_table_view.ts` | pure core: the clock band, the score pips, the counter tokens, each seat's commit, whose commit the round waits on. In `UI_PURE_CORES`. |
| `duel_beats_core.ts` | pure core: one resolved round as an ordered beat timeline, with the cue that rides each beat. In `UI_PURE_CORES`. |
| `duel_table_markup.ts` | thin consumer: table and stage models in, markup out. Touches no DOM. |
| `duel_theater.ts` | the driver that walks a timeline against an injected host. No element, no timer API, no audio object. |
| `duel_theater_host.ts` | the browser half: the real timer, the real element, and the one motion decision. In `UI_DOM_MODULES`. |
| `card_round_feedback.ts` | what a resolved round does to the client: hands the round and its cues to the stage, and plays them itself only when no stage took it |

## One card, one table, three sizes

The face is one component at three sizes (hand, stage, collection cell): same
model, same markup, only a CSS size variant differs. The TABLE is the same
idea one level up. Both consumers build the same seat bands, the same pips, the
same tokens, the same stage, from the same two pure cores. The only thing the
window and the slice legitimately differ on is the LABELS (`DuelStageLabels`):
the window is played from one seat and says "you", the hot seat has two named
seats and no reader to be "you".

## Why the consumers are not called painters

A `*_painter.ts` in this repo writes DOM on the `PainterHost` seam under the
per-frame write contract. `card_face_markup.ts` and `duel_table_markup.ts`
write no DOM at all: every surface that shows a face or a table is COLD and
event-driven, rebuilding its own subtree behind an invalidation signature, so
these are markup that a rebuild inserts. Naming them painters would enter them
into a gate whose contract they cannot meaningfully satisfy, and would claim a
cadence they do not have.

## Two cadences, and why they must stay apart

**The snapshot paints the truth.** The hand, the score pips, the clock and its
ring, each seat's commit lamp, the counter tokens, the revealed strip: every
one is correct the instant the snapshot arrives, at every graphics tier and on
every device. The window carries one memo PER REGION so a counter changing does
not rebuild the hand.

**The theater narrates.** A resolved round arrives as one `cardRoundResolved`
event and is played out over that already-true picture: the cards land, both
faces turn at once, the effects land with a delta chip on the card they moved,
the two cards strike, the winner surges. It owns exactly ONE element (the
stage) and writes exactly ONE attribute per beat (`data-beat`), so the whole
timeline costs no markup, no layout read, and the same on a phone as a desktop.
Every visual is a CSS rule keyed on that attribute.

The stage is the only region the snapshot never touches. A snapshot-driven
stage would be stomped by the next render, and staging the snapshot itself
would delay information.

## The fairness rule, concretely

Animation is cosmetic; the numbers are not. Motion lives entirely in CSS
(`transform` and `opacity` only), and THREE independent authorities each
collapse it: the in-game reduced-motion setting, the OS preference, and the
lowest graphics preset. `resolveDuelMotion` reads the same three, so the
JavaScript pacing and the CSS motion can never disagree and leave a player
watching a silent two seconds with nothing moving in it.

**Never tiered, at any preset, on any device, with no hover requirement and no
animation delay:** the effective value, the printed value, the signed modifier
delta, the rules text, revealed opponent cards, the round score, the counters,
the round clock, and whose commit is outstanding.
`tests/card_duel_window_clock.test.ts` pins it against the stylesheet.

**The one bounded exception**, written down so it stays bounded: the stage's
`deal` beat holds the two cards face-down for one beat (under 300ms, pinned in
`tests/duel_beats_core.test.ts`). It narrates a round that is ALREADY decided,
the pips and the hand underneath have already moved, the screen-reader line is
written at once rather than on a beat, and any of the three motion authorities
collapses it to zero. Nothing a player is still deciding on is ever staged.

## The clock and the reveal

The **clock** is driven from the snapshot deadline, never a client-side timer
that could drift out of agreement with the server, and it sits OUTSIDE every
region memo: folding it into one would rebuild that region every second, and
putting it behind an early return would freeze the one number the round is
racing. The ring is a second write of the same truth (a rounded ratio plus a
band name), elided the same way.

The **reveal** is driven from the `cardRoundResolved` event, never the
snapshot, for the reason in "Two cadences" above.

The **cues** ride the beats rather than firing at the switch arm: the reveal
sound when the cards turn, the push sound on the verdict, the shuffle when the
hand refills. A collapsed timeline still owes the player all of them, which is
why they are named on the beats and folded into the single settle beat rather
than fired by the caller. A CLOSED window has no beats to ride, so
`applyCardRoundFeedback` plays all three at once for exactly that case: a
player mid-match with the window shut still hears their round resolve.
