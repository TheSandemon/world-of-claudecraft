# World of ClaudeCraft: ClaudeStone Rules Language

## Purpose

This document defines a flexible **card rules language** for an expanded World of ClaudeCraft ClaudeStone system.

The goal is to make cards primarily **data-driven** rather than implemented with bespoke game logic.

A custom card should usually be expressible as:

> **WHEN** a trigger occurs  
> **IF** some conditions are true  
> **TARGET** one or more game objects  
> **DO** an effect  
> **FOR** a defined duration

The engine should provide a small, stable set of primitives that can be combined to create a very large variety of cards.

Before adding any new engine mechanic, ask:

> Can this card be expressed using some combination of **trigger + condition + selector + effect + duration + counter/history**?

If yes, it should be card content rather than custom engine code.

---

# 1. Core ClaudeStone Rules

The existing ClaudeStone identity should remain recognizable.

## Deck Construction

A legal deck contains exactly **20 cards**:

- Two value-1 cards
- Two value-2 cards
- Two value-3 cards
- Two value-4 cards
- Two value-5 cards
- Two value-6 cards
- Two value-7 cards
- Two value-8 cards
- Two value-9 cards
- Two value-10 cards

Every deck therefore has the same total base power:

`2 × (1 + 2 + 3 + ... + 10) = 110`

Players do not gain strength by replacing low cards with high cards.

They gain strength through:

- Card selection
- Tribes
- Synergies
- Effects
- Counters
- Information
- Timing
- Matchup knowledge

This keeps the original 1 to 10 identity while allowing meaningful deckbuilding.

## Basic Match Loop

1. Players enter the match with their chosen 20-card decks.
2. Decks are shuffled.
3. Each player draws a starting hand.
4. Both players secretly select one card.
5. Selected cards lock.
6. Both cards reveal simultaneously.
7. Card effects resolve.
8. Effective values are compared.
9. Higher effective value wins the round.
10. Played cards enter discard.
11. Players draw replacements.
12. The next round begins.
13. The match ends when the configured win condition is reached.

---

# 2. Card Identity

Every collectible card has a stable definition.

```ts
interface CardDefinition {
  id: string
  name: string

  value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

  tribes: string[]
  tags: string[]

  rarity: CardRarity

  effects: CardEffect[]
}
```

## Value

`value` is the card's immutable base power from 1 to 10.

Examples:

- Forest Wolf, 3
- Old Greyjaw, 8
- Grix the Tunnelking, 10

The value determines which deck slots the card may occupy.

A value-3 card competes only with other value-3 cards for the player's two value-3 slots.

## Tribes

Tribes are major mechanical affiliations.

Examples:

- Beast
- Human
- Undead
- Demon
- Spider
- Mudfin
- Burrower
- Construct
- Elemental
- Spirit
- Dragon
- Bandit

Cards may have multiple tribes.

Tribe relationships should **not** normally be hard-coded into the engine.

Instead, cards create relationships between tribes.

Example:

**Stablemaster, Human 4**

> Your next Beast gets +2.

**Necromancer, Human 5**

> Your next Undead gets +2.

Both are Human cards, but support completely different archetypes.

## Tags

Tags are finer-grained descriptors.

Example:

```text
Forest Wolf

Tribes:
- Beast

Tags:
- Wolf
- Eastbrook
- Nature
```

Tags allow future cards to reference narrower concepts without creating a new primary tribe.

Possible tags include:

- Wolf
- Boss
- RareMob
- Eastbrook
- Mirefen
- Quest
- Nature
- Fire
- CardMaster
- Profession
- Dungeon

---

# 3. Card Power Philosophy

The value 1 to 10 should remain meaningful.

Lower-value cards should often gain stronger utility effects.

A useful design philosophy:

| Value | Typical Role |
|---|---|
| 1 to 2 | Setup, sacrifice, scouting, disruption |
| 3 to 4 | Synergy engines |
| 5 to 6 | Balanced tactical cards |
| 7 to 8 | Strong cards with restrained effects |
| 9 | Very strong, often with drawbacks |
| 10 | Maximum raw power, minimal effect or meaningful drawback |

A value-1 or value-2 card should sometimes be something a player **wants** to play despite expecting to lose the round.

Example:

**Grave Candle, 2 / Spirit**

> If this loses, your next Undead gets +3.

The value-2 card becomes strategically valuable because its loss creates future advantage.

---

# 4. Match State

The rules engine should expose a structured match state that card effects can inspect.

