<!-- src/ui/cards/: the ClaudeStone presentation layer (the card face, the duel
     table, the round theater). src/ui/CLAUDE.md owns the HUD-wide contracts
     (pure cores, painters, i18n, the perf budget); the rules engine lives in
     src/sim/minigames/card_duel/; the styling is src/styles/cards.css. Don't
     repeat any of them here. -->

# src/ui/cards - the ClaudeStone presentation layer

Everything that shows a ClaudeStone match goes through this folder: the duel window
(`src/ui/card_duel_window.ts`), the deck builder, and every other surface that
paints a card. One card component, one table grammar, one stylesheet
(`src/styles/cards.css`), so a card cannot look or read differently depending
on where it appears.

| File | What it is |
|---|---|
| `card_face_view.ts` | pure core: ids, values, the signed delta, tribes, rarity, display states. In `UI_PURE_CORES`. |
| `card_face_markup.ts` | thin consumer: face model in, markup out. Touches no DOM. |
| `duel_table_view.ts` | pure core: the clock band, the score pips, the counter tokens, each seat's commit, whose commit the round waits on. In `UI_PURE_CORES`. |
| `duel_beats_core.ts` | pure core: one resolved round as an ordered beat timeline, with the cue and the SPOTLIGHT that ride each beat. In `UI_PURE_CORES`. |
| `duel_outro_core.ts` | pure core: the MATCH ending as three more beats in the same grammar (`finish`, `glory`, `curtain`), played after the last round has been told. In `UI_PURE_CORES`. |
| `duel_table_markup.ts` | thin consumer: table and stage models in, markup out. Touches no DOM. |
| `duel_theater.ts` | the driver that walks a timeline against an injected host. No element, no timer API, no audio object. |
| `duel_theater_host.ts` | the browser half: the real timer, the real element, and the one motion decision. In `UI_DOM_MODULES`. |
| `card_round_feedback.ts` | what a resolved round does to the client: hands the round and its cues to the stage, and plays them itself only when no stage took it |
| `card_inspect_view.ts` | pure core: where the enlarged copy of a hovered card sits. In `UI_PURE_CORES`. |
| `card_inspect.ts` | the card inspector: hover, focus or press-and-hold shows a card at a readable size. Owns the popup element and one layout read per show. |
| `card_flight.ts` + `card_flight_core.ts` | one card travelling between two rectangles: the FLIP-style transform (pure) and the node that flies it. |
| `duel_card_motion.ts` | all four card MOVES on the table (both seats' hand to stage, both seats' stage to discard). The one module that measures a rectangle. |

## One card, one table, four sizes

The face is one component at four sizes (hand, stage, collection cell, and the
inspect popup): same model, same markup, only a CSS size variant differs. The
hand size cannot fit the rules sentence, which is why the INSPECTOR exists:
`data-inspect` on a face makes hover, keyboard focus, and a touch
press-and-hold show the whole card at `cf-size-inspect`. It is not a graphics
feature (same at every preset, on every device) and it is aria-hidden, because
the sentence it shows also rides the card button own accessible name.

The TABLE is the same idea one level up: the seat bands, the pips, the counter
tokens, the opponent's hand, the effects row and the stage all come out of two pure cores
(`duel_table_view.ts`, `duel_beats_core.ts`) and one markup module.
`DuelStageLabels` is the seam for a surface that is NOT played from one seat
and cannot say "you".

## Why the consumers are not called painters

A `*_painter.ts` in this repo writes DOM on the `PainterHost` seam under the
per-frame write contract. `card_face_markup.ts` and `duel_table_markup.ts`
write no DOM at all: every surface that shows a face or a table is COLD and
event-driven, rebuilding its own subtree behind an invalidation signature, so
these are markup that a rebuild inserts. Naming them painters would enter them
into a gate whose contract they cannot meaningfully satisfy, and would claim a
cadence they do not have.

## Two cadences, and why they must stay apart

**The snapshot paints the truth.** The hand (at what each card is WORTH, with
the printed value and a signed chip beside it), the score pips, the clock and
its ring, each seat's commit lamp, the counter tokens, the opponent's hand with
any revealed cards face up in it, and the effects row: every one is correct the
instant the snapshot arrives, at every graphics tier and on every device. The
window carries one memo PER REGION so a counter changing does not rebuild the
hand.

