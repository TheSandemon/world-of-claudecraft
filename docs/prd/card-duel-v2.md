# ClaudeStone V2: the data-driven rules language

Implementation plan for expanding the ClaudeStone minigame from a bare
value-comparison game into the data-driven card system specified by
`docs/design/card-duel-rules-language.md` (the rules-language brief), without
growing a monolith and without breaking the shipped feature.

Read first: the brief, `src/sim/CLAUDE.md`, `src/sim/content/CLAUDE.md`,
`src/ui/CLAUDE.md`, `docs/design/graphics-settings-fairness.md`, and
`docs/design/tooltip-writing.md`.

## What exists today

The shipped feature is small and clean, and every piece of it survives V2:

| Concern | Today | V2 |
|---|---|---|
| Deck engine | `src/sim/minigames/card_hand.ts`, `number[]` | generalized to `CardInstance[]`, same shape, relocated |
| Matchmaking | `src/sim/social/card_duel_queue.ts` | unchanged |
| Match orchestration | `src/sim/social/card_duel.ts` | stays the SimContext-bound orchestrator, does not absorb the engine |
| Seam | `src/world_api/card_minigame.ts` | grows a deck facet; `playCardInDuel` re-keys to an instance id (6.3) |
| View core | `src/ui/card_duel_view.ts` | grows, stays DOM-free |
| Painter | `src/ui/card_duel_window.ts` | rebuilt on real card faces |
| Content | one NPC record, no cards | a card catalog under `src/sim/content/cards/` |

The identity worth preserving, stated so no phase quietly trades it away:
simultaneous hidden selection, a short best-of match, no proximity needed
once matched, no level or gear input, and an offline-safe read surface.

## 0. Preservation ledger (nothing below is removed)

V2 is strictly additive to the live back end. Every hook, dependency, and
guard that exists today keeps its meaning:

- The four commands `card_queue_join`, `card_queue_leave`, `play_card`,
  `card_forfeit`, and `play_card`'s validate-before-dispatch discipline.
  (`play_card`'s payload FIELD does change, from a card value to a hand
  instance id; the command, its dispatch arm, and its guard all stay. See
  section 6.3, the one deliberate breaking change in this plan.)
- `card_queue_join`'s membership in `JAILED_BLOCKED_COMMANDS`.
- The `cardDuel` sim tick phase name and its profiler lap, and the
  `cardDuel` self-wire key inside the `social` phase, delta-omitted.
- `play_card`'s `wager` classification in `server/economy_telemetry.ts`.
  It moves no copper today and V2 does not change that, but the mapping
  stays so the surface does not silently downgrade to `other`.
- The four SimEvents `cardDuelMatchStart`, `cardPlayed`,
  `cardRoundResolved`, `cardDuelMatchEnd`, with their existing payload
  fields intact. New fields are added, never renamed or removed.
- The four audio cues plus the deliberate reuse of `duelEnd` and
  `arenaLoss` for match end.
- The `cardDuelsWon` deed stat and the `pvp_card_duel_first_win` deed.
- Every anti-farm and liveness rule in `card_duel.ts`: the join-time death
  gate, the pre-pair stale sweep, the mid-match ghost gate, the per-round
  deadline, `voidMatch` for a zero-round manual forfeit, and forfeit
  crediting the non-forfeiting side once a round has been won. These were
  each installed against a named exploit; V2 inherits all of them.
- The `log.cardDuel*` and `error.cardDuel*` key block in
  `src/ui/sim_i18n.ts` and its locale fills.
- `tests/parity/scenarios.ts`'s `card_duel` scenario (its golden is
  regenerated, the scenario itself is kept and extended).

Three things do change, deliberately and visibly, and none of them is a
removal:

- `CARD_DUEL_ROUND_DEADLINE_S` moves from 90 to 45 (section 7). Same
  constant, same per-round refresh, new value.
- The draw rule becomes refill-to-4 (section 6.2), and match end gains a
  **draw** outcome (section 7.1) as an additive `cardDuelMatchEnd` field.
- `play_card`'s payload field moves from a card value to a hand instance
  id (section 6.3). This is the one genuinely breaking change in the plan.

## 1. Directory layout

`src/sim/minigames/` currently holds exactly one file, `card_hand.ts`, and
the repo's other minigames did **not** land there: lockpick is
`src/sim/lockpick.ts` plus `src/sim/delves/lockpick_controller.ts`, and
fishing is `src/sim/professions/fishing.ts`. So `minigames/` is a one-file
folder, not an established convention, and a bare pile of `cards_*.ts`
files at its root would be worse for the next contributor.

Per the root CLAUDE.md rule for a new multi-file subsystem (a directory
with an `index.ts` barrel exposing only its public surface, plus a local
`CLAUDE.md`), the engine gets its own named subdirectory:

```
src/sim/minigames/
  CLAUDE.md         what belongs in a minigame folder and what does not
  card_duel/
    types.ts        CardDefinition, CardInstance, Trigger, ConditionTree,
                    TargetSelector, EffectDefinition, Duration, StackMode,
                    EffectLimits, NumericExpr
    deck.ts         deck legality, shuffle, refill, play (today's
                    card_hand.ts, generalized from number to CardInstance)
    match_state.ts  PlayerCardState, RoundState, CardHistory
    expressions.ts  numeric expression evaluator
    conditions.ts   ConditionTree evaluator (ALL / ANY / NOT + leaves)
    selectors.ts    target resolution (with deck.ts, the only rng site)
    modifiers.ts    modifier application, duration expiry, stack modes
    effects.ts      the effect applier, one handler per primitive
    resolve.ts      the round pipeline, priority-ordered
    text.ts         rules-text VALUE resolution (key plus values)
    bot.ts          the CPU opponent policies, pure (section 9.2)
    index.ts        barrel
    CLAUDE.md
```

The new `src/sim/minigames/CLAUDE.md` is the part that serves future
contributors: it states that a minigame folder owns pure,
`SimContext`-free rules only, that the SimContext-bound orchestrator stays
in `src/sim/social/` or the owning system, and that a minigame with a
single small pure core does not need a folder at all.

`card_hand.ts` moves into `card_duel/deck.ts` as a **move-not-rewrite**,
so `tests/card_hand.test.ts` carries over and proves the generalization
altered no deal, shuffle, or reshuffle behavior. The draw rule itself
changes in Phase 5 (section 6.2), separately and visibly.

## 2. Determinism, which is the hard constraint

The sim runs identically in the browser, on the server, and headless, and
`tests/parity/golden/card_duel.json` pins the rng draw count and digest.

### 2.1 Declared rng sites only

Rng is drawn in exactly two modules: `deck.ts` (shuffle, reshuffle) and
`selectors.ts` (the `random*` selectors). Everything else is a pure
function of state, always through the injected `{ next(): number }`, never
`Math.random`, which `tests/architecture.test.ts` already scans for.

Add a guard test asserting no other module under `card_duel/` touches the
rng parameter, so a future effect cannot smuggle in a hidden draw that
silently invalidates the golden.

### 2.2 Order independence: it makes authoring easier, not harder

The complexity is paid once by roughly eight engine primitives, not by the
hundreds of cards.

- A contributor writing a normal card uses `modifyValue`, `addCounter`,
  `removeCounter`, or `addTribe`. These are commutative: applying them in
  any order gives the same answer. Such a card **never specifies a
  priority and never thinks about resolution order at all.** That is the
  overwhelming majority of cards.
- Only the rare non-commutative primitives (`setValue`, `swapValues`,
  `copyValue`, `silence`, `removeTribe`, `winTies`, `reverseComparison`)
  care, and their priorities are declared **once in the engine**, next to
  the primitive, not per card. A card using `silence` inherits the right
  priority automatically.
- The catalog test enforces that no two non-commutative effects share a
  priority. That is a static property, so a mistake fails at authoring
  time with a clear message instead of becoming a rare desync nobody can
  reproduce.

Without this, every contributor adding a card would have to reason about
whether their effect interacts with an arbitrary "player A resolves first"
order. The property test (resolve each phase forward and reversed, assert
identical output) is what makes the guarantee real rather than
aspirational. One paragraph in `card_duel/CLAUDE.md` telling contributors
"use the listed commutative effects and ignore priority entirely" covers
the normal case completely.

### 2.3 No iteration over an insertion-ordered collection

Effect collection walks explicit arrays sorted by declared keys. It must
never depend on `Map` or `Set` insertion order, since the hosts can
populate those differently.

### 2.4 A hard resolution ceiling (this is a realm-safety issue)

The brief's `EffectLimits` prevent a single effect from over-triggering
but do not prevent a *cycle* across two cards, and one process serves an
entire realm. An unbounded trigger loop inside the 20 Hz tick is not a
card bug, it is an outage.

Add a global per-round ceiling on resolution steps in `resolve.ts`. On
overflow: stop resolving, resolve the round on current values, log to the
dev channel. Pin it with a deliberately cyclic card pair.

## 3. The card definition and the art variable

```ts
export interface CardDefinition {
  id: string;                       // permanent, never reused
  nameId: string;                   // i18n key id, never English text
  textId: string;                   // i18n key id, never English text
  /**
   * Art id, NOT a URL and NOT the card id. Resolves to
   * public/ui/cards/<art>.webp through src/ui/card_art.ts. Deliberately
   * separate from `id` so several cards can share one painting without
   * duplicating a 512px source.
   */
  art: string;
  value: CardValue;                 // 1 to 10
  tribes: readonly CardTribe[];
  tags: readonly CardTag[];
  rarity: CardRarity;
  effects: readonly CardEffect[];
}
```

**`art` is an id, not a path.** `src/sim/` has zero DOM and zero browser
imports. A `/ui/cards/...` string in a sim content record hard-codes
client asset layout into the authoritative simulation, which also runs
headless and server-side where that path means nothing. The sim owns the
id; `src/ui/` owns the resolution.

**`art` is separate from `id` on purpose.** With a catalog this large,
shared art means a tribe-mate, reskin, or value variant costs a record
rather than a new 512px source painting.

