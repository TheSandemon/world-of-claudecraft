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
| `card_scene_view.ts` | pure core: the DEFAULT ART. The scene a card describes, from its setting, its tribe and the words in its own id. In `UI_PURE_CORES`. |
| `card_scene_markup.ts` | thin consumer: scene model in, one inline SVG out. Touches no DOM. |
| `duel_table_view.ts` | pure core: the clock band, the score pips, the counter tokens, each seat's commit, whose commit the round waits on. In `UI_PURE_CORES`. |
| `duel_beats_core.ts` | pure core: one resolved round as an ordered beat timeline, with the cue and the SPOTLIGHT that ride each beat. In `UI_PURE_CORES`. |
| `duel_health_core.ts` | pure core: what the two health bars SHOW while a round is told (the pre-round reading, until the damage beat). In `UI_PURE_CORES`. |
| `duel_outro_core.ts` | pure core: the MATCH ending as three more beats in the same grammar (`finish`, `glory`, `curtain`), played after the last round has been told. In `UI_PURE_CORES`. |
| `duel_table_markup.ts` | thin consumer: table and stage models in, markup out. Touches no DOM. |
| `duel_theater.ts` | the driver that walks a timeline against an injected host. No element, no timer API, no audio object. |
| `duel_theater_host.ts` | the browser half: the real timer, the real element, and the one motion decision. In `UI_DOM_MODULES`. |
| `duel_cue_audio.ts` | the audio surface (one method per `DuelBeatCue`) and the cue-to-method map. DOM-free, shared by the host and the closed-window arm so the two cannot disagree. |
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

## The default art is DRAWN, and it is what every card looks like

`art` on a `CardDefinition` is an id, not a path, and it resolves to a
committed painting through `src/ui/card_art.ts`. **No painting has been
commissioned yet**, so the fallback is not a placeholder behind the art: it IS
the art, on all two hundred cards.

It used to be a flat CSS gradient keyed on tribe, and only five of the twelve
tribes even had a colour, so the whole catalog rendered as about six coloured
rectangles. A hand of five was five blanks a player could tell apart only by
reading the name plate, which is the one thing a card at hand size has no room
for. So the fallback draws the SCENE, and it reads the scene off the card:

- the **setting** from the design identity, with the tags as the fallback
  (Ashen Flight burns, Mirefen floods, Tunnel Crown is underground),
- the **subject** from the first tribe, one silhouette each,
- the **motifs** from the words in the card's own id, which is the closest
  thing the content has to a description of the scene:
  `boneflame_host_pyre_night` gets a pyre and a moon because it says so.

Three properties are load-bearing and the rest is taste:

- **Total.** Every input draws a place. No tribe means a landscape with no
  figure, an unrecognised word contributes nothing, and a retired card id (a
  saved deck naming a card the catalog dropped) still renders. "No art" must
  never be a state that reaches a player as an empty rectangle, because it is
  the state every card is in.
- **Deterministic**, from a hash of the ART id and nothing else: no wall clock,
  no `Math.random`, no counter. A card a player is learning to recognise must
  be the same picture in the next hand, the next session and on the next
  machine. Keying on the art id rather than the card id also means two cards
  that deliberately share a painting share a scene, which is what the separate
  field is for.
- **Decorative.** The whole SVG is `aria-hidden`. The card's accessible name
  already carries its name, value and rules sentence.

The sky rides an inline `background` gradient on the `<svg>` and the subject's
rim is a `<use>` of its own path, because the deck builder paints the WHOLE
catalog at once and rebuilds it on every card toggle. A face is about 1.9 KB of
scene; that is a real cost on that one surface and the reason the cheap
reductions are there rather than a matter of taste.

## Why the consumers are not called painters

A `*_painter.ts` in this repo writes DOM on the `PainterHost` seam under the
per-frame write contract. `card_face_markup.ts` and `duel_table_markup.ts`
write no DOM at all: every surface that shows a face or a table is COLD and
event-driven, rebuilding its own subtree behind an invalidation signature, so
these are markup that a rebuild inserts. Naming them painters would enter them
into a gate whose contract they cannot meaningfully satisfy, and would claim a
cadence they do not have.

## The value a card is worth is a SUM, not three numbers

A modified card shows `5 +2 = 7` as one group in its corner: the printed
value, what the effects did to it signed, and what the comparison will
actually use. All three were on the face before this and none of them read
together: the effective value was in the top-left, the printed value hid
BEHIND it struck through (which reads as "void", not as "was"), and the
modifier sat in the OPPOSITE corner. Working out where a 7 came from meant
looking in two places and doing the arithmetic, on a card in hand, at the
moment a player is choosing between four of them. That is the one calculation
the face exists to have already done.

The order is load-bearing and pinned: printed leads because it is the card's
identity, the modifier is coloured by DIRECTION because which way the value
moved is what is being read, and the effective value is last and largest
because it is what the round will compare. An unmodified card shows the single
number alone, because `3 + 0 = 3` is three ways of saying one thing.