Two of those answer questions the table could not answer before. A revealed
opponent card now has a HAND to be revealed in (a face-down place per card they
hold), instead of a floating strip with nothing to read it against. And the
effects row says what is still parked and on whom, sourced from the engine's
own modifier list (`src/sim/minigames/card_duel/preview.ts`) rather than a
second model that could disagree with the round.

**The theater narrates.** A resolved round arrives as one `cardRoundResolved`
event and is played out over that already-true picture: the cards land, both
faces turn at once, the effects land with a delta chip on the card they moved,
the two cards strike, the winner surges. It writes TWO attributes per beat and
touches two elements, both of which survive every region repaint: `data-beat`
on the stage, and `data-spot` on the BOARD. So the whole timeline costs no
markup, no layout read, and the same on a phone as a desktop; every visual is a
CSS rule keyed on one of those two attributes.

The spotlight is the second one, and it is why the board is involved at all. A
beat used to say WHEN something happened and never WHICH thing it happened to:
a value ticked, a bar dropped, and a player watching the middle of the table
could not tell which of the two cards had changed. `DuelSpotlight`
(`duel_beats_core.ts`) names the subject per beat and a gold ring says "this
one" on exactly that card or bar. A step follows the VALUE that moved, not the
card that did the moving. The health bars are in the seat bands rather than the
stage, which is the whole reason the attribute goes on their common ancestor.

**The cards MOVE.** Every card a player sees enter or leave the table travels
there (`duel_card_motion.ts`): the viewer's own card from the hand cell it was
clicked in, the opponent's as a face-down back out of their hand row, and both
spent cards into their seat's discard pile on the `settle` beat, shrinking as
they go. The opponent's discard is a PLACE with no figure on it, because their
count is not on the wire and a number there would be invented. Every flight is
decoration over a state the snapshot already painted (the committed card is on
the stage the instant the commit lands), so reduced motion drops all four and
loses nothing.

The stage is the only region the snapshot never touches. A snapshot-driven
stage would be stomped by the next render, and staging the snapshot itself
would delay information.

## The fairness rule, concretely

Animation is cosmetic; the numbers are not, and neither is the PACING. Motion
lives entirely in CSS (`transform` and `opacity` only).

**A ROUND IS NEVER TOLD ALL AT ONCE. There is no preset, no device and no
comfort setting that collapses it.** `resolveDuelMotion` has exactly two
answers for a live table:

- **`full`**, the default: every beat with the movement that goes with it
  (cards land and lunge, the chip flies onto the card it moved, the value ticks,
  the ring flashes, the played cards fly to the stage and then to the piles).
- **`calm`**, for BOTH the lowest graphics preset and reduced motion (in-game or
  OS): every beat, at the same times, with the movement dropped and the cheap
  channel kept, a composited opacity fade per beat plus the gold ring. Nothing
  translates, scales or lunges; the card flights are skipped entirely.

`none` still exists in the vocabulary, but nothing a player controls selects it.
It is the driver's catch-up answer for a stage nobody is watching (`finishNow`,
a closed window), where the finished picture is the only correct one.

Reduced motion used to collapse the round, and that was the defect this ladder
is written around: both cards, every effect, the hit and the winner arrived in
one frame, so the player was handed a result with no account of what produced
it. Reduced motion is owed the absence of MOVEMENT, not the absence of being
told what happened, and the player on the cheapest machine is the last one who
should have to reconstruct a round from its aftermath.

Because `calm` exists, every beat owes both a STATIC state (the face-down back,
the revealed face, the delta chip, the winner gold edge) AND something a player
can watch arrive: the fade, the gold ring, and its line in the caption strip
(`duelBeatCaptionsHtml`), written once with the stage and switched by the same
`data-beat` attribute. A beat a player cannot tell apart from its neighbour is
not a beat.

The stylesheet keys the quiet version on ONE hook, `data-motion` on the board,
written once per round by the theater. Two authorities (a media query and a root
attribute) resolving to one behavior must not become two copies of every rule,
and the ring's own animation rides a custom property (`--dt-spot-anim`) rather
than a literal, because its lit selector is specific enough (0,3,1) that a tier
rule trying to quiet it would lose the cascade silently.

**Never tiered, at any preset, on any device, with no hover requirement and no
animation delay:** the effective value, the printed value, the signed modifier
delta, revealed opponent cards, the opponent's hand size, the effects still in
play, the round score, the counters, the round clock, and
whose commit is outstanding.
`tests/card_duel_window_clock.test.ts` pins it against the stylesheet.