**It resolves through the existing icon ladder**, following the deed art
pattern exactly: committed WebP at `public/ui/cards/<art>.webp`, a
generated `src/ui/card_image_ids.ts` exporting `CARD_IMAGE_IDS` as a plain
`ReadonlySet<string>` (no DOM, no fs at runtime, same do-not-hand-edit
header as `src/ui/deed_image_ids.ts`), a
`scripts/convert_card_art_webp.mjs` step following
`scripts/convert_deed_icons_webp.mjs` and chained into `npm run build`,
and a `tests/card_art.test.ts` gating the set against the committed files
with exact equality in both directions plus an arm asserting every
`CardDefinition.art` is a member.

Cards are portrait, not the square 128px icon, so they get their own
directory and sizing rather than riding `public/ui/items/`. A card with no
committed art still renders, falling back to a procedural face keyed on
tribe plus value the way `src/ui/icons.ts` falls through to its recipes.
Never ship a card that renders as a blank rectangle.

Card ids are permanent and never reused, since saved decks reference them.
A retired id is ignored on load rather than throwing.

## 4. Rules text, i18n, and tooltips

**Do not machine-assemble rules text by concatenating clause fragments
from the effect tree.** The root CLAUDE.md bans building player-visible
strings by concatenation, and clause-order assembly translates badly into
any language whose word order differs from English. A machine-assembled
sentence also cannot be reviewed against
`docs/design/tooltip-writing.md`.

**Instead: each card authors one whole-sentence i18n key with
placeholders, and the effect tree supplies the resolved values.**

```ts
// src/ui/i18n.catalog/cards.ts (English only, per the contributor rule)
forest_wolf_text: '+{amount} if your previous card was a Beast.',
pack_alpha_text:  '+{amount} for every two Beasts you have played this match.',
```

`text.ts` returns `{ textId, values }`, never a string. The UI calls
`t(textId, values)`. This satisfies one key per string, resolved live
values as tooltip-writing requires, and translatable word order at once.

Pin it with a catalog test: every card has a `nameId` and `textId` present
in the catalog, and every `{placeholder}` in the English text is a name
the card's own effect tree can actually supply.

**Catalog size forces lazy locale chunks.** Follow `src/ui/deed_i18n.ts`
and `src/ui/reliquary_i18n.ts` exactly: `src/ui/card_i18n.ts` with
`CARD_LOCALE_LOADERS` and per-base-locale chunks under
`src/ui/card_i18n.locales/`. This pattern exists twice already; do not
invent a third shape.

Sim-emitted log lines keep using English literals re-localized by
`src/ui/sim_i18n.ts`, and `card_duel.ts`'s existing discipline (one
literal per `ctx.emit`, no `?? 'fallback'` inside a template, pinned by
the source-scanning arm of `tests/card_duel.test.ts`) applies unchanged to
every new emit.

## 5. Information model and anti-cheat

**Today's game is not cheatable this way, and nothing here is a live
bug.** `buildCardMinigameInfo` sends the viewer's own hand plus only
`deckCount` and `discardCount`, built per viewer in `server/game.ts` via
`cardMinigameInfoFor(anchorSession.pid)`. The opponent's hand, deck order,
and upcoming draws never reach the client. The revealed set below is a
**new requirement created by V2**, not a fix for an existing hole.

V2 adds `reveal` effects, so the client will legitimately know *some*
opponent information:

- Match state holds, per player, a `revealedToOpponent` set of instance
  ids. `buildCardMinigameInfo` serializes opponent card identities **only**
  for members of that set.
- There is no client-side hiding. An identity the viewer is not entitled
  to is never serialized, so no client tampering or packet inspection
  reveals it.
- Pin it with a test driving a full match including reveal effects,
  asserting each side's snapshot contains no opponent instance id outside
  the revealed set, including during the reveal phase.

**Deck legality is validated server-side at every match start, never on
save alone.** A stored deck legal when saved can become illegal as the
catalog changes. A deck that fails validation is replaced with the default
deck and the mismatch logged; the match still starts.

**All effects resolve inside the sim.** The client never computes an
effective value it then reports; it displays the one the snapshot carries.

**The CPU opponent consumes this same projection** (section 9.2), which is
what makes it provably unable to cheat: hidden information is absent from
its input, not merely ignored by its policy.

## 6. Deck construction and the hand

### 6.1 The constraint

A legal deck is **exactly 20 cards: exactly two of each value 1 through
10, and no two cards sharing a card id.** One copy of any unique card,
two cards per value.

This is the brief's histogram plus a singleton rule, and the singleton
rule is the important addition. It resolves the degenerate-deck problem
completely: an all-high-value deck is not merely discouraged, it is
unbuildable. No budget, cap, or tunable is needed, and the earlier concern
about the deck space collapsing to one optimal list does not apply.

The combination space is the point. With `k` cards authored at a given
value, that value's two slots admit `k * (k - 1) / 2` distinct pairs, and
a deck is the product across all ten values. At thirty cards per value
that is already on the order of `10^26` legal decks. Finding the optimal
deck is not a realistic goal for anyone; finding a fun and ridiculous one
is easy. Everyone is powerful, nobody is perfect.