## Player State

```ts
interface PlayerCardState {
  deck: CardInstance[]
  hand: CardInstance[]
  discard: CardInstance[]

  playedThisRound?: CardInstance
  previousCard?: CardInstance

  roundWins: number
  roundLosses: number

  consecutiveWins: number
  consecutiveLosses: number

  temporaryModifiers: Modifier[]

  counters: Record<string, number>

  history: CardHistory
}
```

## Current Round State

Useful variables include:

```text
myCard
opponentCard

myBaseValue
opponentBaseValue

myEffectiveValue
opponentEffectiveValue

roundNumber
roundWinner
```

## Match History

The engine should retain queryable history such as:

```text
previousCard
previousOpponentCard
previousRoundResult

cardsPlayed[]
tribesPlayed[]
valuesPlayed[]

wins
losses

consecutiveWins
consecutiveLosses
```

This history is one of the most powerful extensibility tools in the system.

---

# 5. Base Value vs Effective Value

Every card has at least two relevant values.

```text
baseValue
effectiveValue
```

Example:

```text
Forest Wolf
baseValue: 3

Pack bonus: +1
Venom penalty: -2

effectiveValue: 2
```

Cards should be able to explicitly reference either value.

Examples:

> Copy the opponent's **base value**.

and

> Copy the opponent's **current effective value**.

These are different mechanics and should remain distinct.

---

# 6. Effect Grammar

Every card effect should follow a common structure.

```ts
interface CardEffect {
  trigger: Trigger

  conditions?: ConditionTree

  target?: TargetSelector

  effect: EffectDefinition

  duration?: Duration

  priority?: number

  stackMode?: StackMode

  limits?: EffectLimits
}
```

Conceptually:

```text
WHEN trigger
IF conditions
TARGET selector
DO effect
FOR duration
```

Example:

**Forest Wolf, 3 / Beast**

> When revealed, if your previous card was a Beast, this gets +1 this round.

```ts
{
  trigger: "onReveal",

  conditions: {
    type: "previousCardHasTribe",
    owner: "self",
    tribe: "Beast"
  },

  target: {
    type: "thisCard"
  },

  effect: {
    type: "modifyValue",
    amount: 1
  },

  duration: "round"
}
```

---

# 7. Triggers

Triggers define **when** an effect checks or activates.

The initial engine should keep this list deliberately finite.

## Card Lifecycle

```text
onDraw
onPlay
onReveal
beforeCompare
afterCompare
onWin
onLose
onTie
onDiscard
```

## Round Lifecycle

```text
onRoundStart
onRoundEnd
```

## Match Lifecycle

```text
onMatchStart
onMatchEnd
```

## Other-Card Events

Potential supported triggers:

```text
whenOpponentReveals
whenAllyCardWins
whenAllyCardLoses
whenTribePlayed
whenValuePlayed
```

New triggers should only be added when a desired mechanic cannot be expressed cleanly using existing primitives.

---

# 8. Conditions

Conditions determine whether an effect may resolve.

## Card Identity Conditions

```text
card has tribe X
card does not have tribe X

card has tag X
card does not have tag X

card value == X
card value > X
card value >= X
card value < X
card value <= X
```

## Previous Play Conditions

```text
previous card had tribe X
previous card had tag X

previous card value == X
previous card value >= X

previous card won
previous card lost
previous card tied
```

## Opponent Conditions

```text
opponent card has tribe X
opponent card has tag X

opponent card value >= X
opponent card value <= X

opponent previous card had tribe X
opponent previous card won
opponent previous card lost
```

## Match Conditions

```text
you are winning
you are losing
score is tied

round number == X
round number >= X

you have won X consecutive rounds
you have lost X consecutive rounds
```

## Collection / History Conditions

```text
played X cards of tribe Y
played X cards with tag Y

played X unique tribes

played no card of tribe Y

discard contains tribe Y
hand contains tribe Y

played both copies of value X
```

## Condition Composition

Conditions should compose using:

```text
ALL
ANY
NOT
```

Example:

> +2 if you are losing AND the opponent played a Beast.

```ts
ALL(
  self.score < opponent.score,
  opponent.currentCard.hasTribe("Beast")
)
```

Composition greatly increases expressiveness without requiring new mechanics.

---

# 9. Targets and Selectors

Effects should use a common target system.

## Direct Card Targets

```text
this card

your current card
opponent current card

your next card
opponent next card
```

## Conditional Future Targets