The RULES TEXT is in that list with one honest asterisk: it is in the markup at
every size, but the hand variant has no room to show it, and a display:none node
is out of the accessibility tree too. So the sentence reaches a hand card two
ways that are neither tiered nor device-dependent: the button own accessible
name carries it (`cards.card.playDetail`), and the inspector shows it.

**The one bounded exception**, written down so it stays bounded: the stage's
`deal` beat holds the two cards face-down for one beat (the shortest beat in the
timeline, and under two thirds of a second, both pinned in
`tests/duel_beats_core.test.ts`). It narrates a round that is ALREADY decided,
the pips and the hand underneath have already moved, the screen-reader line is
written at once rather than on a beat, and it holds an already-decided round
whatever the motion level. Nothing a player is still deciding on is ever
staged.

## How a match ENDS

The sim emits `cardDuelMatchEnd` in the SAME tick as the final
`cardRoundResolved`. The window used to answer it directly: stop the theater,
render the summary. So the round that DECIDED the match was the one round a
player never saw, and the match ended by having its loudest moment deleted.

The ending is QUEUED behind the round instead. `showMatchEnd` holds the summary
in `pendingEnd`, `DuelTheater.play` takes a completion callback that fires when
the round's last beat opens, and the ending gets its turn then. Three things
follow from that and none of them are optional:

- **The settled round is owed a frame.** `DUEL_OUTRO_LEAD_MS` sits between the
  round's last beat and the ending's first, because an outro that opened at
  zero would overwrite the settle beat before it painted, which is the same
  complaint one layer down.
- **The last beat is owed its hold.** The hand-off is scheduled at
  `duelOutroSpanMs(beats)`, not on the last beat opening: a beat that is
  replaced on the frame it opens did not happen.
- **A closed window, a forfeit, or a stalled client goes straight to the
  summary.** Motion `none` builds an EMPTY outro, `finishNow()` still runs the
  queued ending (a stall must not swallow the summary), and `stop()` drops it
  (the window is going away).

The outro is not a second animation system: same `DuelBeat` shape, same driver,
same host, same `data-beat` attribute, one extra `data-ending` on the board for
which way it went. It obeys the motion ladder exactly as a round does, so
`calm` gets all three beats at the same times with the movement dropped.

**And nothing may open over the summary.** The Card Master stands exactly where
a duel is played, and his gossip dialog paints OVER this window, so the
interact press (or the left-click that talks too) landing on him as a match
ended replaced the result with a menu before the player had read it. The match's
own outcome was the one thing its ending could not show, which is the same
complaint the queued outro answers one layer up. `holdsUnreadSummary` is the
gate and `Hud.openQuestDialog` is where it is read: that is the single funnel
every gossip route goes through (both `src/game/interactions.ts` arms and
`src/game/nearby_interaction.ts`), so one guard covers the click and the
keypress at once. It is a REFUSAL, not a deferral: the gossip opens on the next
interact once the player has dismissed the summary themselves (its close
button, a rematch, or closing the window). A dialog that queued itself up would
just arrive over whatever the player did next.
`tests/card_duel_summary_gate.test.ts` pins the gate and the wiring.

## The clock and the reveal

The **clock** is driven from the snapshot deadline, never a client-side timer
that could drift out of agreement with the server, and it sits OUTSIDE every
region memo: folding it into one would rebuild that region every second, and
putting it behind an early return would freeze the one number the round is
racing. The ring is a second write of the same truth (a rounded ratio plus a
band name), elided the same way.

The **reveal** is driven from the `cardRoundResolved` event, never the
snapshot, for the reason in "Two cadences" above.

**Play is CLOSED while a round is being told**, and it is the same number on
both sides: the sim holds the round clock for `cardNarrationSeconds` and
refuses a card played inside that window, and the hand paints itself unplayable
for exactly it (`resolving` on the projection). The timeline's last beat opens
at that same instant, pinned in `tests/duel_beats_core.test.ts`, so the hand
comes back the moment the clock starts counting again and never a beat before
the round finishes speaking.

The **cues** ride the beats rather than firing at the switch arm: the reveal
sound when the cards turn, the push sound on the verdict, the shuffle when the
hand refills. A collapsed timeline still owes the player all of them, which is
why they are named on the beats and folded into the single settle beat rather
than fired by the caller. A CLOSED window has no beats to ride, so
`applyCardRoundFeedback` plays all three at once for exactly that case: a
player mid-match with the window shut still hears their round resolve.