Every deck totalling 110 base power is a **consequence** of the shape, not
a separate limit to enforce or tune. Validation checks the shape (twenty
cards, two per value, distinct ids); it never checks a sum.

Three properties follow, and each is worth a test arm:

- Power comes from selection, synergy, and timing, never from raw stats,
  so a new card cannot power-creep by being numerically bigger. It has to
  earn its slot against every other card of its value.
- Every deck faces the same value distribution, so card counting stays
  meaningful: both players always know the shape of what remains.
- A new set expands choice per slot without inflating anything.

### 6.2 The hand and the draw rule

Hand size is always 4. Each round: play one card, it goes to discard along
with its effects resolving, then **refill the hand back to 4**. When the
deck empties, the discard shuffles back in and drawing continues.

This replaces today's draw-one-per-round rule, and the difference matters
mechanically: a refill guarantees a full hand of choices every round even
when an effect discarded or drew extra cards, so no effect can quietly
starve a player of options.

Implementation notes that are easy to get wrong:

- The refill is a loop, not a single draw. It draws until the hand holds
  4 or the pool is exhausted.
- The reshuffle can happen **mid-refill**. If the deck runs dry on the
  second of three needed draws, the discard shuffles in and the refill
  continues in the same operation. Pin this case explicitly; it is the one
  a naive implementation gets wrong.
- The reshuffle is one rng draw site and must stay deterministic, which
  is why refill lives in `deck.ts` alongside shuffle.
- Because refill draws a variable number of cards, the parity golden's
  draw count is no longer a fixed multiple of the round count. That is
  fine, but it means the golden must be regenerated from a scenario that
  actually exercises a reshuffle.

Deck-out is therefore not reachable in normal play: the deck plus discard
is a closed twenty-card pool that recycles forever. The only way the pool
shrinks is a future `banishFromDiscard` style effect. One safety rule
covers that without a mechanic: if the pool cannot fill four, the player
plays with a smaller hand, and a player with an empty hand at comparison
time forfeits the round. Pin it, then forget about it.

### 6.3 Identifying a card to play (a required breaking change)

**The entire play path is keyed by card VALUE today, and the section 6.1
deck rule breaks it.** This is the one place V2 cannot be additive, so it
is called out rather than discovered in Phase 5.

A deck holds two cards of each value and they are **different cards**. A
hand of four can therefore hold two distinct value-3 cards with different
ids, art, and rules text. "Play a 3" stops being an unambiguous
instruction. Every layer currently assumes it is:

- `card_hand.ts` `playCard(state, value)` resolves the card with
  `state.hand.indexOf(value)`, which picks an arbitrary one of the two.
- `IWorldCardMinigame.playCardInDuel(cardValue: number)`.
- `ClientWorld` sends `{ cmd: 'play_card', value: cardValue }`.
- `server/game.ts` guards `msg.value` with `Number.isInteger`.
- The window's hand buttons carry `data-play="${card.value}"`.
- `CardMinigameInfo.match.hand` is a `number[]`.

All six move from a value to a **hand instance id**: a per-match,
per-instance handle, not the card id (a hand can legitimately hold the
same card id in two matches, and instance identity is what the
`revealedToOpponent` set in section 5 keys on anyway).

Consequences to plan for:

- `play_card` keeps its name and its dispatch arm, so the preservation
  ledger holds, but its payload field changes. The integer guard stays and
  gains a bounds check: an instance id is validated against the sender's
  own hand, which the sim already does by returning null for a card the
  hand does not hold. Keep that rejection path.
- `tests/command_schema.test.ts` pins the send and dispatch surface, so
  this is a deliberate pin update, not a loosening.
- `tests/world_api_parity.test.ts` pins `playCardInDuel`, so the signature
  change lands in both `Sim` and `ClientWorld` in the same commit.
- The engine's `chooseCard` (section 9.2) returns an instance id for the
  same reason.

Land this in Phase 5 with the rest of the rules change. Doing it earlier
means churning a signature twice; doing it later means shipping a game
where playing the wrong card is a coin flip.

## 7. The turn timer

**One clock governs everything: 45 seconds per round, for both sides,
covering thinking time and disconnects alike.**
`CARD_DUEL_ROUND_DEADLINE_S` moves from 90 to 45 and keeps its existing
per-round refresh on every round resolution.

This deliberately collapses what would otherwise be two separate systems.
There is no separate linkdead grace for a card duel: a dropped player has
until their round clock expires, exactly like a player who is present but
idle. Simpler to reason about, simpler to explain in the tooltip, and one
constant to tune.

Because selection is simultaneous, "your turn" means the round window, and
the clock applies to both sides at once.

### 7.1 Outcome table

| Situation | Result | Deed credit |
|---|---|---|
| A side reaches `CARD_DUEL_ROUNDS_TO_WIN` | win / loss | winner |
| One side's clock expires, the other played | expiring side forfeits | other side |
| Both clocks expire, at least one card played this match | **draw** | neither |
| Both clocks expire, no card played all match | unrecorded | neither |
| Manual forfeit after a round has been won | forfeiter loses | other side |
| Manual forfeit before any round is won | unrecorded (existing anti-farm) | neither |

Two discriminators, deliberately different, and conflating them is the
likely bug:

- The **draw versus unrecorded** split turns on whether **any card was
  played** in the match. A match with three pushes had cards played, so
  it is a draw.
- The existing **manual-forfeit void** split turns on whether **any round
  was won** (`roundsA + roundsB === 0` today). That guard exists because
  crediting a win for a match where nothing was decided is farmable by two
  accounts. It stays as-is.

Draw is a new outcome. Today the code has win, loss, and void; a draw is
recorded and visible to both players but credits nobody. That needs a new
`cardDuelMatchEnd` payload arm, which is an additive field change, not a
rename of the existing `won` boolean.

### 7.2 What this implies for disconnects

Making the timer the disconnect handler is a real behavior change, because
`Sim.removePlayer` currently calls `leaveCardMinigameEntirely`, which
forfeits the live match immediately. For the clock to actually govern, the
match has to hold the seat until the clock expires.

Two pieces of work follow, both worth naming up front:

- The match must be keyed to something stable across a reconnect rather
  than only the live entity pid, or the resume path must restore the pid.
  `server/linkdead.ts` `planJoin` already has a resume arm; that is the
  hook to use rather than a new mechanism.
- The offline `Sim` and headless env must still not leak `cardDuels`
  entries for a departed pid. Keep the `removePlayer` teardown, but let it
  mark the seat vacant rather than resolve the match, and let
  `updateCardDuelDeadlines` resolve it when the clock runs out.

Worth flagging for playtest: 45 seconds is now doing double duty as think
time and as reconnect grace. A slow mobile reconnect can exceed it. If
that turns out to bite, the honest fix is a separate (longer) reconnect
window rather than inflating think time, but start with the single clock
as specified and let the data say.

45 seconds is also a fresh number for a game that now has rules text to
read. `CARD_DUEL_ROUNDS_TO_WIN` is in the same position: best of three was
sized for a game with no decisions in it, and with tribes, counters, and
history-scaling effects a deck may need five rounds to express itself.
Both are exported constants with pinned tests, so both are one-line
changes from playtest feedback.

## 8. Card availability

Every card is available to every player. No ownership gate, no unlock, no
acquisition path in this update. The persistence field is still added now,
so a later collection era is a data change rather than a schema migration:

```
state.cards = {
  decks: Record<string, string[]>,
  activeDeck: string,
}
```

Absent means a fresh character: grant the default deck. Deck slots are
capped so the blob cannot grow without bound. Adding a field to the
character JSONB blob is back-compatible and every existing save loads
unchanged, which matters because this repo has no migration files and
re-applies inline DDL at boot.

Deliberately **not** added yet: an `owned` list. Adding it later is
additive, and absent will mean "all cards", so no migration then either.

## 9. The standalone slice and the CPU opponent

### 9.1 The standalone slice (a new Vite entry)

The repo already ships five SPA entries beside the game (`admin.html`,
`play.html`, `guide.html`, `editor.html`, `wallet-handoff.html`), so a
sixth is repo-native rather than a new pattern. Add `cards.html` plus
`src/cards/`.

The rule that makes this valuable instead of a liability: **it composes the
real engine, never a copy.** `src/editor/` is the exemplar, composing the
real `Sim` and `Renderer` in its viewport. `src/cards/` imports
`src/sim/minigames/card_duel/` and the real card face components directly.
A drifted test harness is worse than none, and shared code is the only
guarantee against drift.

What it gives you: instant load with no world, login, or server; hot-seat
two-sided play; a seed box for reproducing an exact shuffle; a deck
editor; a step-through of the resolution pipeline showing each effect's
contribution to the effective value; and a scriptable match runner for
sweeps. That last one is what makes a large catalog tractable at all.

It ships to the live site like the other entries, so playtesters get a URL.

### 9.2 The CPU opponent

A first-class feature, not just a test convenience: a player can sit down
against a computer opponent online or offline, at a chosen difficulty.
This is what makes the minigame playable at all in a single-player world,
on an empty realm, and at 3am, and it is what lets a new player learn the
catalog without being farmed by someone who already knows it.

#### The policy seam

`card_duel/bot.ts` exposes one pure function:

```ts
chooseCard(view: CardMinigameInfo, rng: { next(): number }): HandInstanceId
```

That signature carries the whole design. Three properties follow from it:

- **The bot sees exactly what a human client sees.** Its input is the same
  per-viewer projection from section 5, not the match object. It cannot
  peek at the opponent's hand because the information is not in its input,
  the same way it is not in the network frame. That makes the bot provably
  fair by construction rather than by discipline.
- **It doubles as a completeness test for the projection.** If the bot can
  play a competent game from the projection alone, the projection contains
  everything a player needs. If a policy wants a fact the projection lacks,
  that is a signal the human UI is missing it too.
- **It is a pure function, so every difficulty is directly unit-testable**
  with a hand-built view object and a seeded rng. No `Sim`, no match, no
  server.

Difficulty is just which policy runs. Adding a fifth later is a new
function and a catalog row, never an engine change.

#### The difficulty ladder