The group carries the accessible name and its terms are `aria-hidden`: four
loose digits read out is worse than the one sentence the card button's own
name (`cards.card.playDetail`) already gives. `cf-corner-sum` is the only part
that takes a backing plate, and only because four terms of mixed size and
colour over painted art stop reading as one group where a lone gold digit does
not.

## Two cadences, and why they must stay apart

**The snapshot paints the truth.** The hand (at what each card is WORTH, as
the SUM that got it there), the score pips, the clock and
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

**The health bars are the one exception, and it is about PACING, not truth.**
A round resolves in the same tick both cards land, so the snapshot's health is
already the AFTER value while the cards are still turning: the bars dropped
about six seconds before the `damage` beat whose entire job is to show the hit,
the spotlight lit a number nobody had watched change, and a player who lost the
match saw their health reach zero during the deal. So the bars HOLD their
pre-round reading for the length of the telling and the damage beat releases
them (`duel_health_core.ts`, which reconstructs that reading by adding the
damage back onto the side that took it rather than remembering a paint that may
never have happened). Three things keep it legal and all three must stay true:
play is CLOSED for exactly that window (the sim holds the round clock for
`cardNarrationSeconds` and refuses a card played inside it, so no decision can
turn on the held number, and the bars are released before the hand comes back);
it is identical at every preset, on every device and under reduced motion,
because `calm` keeps every beat at its own moment; and it is bounded by the
round, since every path that ends a timeline early drops the hold and the
snapshot's own numbers are back on the bars. Nothing else on the table is ever
held: this is the single member of that list, not a precedent for a second one.

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

Health is in that list too, with the timing note above attached: it is never
tiered, never behind a hover and never behind an animation completing, and the
one thing that moves it is the damage beat, which arrives at the same instant at
every preset.

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

## The deck builder shows ONE VALUE, never the catalog

The builder is a deck COLUMN beside a POOL. The column is all ten values,
twenty slots, always in view, drawn as pips rather than card faces. The pool is
the cards on offer at the ONE value being worked on, about twenty of them.

It used to hand every value row its own full pool, so the window listed every
card in the game on a single page: two hundred faces to scroll past in order to
fill twenty slots, and a full rebuild of all of them on every click (measured:
6280 nodes and 172 ms per press). It is 693 nodes now, and a click costs the
two regions rather than the catalog.

The column is deliberately BOTH things. It is the deck at a glance, which is
what a player wants while choosing, and it is the navigator that points the
pool at a value. Making it both is what lets the pool narrow to one value
without hiding the deck, which is the trade the old layout got wrong in the
other direction. It opens on the first value still missing a card, so the
window lands on the work; once the player picks a value the choice STICKS,
because a focus that re-derived itself would jump away the moment they filled
the value they were looking at.

Three signatures, one per region, and each omission from the shell is
deliberate:

- `deckBuilderShellSignature` is the saved-deck list alone. It is the only
  change that costs a full rebuild, so nothing that moves while a player works
  may reach it.
- `deckBuilderDeckSignature` is the twenty slots plus the focused value (the
  column has to show which row is selected).
- `deckBuilderPoolSignature` is the focused value, the set filter, and which
  cards are taken. The filter lives here because it narrows only this pane.
- `filled` and the draft NAME are in none of them. `filled` drives the progress
  line and the Save button, written in place. The name is what the player types
  into, and a signature that moved with it rebuilt the window mid-keystroke and
  took the caret with it.

Two consequences that are not optional:

- **The wiring is delegated, and bound ONCE PER ELEMENT.** A region is replaced
  under the handler, so a listener bound to a card button is bound to a node the
  next toggle destroys. One click handler on the root reads its target at click
  time. The second half is what both ClaudeStone windows got wrong: the rebuild
  replaces the markup INSIDE the root, but the root is the element from
  `index.html` and lives for the whole session, so wiring with the shell added a
  listener per rebuild. A match walks the duel window's shell through available,
  in a match, and over, so one press afterwards ran every arm several times: as
  many click sounds, as many play commands, and a Decks button that toggled the
  builder open and shut again in a single press and read as dead. Each window
  keeps the root it wired and returns early on a second attempt; delegation is
  exactly what makes one binding sufficient, so the guard costs nothing.
  `tests/card_duel_window_lifecycle.test.ts` presses a button after several
  rebuilds and pins one arm per press.
- **The pane height is capped on `.db-panes`, never on the window.** The HUD
  shows a window by writing `display: block` INLINE, which beats any
  `display: flex` the stylesheet sets, so a flex chain from the window down to
  the panes silently never forms; the bar escaped above the window frame for
  exactly that reason before the cap moved.

`relocalize` stays one arm for all three memos, and that is a property of the
split rather than an assumption: clearing the shell signature forces the shell
branch, which rebuilds both regions and re-latches their signatures from the
fresh markup, so no region can be left holding pre-switch text.
`tests/deck_builder_repaint.test.ts` pins all of it on node identity, which is
the only check that tells "repainted one region" apart from "repainted
everything and produced the same markup".