```text
your next card of tribe X
opponent next card of tribe X

your next card with tag X
opponent next card with tag X

your next value-X card
```

## Zone Targets

```text
your hand
opponent hand

your deck
opponent deck

your discard
opponent discard
```

## Selectors

Collections should support selectors such as:

```text
first matching
random matching
all matching
highest-value matching
lowest-value matching
```

Examples:

> Give the lowest-value Beast in your hand +1 until played.

> Reveal one random card in the opponent's hand.

> Return the highest-value Undead in your discard to your hand.

---

# 10. Effect Families

The initial engine should support a controlled set of generic effect primitives.

---

## 10.1 Value Manipulation

```text
modifyValue
setValue
copyValue
swapValues
minimumValue
maximumValue
```

Examples:

> This gets +2.

> Set the opponent's value to 5.

> This card becomes the opponent's base value.

> Swap both current card values.

> This card cannot be reduced below 3.

> This card cannot exceed 8.

---

## 10.2 Information

```text
revealCard
revealRandomCard
revealHand
revealTopDeck
inspectDiscard
```

Example:

**Mudfin Scout, 1**

> If this loses, reveal two random cards in the opponent's hand.

Information effects are particularly useful for making low-value cards strategically relevant.

---

## 10.3 Hand Manipulation

```text
draw
discard
returnToHand
replaceCard
swapHandCard
```

Examples:

> Draw 2, then discard 1.

> Return this card to your hand instead of discarding it.

> Opponent discards one random card.

---

## 10.4 Deck Manipulation

```text
shuffle
putOnTop
putOnBottom
searchDeck
drawMatching
```

Examples:

> Put one Beast from your discard on top of your deck.

> Draw the next Undead card.

Search and deterministic draw effects should be balanced carefully because consistency is powerful.

---

## 10.5 Discard Manipulation

```text
returnFromDiscard
shuffleDiscardIntoDeck
banishFromDiscard
copyDiscardedCard
```

This enables recursion-heavy archetypes such as Undead decks.

Examples:

> Return one value-2-or-lower Undead from discard to your hand.

> Shuffle all Beast cards in your discard into your deck.

---

## 10.6 Tribe Manipulation

```text
addTribe
removeTribe
replaceTribe
copyTribes
```

Examples:

> This counts as Beast this round.

> Opponent loses the Human tribe this round.

> Copy the tribes of your previous card.

---

## 10.7 Effect Manipulation

More advanced primitives:

```text
silence
preventTrigger
copyEffect
repeatEffect
redirectEffect
```

Example:

**Nullstone, 4 / Construct**

> The opponent card has no ability this round.

This is represented as a generic `silence` effect rather than bespoke Nullstone logic.

These effects should be introduced conservatively because they create complicated interactions.

---

## 10.8 Outcome Manipulation

Use sparingly:

```text
forceTie
winTies
loseTies
reverseComparison
```

Examples:

> If the values tie, you win instead.

> Lower value wins this comparison.

These should remain rare because they modify the most fundamental rule of ClaudeStone.

---

## 10.9 Counter Manipulation

Generic named counters provide major extensibility.

```text
addCounter
removeCounter
setCounter
readCounter
```

Examples:

### Pack

> Whenever you play a Beast, gain 1 Pack.

Another card:

> +1 for every 2 Pack.

### Venom

> Give the opponent 1 Venom.

Another card:

> +1 for each Venom on the opponent.

Counters allow entire future archetypes to be created without requiring new fields in the match engine.

---

# 11. Numeric Expressions

Effect amounts should not be limited to fixed constants.

Support a small expression system.

Possible primitives:

```text
constant
count
difference
min
max
multiply
divide
floor
ceil
```

Example:

**Pack Alpha, 6 / Beast**

> +1 for every two Beasts you have played this match.

Conceptually:

```ts
amount = floor(
  history.count({
    owner: "self",
    tribe: "Beast"
  }) / 2
)
```

This allows scaling effects without bespoke implementation.

---

# 12. History Queries

The engine should expose generic history queries.

Conceptually:

```ts
history.count({
  owner: "self",
  tribe: "Beast",
  result: "win"
})
```

Possible filters include:

```text
owner
tribe
tag
value
result
round range
```

This enables cards such as:

> +1 for every Beast you played.

> +2 if you played at least three unique tribes.

> +3 if every card you played so far had a different tribe.

> If both of your value-1 cards have already lost, this gets +4.

Generic history queries dramatically expand card design without expanding the core engine.