| Tier | Policy | Roughly |
|---|---|---|
| Novice | uniform random from hand | teaches nothing, loses to anything, good for a first sit-down |
| Steady | value heuristics: commit high when the round matters, dump low when the match is already decided, avoid wasting a 10 on a round it does not need | a plausible casual human |
| Sharp | Steady plus public state: current score, revealed cards, counters on both sides, and whether its own card's effect condition currently holds | punishes sloppy play |
| Master | Sharp plus card counting | genuinely hard |

Master is the tier worth noting, because your deck rule makes it nearly
free. Every legal deck holds exactly two of each value, so after tracking
what the opponent has played, the bot knows the exact multiset of values
still available to them. That is not an approximation or a heuristic, it
is arithmetic. A dozen lines of counting produce an opponent that reads
the board better than most humans will, without any search, evaluation
function, or tuning pass.

Build Novice first and ship it; it is a handful of lines and it unblocks
everything else. The other three are additive and can land one at a time.

#### Commit timing

The bot must not commit the instant the round opens. Simultaneous hidden
selection is the game's identity, and an opponent who locks in with zero
delay both breaks the feel and quietly signals "this is a bot".

Commit after a delay drawn from `ctx.rng` and counted in ticks, never wall
clock, so the offline Sim, the server, and the headless env agree. Scale
the delay band by tier if it is free to do so (Novice snaps, Master
deliberates), which is cheap characterisation. The delay always fits
inside the 45 second round window, so a bot can never time itself out.

#### World building: named regulars

Each opponent is a content record and zero engine code, which is what
makes this good value for world building:

```ts
// src/sim/content/cards/opponents.ts
{
  id: 'dockhand_pell',
  nameId: ..., titleId: ...,   // "Pell", "Dockhand"
  difficulty: 'steady',
  deck: [...],                 // a themed, legal 20-card list
  greetingId: ...,             // one line when the match starts
}
```

The Card Master's regulars: a dockhand who runs Mudfin, a gravedigger who
runs Undead recursion, a huntsman on Beasts, and the Card Master himself
as the Master-tier wall at the top. Two things fall out of that for free:

- **Each regular is a playable showcase of one archetype**, so a new
  player learns what a Beast deck or an Undead deck actually does by
  facing one, rather than by reading a wiki page. That is onboarding and
  world building doing the same job.
- **The deck lists are content, so they are also a balance instrument.**
  A themed NPC deck is a curated example of "here is a deck that works",
  which seeds the meta at launch instead of leaving it blank.

#### Entry path: a direct match, not the queue

The bot does **not** join the matchmaking FIFO. Picking a regular from the
Card Master's gossip menu starts a match directly. This is simpler than
queueing a bot and it dissolves a problem the earlier draft had: no change
to `cardMinigameAvailable`, no inversion of the Fiesta and Vale Cup bot
exclusions, and no risk of the offline world hanging at "Waiting for an
opponent". The queue stays exactly what it is today, a human-versus-human
path, untouched.

It still runs the shipping code: the direct path calls the same
`startCardDuelMatch`, and rounds resolve through the same `resolve.ts`.
Only the pairing step is bypassed.

Keep the availability gate on the **queue** only, so a single-player world
can browse, build decks, and play regulars regardless.

#### The one integration decision

A bot seat needs an identity that `startCardDuelMatch`, the round
resolution, and the snapshot can all address, but it must not be a real
player. Do not fabricate a `ctx.players` entry or spawn a world entity for
it: that leaks a fake player into interest scoping, the roster, and
`removePlayer` teardown for no benefit.

Recommended: a reserved pid range for bot seats, absent from `ctx.players`
and `ctx.entities`, with the opponent name resolved from the catalog at
snapshot build time. `card_duel.ts` already tolerates a missing opponent
meta, which is exactly why its start, win, and loss messages each carry a
distinct no-opponent-meta literal arm. Those arms stop being an edge case
and become the bot's normal path, so extend them to resolve a bot name
rather than leaving them as bare fallbacks.

The AFK sweep needs no special case: the bot always commits inside the
window, so only the human side can ever expire, and that resolves as a
normal forfeit.

#### Bot matches must not credit PvP progress

This is the anti-farm arm, and skipping it would undo a guard the existing
code was careful about. `pvp_card_duel_first_win` is a `pvp` category deed
reading `cardDuelsWon`. If beating a Novice bot bumped that stat, the deed
becomes a thirty-second formality and the category is a lie.

**Bot matches credit no `cardDuelsWon` and no PvP deed progress.** Pin it
with a test that plays a bot match to completion and asserts the stat is
unchanged, sitting alongside the existing arm that asserts a real match
bumps it exactly once.

If bot-specific rewards are wanted later, they take their own stat (a
`cardDuelsBotWon` counter) and their own deeds, so the PvP line stays
clean. That is additive and needs deciding only when someone wants it.

## 10. Visual upgrade

### 10.1 One face component, three sizes

- `src/ui/cards/card_face_view.ts` (pure, DOM-free): maps a card instance
  plus match context to a `CardFaceModel`: art id, base value, effective
  value, the signed delta and its contributing sources, name and text key
  ids with resolved placeholder values, tribes, rarity, and display states
  (playable, locked, revealed, silenced, counter stacks).