## How a match ENDS

The sim emits `cardDuelMatchEnd` in the SAME tick as the final
`cardRoundResolved`. The window used to answer it directly: stop the theater,
render the summary. So the round that DECIDED the match was the one round a
player never saw, and the match ended by having its loudest moment deleted.

**The SHELL is the second half of that, and queueing alone did not survive it.**
The sim drops the match in the same tick, so by the very next HUD poll the
projection was no longer `inMatch`, `render` computed a new shell, and the
rebuild replaced the stage while `cacheRegions` dropped the theater bound to it.
The queued ending, the outro and the last round all went at once, a frame after
they started, and the match simply stopped with nothing narrated. So a window
that `isNarrating()` (a timeline still running, or an ending queued behind one)
HOLDS its shell whatever the projection now says, and `revealSummary` is what
releases it, which is also the one place `summary` is set: the window still
rebuilds into the ending exactly once. A window CLOSED mid-ending promotes the
queued summary rather than dropping it, so a reopen still shows the result and
no shell is held for a story that can no longer be told.

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

The **cues** ride the beats rather than firing at the switch arm, and **EVERY
BEAT CARRIES ONE**: the cards land, the faces turn, each effect ticks, the two
cards lean in, the hit lands, the verdict says who took it, the round settles
(or the deck comes back around). The ending's three beats too: the bar empties,
the match is called, the table clears.

That totality is the rule, not an accident of the current list. Half the
timeline used to be silent (the deal, the clash, a decided verdict, and a
settle with no reshuffle behind it), so a round's audio told a shorter story
than its picture did: a player heard the cards turn and then nothing, while
four more moments went past on screen. A beat is defined as one thing the
player is being told, so a beat with no sound is a thing the player who is not
staring at the window is never told at all. `cueFor` is total over the round
phases and `outroCue` over the ending's, which is what keeps it true.

Two cues branch, because they carry two different pieces of NEWS rather than
two volumes of the same one: the verdict (`roundWin` / `roundLose` / `push`)
and the settle (`settle` / `shuffle`). The match verdict is the third
(`matchWin` / `matchLose`), and what was wrong with IT was never how it
sounded, it was that it fired on the `cardDuelMatchEnd` EVENT, which the sim
emits in the same tick as the final round. A player heard the match end while
the round that decided it was still speaking. It rides the `glory` beat now,
and `showMatchEnd` returns whether the ending will be narrated so the HUD arm
knows whether it still owes the sound, exactly the contract `showReveal` has.

**A beat REUSES a recording the game already ships unless it cannot.** The
whole vocabulary resolves through `UI_CUES` in `src/game/audio.ts`, and only
two members of it are ClaudeStone's own: `ui_card_effect` and `ui_card_hit`.
Everything else borrows, and each borrow was chosen because the cue already
MEANS the thing the beat means rather than because it was close enough to
reach for: two cards going down is `ui_card_play`, the clash is the duel's
own `ui_duel_start`, the round verdict is the Fiesta score pair (already a
mirrored "I scored" / "they scored", so a player tells them apart untaught),
the settle is the bag's put-away close, a health bar running out is the
Fiesta "down" cue, and the table clearing for the summary is a panel opening.
A new recording is an asset to master, conform and carry forever, so it has to
earn itself; the two that did are the ones with no catalog equivalent, a small
repeatable tick and a blunt health-loss thud, and both fire several times a
round where a borrowed cue would wear immediately.

A collapsed timeline still owes the player all of them, which is why they are
named on the beats and folded into the single settle beat rather than fired by
the caller. A CLOSED window has no beats to ride, so `applyCardRoundFeedback`
plays them all at once for exactly that case: a player mid-match with the
window shut still hears their round resolve.

**Neither arm owns a copy of the decisions.** `duelCues` is READ OFF
`buildDuelBeats` rather than rebuilt beside it, and both arms fire through
`duel_cue_audio.ts`. A hand-written second list is a copy that only has to be
right and is never checked at the moment it goes wrong: a round played with the
window open and the same round played with it shut would simply have sounded
different, silently, for exactly the players who cannot see that anything is
missing. The cue-to-method map is a `Record` keyed on the cue union, so a cue
added to the vocabulary without a method is a compile error rather than the
bare `else cardShuffle()` fallback it replaced.

**The window's own controls answer too.** Sitting down, joining or leaving the
queue, forfeiting, opening the deck builder, dismissing a summary, playing a
card, and every press in the deck builder fire the shared UI click. These are
ordinary buttons rather than moments in a round, so they take the ordinary
sound and the round's vocabulary stays reserved for the beats. Both windows
attach it ONCE on the root ahead of the dispatch rather than per arm, so a
control added later is audible by construction. Playing a card is NOT special
cased here: the click is the press, and the card's own cue rides the sim's
`cardPlayed` event a moment later, which is what both seats hear.