---

# 13. Duration

Every modifier should explicitly define how long it exists.

Suggested durations:

```text
instant

thisComparison
thisRound

nextRound

untilTriggered
untilThisCardLeavesPlay

untilMatchEnd
permanentForMatch
```

Examples:

> Opponent gets -2 **this round**.

> Your **next Beast** gets +3.

> Your Humans get +1 **for the remainder of the match**.

Explicit duration prevents hidden state and makes card interactions easier to understand and debug.

---

# 14. Stacking

Modifiers require explicit stacking behavior.

Suggested stack modes:

```text
stack
replace
highest
lowest
unique
```

## Stack

All matching effects apply.

```text
+1 Beast
+1 Beast
= +2 Beast
```

## Replace

The newer effect replaces the existing effect.

## Highest

Only the strongest matching effect applies.

## Lowest

Only the weakest matching effect applies.

## Unique

Only one copy of this effect may exist at a time.

Example:

> Your next Beast gets +3.

If marked `unique`, triggering it three times does not create +9.

Stack behavior is an important balance variable and should be defined per effect.

---

# 15. Effect Limits

Triggered effects should support optional limits.

```ts
interface EffectLimits {
  oncePerRound?: boolean
  oncePerMatch?: boolean
  maxTriggers?: number
  cooldownRounds?: number
}
```

Examples:

> The first time one of your Beasts loses each match, draw a card.

> Once per round, when you play a Spider, gain 1 Web.

> This may trigger at most twice per match.

Limits prevent accidental infinite loops and runaway interactions.

---

# 16. Costs and Drawbacks

ClaudeStone does not necessarily need mana or another resource system.

The 1 to 10 deck structure already creates a natural cost system.

A powerful effect on a value-1 card often costs the player the round.

High-value cards can instead carry drawbacks.

Generic drawback examples:

```text
discardSelf
discardRandom
reduceNextCard
revealHand
opponentDraw
removeCounter
```

Examples:

**High-value 9**

> When revealed, reveal your entire hand.

**Value-10**

> If this wins, your next card gets -3.

This allows high-value cards to remain distinct without making them universally superior.

---

# 17. Resolution Order

Because both cards reveal simultaneously, resolution must be deterministic and transparent.

Recommended pipeline:

```text
1. Both players choose
2. Cards lock
3. Both cards reveal
4. onReveal effects resolve
5. beforeCompare effects resolve
6. Effective values are calculated
7. Win / loss / tie is determined
8. onWin / onLose / onTie effects resolve
9. afterCompare effects resolve
10. Played cards move to discard
11. Replacement cards are drawn
12. onRoundEnd effects resolve
13. Next round begins
```

The engine should clearly define whether `onDiscard`, `onDraw`, and similar zone-transition triggers occur within these steps.

---

# 18. Priority

Effects in the same phase may require a deterministic priority.

Example:

```ts
priority: 0
```

The engine should establish one convention such as:

> Lower priority number resolves first.

or

> Higher priority number resolves first.

The exact convention matters less than making it explicit and testable.

Whenever possible, symmetrical effects should resolve symmetrically rather than relying on arbitrary Player A / Player B implementation order.

Competitive outcomes should never depend on hidden iteration order.

---

# 19. Example Cards

These examples demonstrate how diverse cards can be created using only generic primitives.

---

## Mudfin Scout

**Value:** 1  
**Tribe:** Mudfin

> If this loses, reveal two random cards in the opponent's hand.

```text
trigger: onLose
target: opponent.hand.random(2)
effect: reveal
```

---

## Grave Candle

**Value:** 2  
**Tribe:** Spirit

> If this loses, your next Undead gets +3.

```text
trigger: onLose
target: self.nextCard(trait = Undead)
effect: modifyValue(+3)
duration: untilTriggered
```

---

## Forest Wolf

**Value:** 3  
**Tribe:** Beast

> +1 if your previous card was a Beast.

```text
trigger: beforeCompare
condition: previousCard.hasTribe(Beast)
target: thisCard
effect: modifyValue(+1)
duration: thisComparison
```

---

## Sableweb Hexer

**Value:** 4  
**Tribe:** Spider

> If the opponent is Human, they get -2.

```text
trigger: beforeCompare
condition: opponentCard.hasTribe(Human)
target: opponentCard
effect: modifyValue(-2)
duration: thisComparison
```

---

## Doppelganger

**Value:** 5  
**Tribe:** Spirit

> This card's value becomes the opponent's base value.