- `src/ui/cards/card_face_painter.ts` (thin): paints that model on the
  `PainterHost` seam with write elision, no forced-reflow layout read, and
  a repaint signature over the data digest.
- Three CSS size variants only (hand, reveal stage, collection cell). Same
  markup, same painter.

Register the view core in `UI_PURE_CORES` in `tests/architecture.test.ts`.

### 10.2 Face anatomy

Art panel, value corner plate, name plate, tribe line, rules text block,
rarity frame, and a modifier strip showing the live delta. Rarity frames
reuse existing quality color tokens rather than introducing new color
literals; `src/styles/CLAUDE.md` owns that rule.

### 10.3 Animations: full by default, degraded only at the floor

The fairness invariant permits the full presentation. The rule is not "no
animation", it is that a preset may shed **cosmetic richness** but never
**actionable information**. Animations are cosmetic. So:

- **Default and above:** the full presentation. Deal, flip, reveal stage,
  art parallax, rarity shimmer, impact on a round win, counter-stack pops.
- **Lowest preset and reduced-motion:** transitions collapse to instant
  state changes. Same information, same layout, no motion.
- **Never tiered, at any preset, on any device, with no hover requirement
  and no animation delay:** effective value, base value, the signed
  modifier delta and what produced it, rules text, counter stacks on
  either side, revealed opponent cards, round score, the round clock, and
  whose commit is outstanding.

The single rule keeping this honest: **information is never gated on an
animation completing.** Numbers are correct and readable the instant the
snapshot arrives; the animation plays over already-true state. A player on
the lowest settings sees the same facts at the same moment as one on
ultra, just without motion. With a 45 second clock this is not academic:
an animation that delayed information would be eating a real fraction of
the decision window.

Tier knobs read the static preset through `src/game/ui_effects_profile.ts`,
never the FPS governor. Add a fairness test arm alongside the existing
ones.

### 10.4 Browser performance

The window is cold and event-driven, not per-frame, so the budget is about
the animation frames only:

- Animate `transform` and `opacity` only. No animated width, height, top,
  left, or box-shadow, all of which force layout or paint per frame.
- Card art is WebP in an `<img>`, GPU-composited. No per-card canvas: a
  hand of four cards each running its own canvas is the fast path to
  stutter on a low-end phone.
- Promote only the cards actually animating and drop the promotion when
  the animation ends, so a full hand does not sit permanently on
  compositor layers.
- The reveal stage is at most two moving cards, the cheapest possible
  framing for the most important moment.
- Respect `prefers-reduced-motion` as an input independent from the
  graphics preset. Either alone collapses motion.

### 10.5 The reveal moment, and the trap in it

The window returns early on an unchanged repaint signature, so a staged
reveal driven from the snapshot gets stomped by the next `render()`.
Worse, staging the snapshot would delay information, which 10.3 forbids.

Drive the reveal from the `cardRoundResolved` SimEvent instead. It already
carries `mine`, `theirs`, `outcome`, and `reshuffled`. The snapshot-driven
window keeps painting the truth underneath, unchanged. This costs nothing
architecturally and keeps the existing `hud_update_drive` and
`hud_perf_budget` pins meaningful.

The round clock is actionable information, so it is rendered at every
tier. Drive it from the snapshot deadline, never from a client-side timer
that could drift out of agreement with the server.

Audio needs no new recordings for the core loop: `ui_card_play`,
`ui_card_reveal`, `ui_card_round_push`, and `ui_card_shuffle` already
exist. Do not open the SFX budget in the same change.

### 10.6 Deck builder window

Its own module the HUD composes, never a section appended to
`src/ui/hud.ts`. The Book of Deeds and Reliquary windows are the family to
copy: cold, event-driven off a refresh signature, DOM-free view model,
lazy locale chunks. Reuse that family rather than building bespoke.

The builder's core job is making the section 6.1 shape legible: ten value
rows, two slots each, and a filtered pool per row showing only cards of
that value with the ones already in the deck marked as taken. The
constraint becomes self-explanatory through the layout instead of through
an error message.

## 11. Phasing

Each phase is independently green, mergeable, and shippable.

**Phase 1: relocation, zero behavior change.** Create
`src/sim/minigames/card_duel/` and `src/sim/minigames/CLAUDE.md`, move
`card_hand.ts` to `card_duel/deck.ts` as a move-not-rewrite, generalize
`number` to `CardInstance` where the instance still only holds a value.
Author `types.ts`. `card_duel.ts` behavior is byte-identical, so the
parity golden does not move. Entirely mechanical.

**Phase 2: the evaluators.** `expressions`, `conditions`, `selectors`,
`modifiers`, `effects`, `resolve`, each with its own test file, plus the
commutativity property test and the resolution ceiling test. The engine is
complete and fully tested but no card has an effect yet, so the live game
is unchanged.

**Phase 3: the standalone slice and the Novice bot.** `cards.html` plus
`src/cards/`, composing the Phase 2 engine, and `card_duel/bot.ts` with
the Novice policy. Deliberately early and deliberately paired: the slice
is the tool that makes Phases 4 and 5 fast, and a bot that plays random
legal cards is what makes the slice self-playing, which turns it into a
soak test for the engine rather than a hot-seat toy. Both ship with zero
risk to the live game.

