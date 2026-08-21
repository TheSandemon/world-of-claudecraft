<!-- src/sim/minigames/card_duel/: the Card Duel rules engine. Parent
     src/sim/minigames/CLAUDE.md owns what a minigame folder may contain;
     root CLAUDE.md owns the repo-wide rules. Don't repeat either here. -->

# card_duel - the data-driven rules engine

Cards are **data**, not code. Every card is
`WHEN trigger IF conditions TARGET selector DO effect FOR duration` over the
sanctioned primitives in `types.ts`. Before adding an engine mechanic, ask
whether the card can be expressed with an existing trigger, condition,
selector, effect, duration, or counter. If it can, it is content
(`src/sim/content/cards/`), not engine.

Spec: `docs/design/card-duel-rules-language.md`. Plan:
`docs/prd/card-duel-v2.md`.

## Module map

| File | Owns |
|---|---|
| `types.ts` | every shape: definitions, instances, triggers, conditions, selectors, effects, durations, modifiers, history |
| `deck.ts` | deck build, shuffle, draw, refill, play. **An rng site.** |
| `match_state.ts` | live per-player and per-round state, history recording |
| `expressions.ts` | numeric expression evaluator |
| `conditions.ts` | condition tree evaluator (ALL / ANY / NOT plus leaves) |
| `selectors.ts` | target resolution. **The other rng site.** |
| `modifiers.ts` | modifier application, stack modes, duration expiry |
| `effects.ts` | the effect applier, one handler per primitive |
| `resolve.ts` | the round pipeline, priority-ordered |
| `text.ts` | rules-text VALUE resolution (key plus values, never a string) |
| `bot.ts` | CPU opponent policies, pure |
| `preview.ts` | what a player can be TOLD before the reveal: the parked modifiers still in play, and the value change already riding on a card in hand |

## Writing a card: ignore priority

Most effects are **commutative** (`modifyValue`, `addCounter`, `removeCounter`,
`addTribe`): applying them in any order gives the same answer, so a normal card
**never declares a priority and never thinks about resolution order at all.**

Only the non-commutative primitives (`setValue`, `swapValues`, `silence`,
`removeTribe`, `winTies`, `reverseComparison`, `minimumValue`, `maximumValue`)
care, and their priorities are declared **once in the engine**, next to the
primitive in `resolve.ts`, never per card. A card using `silence` inherits the
right priority automatically. The catalog test fails at authoring time if two
non-commutative primitives ever share a priority.

## Determinism rules that are not optional

- **Round resolution draws rng in `deck.ts` and `selectors.ts` only.** A guard
  test asserts no other module here touches the injected rng, with one declared
  exception: `bot.ts`, which draws to CHOOSE a card and is not part of
  resolution. A hidden draw anywhere else silently invalidates
  `tests/parity/golden/card_duel.json`.
- **Never iterate a `Map` or `Set` for anything that affects outcome.** Effect
  collection walks explicit arrays sorted by declared keys; the hosts can
  populate insertion-ordered collections differently.
- **Resolution is order-independent.** The property test resolves each phase
  forward and reversed and asserts identical output; symmetry is the guarantee
  that no competitive outcome depends on a seat.
- **There is a hard per-round resolution ceiling** (`MAX_RESOLUTION_STEPS` in
  `resolve.ts`). One process serves a whole realm, so an unbounded trigger
  cycle between two cards is an outage, not a card bug. On overflow the round
  resolves on current values and the dev channel logs it.

## No player-visible text here

`src/sim/` is language-agnostic. Cards carry `nameId` and `textId` key ids;
`text.ts` returns `{ textId, values }` and the client calls `t()`. Never build
a sentence by concatenating clause fragments from the effect tree: it cannot be
translated and it cannot be reviewed against `docs/design/tooltip-writing.md`.