```text
trigger: beforeCompare
target: thisCard
effect: setValue(opponent.baseValue)
duration: thisComparison
```

---

## Pack Alpha

**Value:** 6  
**Tribe:** Beast

> +1 for every two Beasts you have played this match.

```text
trigger: beforeCompare

amount:
  floor(
    history.count(self, tribe = Beast) / 2
  )

target: thisCard
effect: modifyValue(amount)
duration: thisComparison
```

---

## Old Greyjaw

**Value:** 8  
**Tribe:** Beast

> +1 while you are losing the match.

```text
trigger: beforeCompare
condition: self.score < opponent.score
target: thisCard
effect: modifyValue(+1)
duration: thisComparison
```

---

## Grix the Tunnelking

**Value:** 10  
**Tribe:** Burrower

> If this wins, your next card gets -3.

```text
trigger: onWin
target: self.nextCard
effect: modifyValue(-3)
duration: untilTriggered
```

The card's primary strength remains that it is a 10.

---

# 20. Example Tribe Synergies

Tribes should support both same-tribe and cross-tribe archetypes.

## Same-Tribe

**Forest Alpha, Beast**

> +1 if your previous card was Beast.

## Cross-Tribe

**Eastbrook Ranger, Human**

> +1 if your previous card was Beast.

This encourages Human + Beast decks.

## Counter Card

**Spider Hunter, Human**

> +2 against Spider cards.

## Sacrifice Interaction

**Grave Robber, Bandit**

> If this loses to an Undead card, draw an extra card.

The engine does not need to know that Humans and Beasts are allies or that Humans counter Spiders.

The cards themselves define those relationships.

---

# 21. Recommended V1 Primitive Set

The first version should avoid supporting every possible mechanic immediately.

A practical V1 could ship with approximately 20 to 30 sanctioned primitives.

## Triggers

```text
onReveal
beforeCompare
onWin
onLose
onTie
onDiscard
onDraw
onRoundStart
onRoundEnd
```

## Conditions

```text
hasTribe
hasTag
valueComparison
previousCard
previousResult
scoreComparison
roundComparison
historyCount
counterComparison
ALL
ANY
NOT
```

## Targets

```text
thisCard
opponentCard
nextCard
nextMatchingCard
hand
randomHandCard
highestHandCard
lowestHandCard
discard
randomDiscardCard
```

## Effects

```text
modifyValue
setValue

draw
discard
returnToHand

reveal

addCounter
removeCounter

addTribe
removeTribe

shuffle
returnFromDiscard

silence

winTies
```

## Durations

```text
instant
thisComparison
thisRound
nextRound
untilTriggered
untilMatchEnd
```

The engine can expand only when real card designs prove a missing primitive is necessary.

---

# 22. Design Guardrails

## Prefer Data Over Bespoke Code

Individual cards should not normally add special-case branches to the ClaudeStone engine.

Bad:

```ts
if (card.id === "forest_wolf") {
  ...
}
```

Preferred:

```ts
{
  trigger: "beforeCompare",
  condition: ...,
  effect: ...
}
```

## Keep Effects Legible

Players should usually be able to understand why an effective value changed.

Avoid excessive hidden permanent stacking.

Prefer effects such as:

```text
this round
next round
next Beast
if this loses
if this wins
while behind
```

over large numbers of invisible match-long modifiers.

## Keep the Numeric Game Central

Effects should enrich the decision of **which value to commit now**, not replace the 1 to 10 game entirely.

## Preserve Simultaneous Choice

Hidden simultaneous selection is a major source of:

- Bluffing
- Prediction
- Sacrifice
- Card counting
- Tempo
- Resource conservation

The expanded system should preserve this identity.

## Avoid Simple Power Creep

Future sets should not simply print numerically stronger cards.

Because every deck always needs two cards of every value, a new value-2 card competes against all other value-2 cards rather than replacing them through raw stats.

This constraint should remain a core balancing tool.

---

# 23. Core Design Principle

A legal ClaudeStone deck always contains exactly two cards of every value from 1 through 10.

Players do not build stronger decks by removing weak values.

They build **different strategies by deciding which version of every value earns its place**.

The expandable rules language then gives those cards their identity through:

- Tribes
- Tags
- Triggers
- Conditions
- Targets
- Effects
- Durations
- Counters
- History
- Stacking
- Limits

Together, these primitives should make it possible to create a very large number of custom cards without continually expanding the authoritative ClaudeStone engine.