**Phase 4: catalog, art, and text.** `src/sim/content/cards/`, the launch
set, `public/ui/cards/` art with its conversion script and
`CARD_IMAGE_IDS` gate, the `cards` i18n namespace, `card_i18n.ts` lazy
chunks, and the placeholder-matching catalog test.

**Phase 5: rules change and wire-in.** `card_duel.ts` deals real
`CardInstance`s and calls `resolve.ts`. Deck shape validation (6.1), the
refill-to-4 rule (6.2), the 45 second clock and the draw outcome (7), and
the per-viewer revealed set (5) all land here. This is the phase that
moves `tests/parity/golden/card_duel.json`, so regenerate the golden from
a scenario that exercises a mid-refill reshuffle, and expect
`tests/parity/rename_state_proof.test.ts` to have an opinion.

**Phase 6: visuals.** Card face core and painter, rebuilt duel window,
reveal overlay, the round clock, animation tiers, mobile layout, fairness
arms.

**Phase 7: deck builder and the regulars.** The in-game deck builder
window, deck persistence, the direct-match entry path off the Card
Master's gossip menu, the named opponent records, and the Steady, Sharp,
and Master policies. The three higher tiers are independent of each other
and can land one per PR if that reads better in review.

## 12. Open questions

**Does the RL env expose ClaudeStone?** It does not today. Not a blocker,
but the engine being pure makes it a cheap candidate, and deciding now
avoids a retrofit.

**Do cards carry deed and Reliquary obligations?** New conquerable content
takes Book of Deeds records and new conquerable unique loot takes
Reliquary pages. A card catalog plausibly triggers the first. The
`content-obligations-reviewer` agent audits exactly this, so decide
deliberately rather than at review.

**Deferred: balance telemetry.** Not in this update. Card performance data
comes from community reports during the open playtest. If it is added
later, the shape that fits the existing seams is an append-only observer
at match end (the `server/bank_ledger.ts` pattern: diff around a dispatch,
fire-and-forget FIFO write, audited offline by a script), registered with
`server/retention_sweep.ts` since it would grow without bound.

## 13. Obligation checklist

- `tests/parity/golden/card_duel.json` regenerated at Phase 5, from a
  scenario exercising a mid-refill reshuffle.
- `tests/world_api_parity.test.ts`: pinned member list, every new facet
  member implemented in **both** `Sim` and `ClientWorld`.
- `tests/command_schema.test.ts`: any new command is a send plus dispatch
  pair, appended never loosened. `play_card`'s payload pin changes with
  the instance-id re-key (section 6.3); update it deliberately.
- `tests/card_duel_view.test.ts` and `tests/card_duel_audio_events.test.ts`
  both assert against plain card values and need the instance-id re-key
  too.
- `tests/architecture.test.ts`: new UI pure cores registered; sim purity
  and no-wall-clock arms already cover the new sim directory.
- `tests/monolith_budget.test.ts`: `card_duel.ts` must not grow.
- `tests/hud_update_drive.test.ts` and `tests/hud_perf_budget.test.ts`:
  rows for the rebuilt window and the new deck builder.
- `tests/card_duel.test.ts`: the deadline arms are written against 90
  seconds and the both-idle arm asserts a void; both need updating for the
  45 second clock and the new draw outcome. Add the bot anti-farm arm
  (a completed bot match leaves `cardDuelsWon` unchanged) next to the
  existing arm that asserts a real match bumps it exactly once.
- Opponent records are game content: each named regular needs its
  `nameId`, `titleId`, and `greetingId` in the catalog, a legal deck list
  validated by the same section 6.1 shape check players are held to, and
  non-Latin name fills where the English is wordy (M16). The
  `content-obligations-reviewer` agent audits this set.
- The bot policies are pure functions, so each difficulty tier gets direct
  unit tests against hand-built view objects and a seeded rng, plus one
  determinism arm asserting the same view and seed always yield the same
  card.
- `vite.config.ts`: the `cards` entry added to the input list.
- i18n: English-only into `src/ui/i18n.catalog/cards.ts`; the S3 guard
  (`tests/localization_fixes.test.ts`) covers new sim-emitted player text,
  including the new draw message; wordy new English names need non-Latin
  fills in the same change (M16).
- Wiki regen (`npm run wiki:content`), freshness-gated by
  `tests/guide.test.ts`. The guide's `cardMasterBody` states the ninety
  second clock, the draw-one rule, and best of three explicitly, so it
  becomes wrong the moment Phase 5 lands. Update it in the same change.
- New art: `CARD_IMAGE_IDS` exact-set-equality gate, both directions.
- Screenshots: desktop and mobile, before and after, under
  `docs/screenshots`, referenced from the PR body (`pr-screenshots` skill).
- Reviewers: `architecture-reviewer`, `content-obligations-reviewer`,
  `frontend-seam-reviewer`, `privacy-security-review`,
  `server-hot-path-reviewer`, `migration-safety`, `cross-platform-sync`,
  `test-coverage-auditor`.
