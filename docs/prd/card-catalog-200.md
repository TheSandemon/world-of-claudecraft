# Card Catalog 200: replacing the launch set with the full design catalog

Implementation plan for swapping the shipped 30-card launch set for the 200-card,
20-identity catalog authored in the design workbook, without changing the rules
engine and without growing a monolith.

Read first: `docs/design/card-duel-rules-language.md` (the authoring spec),
`docs/prd/card-duel-v2.md` (how the engine got here),
`src/sim/minigames/card_duel/CLAUDE.md`, `src/sim/content/CLAUDE.md`,
`src/ui/CLAUDE.md`, `docs/design/tooltip-writing.md`, and
`docs/i18n-scaling/translation-workflow.md`.

## 0. Source of truth (read this first)

Three workbooks exist in the maintainer's Downloads folder. They are NOT
interchangeable:

| File | What it is |
|---|---|
| `...-200.xlsx` | An OLDER, unrelated generation. Different ids and different card names entirely; zero id overlap with the other two. Not the source. |
| `...-200-with-art-compositions.xlsx` | The LOW-POWER pass over the same 200 ids. Keep it as the tuning reference (section 1.1). |
| `...-200-HIGH-POWER-v1.xlsx` | **The source of truth.** Same 200 ids and the same `Art Composition` briefs, with the effect numbers deliberately turned up. Originally named `-BROKEN-EFFECTS-v1`; renamed, because the numbers are an intentional power pass, not file corruption. |

The high-power pass differs from the low-power one on 180 of 200 cards (607
cells). The shape of the difference, so it is on the record and nobody
"corrects" it back by accident:

- **169 raised amounts.** `Pack: constant(1)` becomes `constant(10)`;
  `constant(3)` on a value-2 card becomes `constant(21)`; a value-3 card's
  `floor(Pack / 2)` becomes `3 * Pack`. 58 amounts sit at 6 or higher, above the
  entire base-value range.
- **20 added second effects**, including `silence` (x5), `reverseComparison`
  (x3), `draw` (x2) and `returnToHand` (x3).
- **24 trigger limits opened up** (15 `oncePerMatch` and 9 `oncePerRound` set to
  `None`).
- **30 loosened conditions** (thresholds dropped from `gte 2` / `gte 3` to
  `gte 1`).

All of that imports as-is. Two things in the high-power file genuinely do not,
and are repaired at import (section 1.2).

## 1. Does the catalog actually fit the engine? Yes, with two fixes.

The 200 cards were validated cell by cell against
`src/sim/minigames/card_duel/types.ts`:

- **Vocabulary is a strict subset of the engine's.** Tribes (12), tags (11),
  triggers (9 declared, 4 used), primitives (18 declared, 15 used), durations,
  stack modes, and rarities all resolve. Nothing in the catalog needs a new
  engine primitive, trigger, condition kind, selector, or duration. **The engine
  does not change.**
- **Shape:** exactly 20 cards at every value 1 to 10; 20 identities with a
  complete 1-to-10 run each; 200 unique ids and 200 unique display names.
- **Grammar coherence:** every `nextCard` park declares `untilTriggered`, every
  instant primitive declares `instant`, and every board modifier declares a
  duration that ends with the comparison, the round, or the match. Target
  scoping holds on 195 of 200 cards; the five exceptions are section 1.2.
- **Counters:** three named counters (`Pack`, `Web`, `Dread`, the last shared by
  two identities). Every counter read by a condition or expression is granted by
  a card in the same identity. No orphan counters.
- **Placeholders:** every `{placeholder}` in a rules sentence is a value the
  card's own effect tree supplies, which is exactly what
  `tests/card_catalog.test.ts` pins.
- **Expressions:** 31 distinct amount expressions, all inside the existing
  `CardNumericExpr` grammar (`constant`, `counter`, `historyCount`, `cardValue`,
  `floor`, `divide`, `multiply`).

### 1.1 What the power pass changes about play, factually

Not a balance objection, just the mechanical consequences, so they are chosen
rather than discovered in QA:

- Effective values routinely land far above 10. `maximumValue` and
  `minimumValue` are absolute numbers, so the Ironward Assembly and Relicguard
  Order control identities (caps, floors, tie control) stop biting once the
  other side's card is at 20-plus. Those two identities become the weakest in
  the set rather than the control answer they were designed as.
- `bot.ts` policies are value-only (highest / lowest / hold-the-big-one). They
  read printed value, not effective value, so the CPU opponents do not "see" a
  card that will resolve at 25 and will play into it. The bots stay legal and
  deterministic, they just get worse. Re-tuning them is a separate change.
- `draw` above the hand size is legal: `drawOne` has no hand cap, and
  `refillHand` only tops a hand up to `HAND_SIZE`. A "draw 5" card leaves that
  seat holding nine cards which then drain back down. It works, it is a large
  advantage, and no guard fires.
- Keep the low-power workbook checked in reach as the tuning reference. If a
  later pass wants to walk any card back, that file already holds a coherent
  answer for it.

### 1.2 The two things that must be repaired at import

1. **5 illegal targets.** These are the only rows the engine cannot express, and
   they exist only in the high-power file:
   - `returnToHand` targeting `thisCard` on `1_ranger_s_patrol`,
     `1_warden_s_watch`, `1_traveler_s_errand`. `returnToHand` moves a card out
     of a zone; retarget to
     `zone(self, discard, highest, count=1, ...)`, which is what the rest of the
     catalog does.
   - `discard` targeting `player(opponent)` on `10_mudfins_flood` and
     `10_bandits_last_score`. Retarget to
     `zone(opponent, hand, random, count=N)`; pick `N` to match the sentence.
2. **All 200 ids start with a digit** (`1_wolf_s_nap`). That is a legal string id
   but not a legal JS identifier, so every i18n catalog key would need quoting.
   Normalize on import to `<identity>_<slug>` (`briarpack_wolf_nap`). These ids
   have never shipped, so renaming now is free; after this lands they are
   permanent (saved decks reference them).

Plus one cosmetic cleanup: **30 cards state a scaling bonus as a literal in the
sentence** ("Gets +3 for each Pack you have") while their effect also supplies an
unused `{amount}` placeholder whose formula no longer matches the sentence. The
pinned test only requires wanted-is-a-subset-of-supplied, so it passes either
way, but `docs/design/tooltip-writing.md` wants the RESOLVED value shown. Rewrite
these to "Gets +{amount}, three for each Pack you have" and drop the stale
placeholder formulas. One card, `10_wolves_wild_night`, has a second effect
granting `Pack: constant(0)`, a no-op; give it a real amount or delete the
effect.

## 2. Blast radius

Small and well contained. Nothing outside the card feature touches a card id.

| Surface | Impact |
|---|---|
| `src/sim/minigames/card_duel/**` | **No change.** The engine is already general enough. |
| `src/sim/content/cards/launch_set.ts` | Replaced by a per-identity module set (section 3). |
| `src/sim/content/cards/index.ts` | Barrel re-points; `DEFAULT_DECK_LIST` needs a real curated deck (section 4). |
| `src/sim/content/cards/opponents.ts` | The four regulars' `favours` lists name deleted ids; re-theme onto the new identities. |
| `src/ui/i18n.catalog/cards.ts` | 30 name + 30 text keys out, 200 + 200 in. |
| `src/ui/i18n.locales/*.ts` (21 files) | Stale `cards.name.*` / `cards.text.*` fills removed; M16 fills added (section 5). |
| `src/ui/deck_builder_view.ts` + `_window.ts` | A value row goes from 3 options to 20 (section 6). |
| `tests/parity/golden/card_duel.json` | Regenerated (the default deck changes, so the shuffle draws change). |
| 6 test files | Re-anchored onto new card ids (section 7). |
| `public/ui/cards/` | Still empty; all 200 fall back to the procedural face. Art is a follow-up. |

**Saved player decks break gracefully and by design.** `validateDeck` returns
`unknown_card` for a retired id and the match falls back to `DEFAULT_DECK_LIST`,
so no player hits an error state; they just find their saved deck reset. Call
this out in the PR body.

## 3. Where the 200 cards land

`launch_set.ts` is 643 lines for 30 cards (about 21 lines per card). 200 cards in
one file is roughly 4,300 lines: a new monolith on day one, and
`tests/monolith_budget.test.ts` exists precisely to stop that.

Land them as one module per design identity, which is also how the workbook is
organized and how a designer will want to read them:

```
src/sim/content/cards/
  index.ts            # the barrel (unchanged role): CARDS, cardById, cardsOfValue, CARD_CATALOG
  sets/
    index.ts          # concatenates the 20 identity modules in a fixed order
    briarpack.ts      # 10 cards, values 1..10, ~215 lines
    gravebound_court.ts
    sableweb_brood.ts
    ... (20 total)
  opponents.ts
```

Each identity module exports
`export const BRIARPACK_CARDS: readonly CardDefinition[]`, carries a short header
naming the identity's strategic language (the workbook's `Core Identity` column
is the source for that sentence), and keeps the existing `card({...})` and
`constant()` authoring shorthands. `CARDS` still sorts by id, so every walk stays
deterministic.

**Import is a one-shot script, not a build step.** Add
`scripts/import_card_catalog.mjs`: it reads the workbook (or a CSV export of it)
and emits the 20 TypeScript modules plus the English i18n block. Run it once,
review the output as ordinary hand-maintainable source, and commit it. The result
is NOT a `*.generated.ts` (no hook, no regen gate): cards are content, a designer
will hand-tune them, and a permanent generator would fight that. Keep the script
committed so a future bulk re-import is reproducible.

## 4. The default deck and the starter experience

`DEFAULT_DECK_LIST` currently takes the two lowest-id cards at every value.
Across 200 ids that yields an arbitrary, synergy-free deck: with only three cards
per value it was harmless, with twenty it is a bad first match.

Replace the derivation with an **explicitly authored starter deck** (a legal
20-card list, two per value, drawn from one or two coherent identities), and keep
the id-order derivation only as the last-resort fallback if the authored list
ever fails validation. This is a content decision, so it lives in
`src/sim/content/cards/` beside the sets, and `tests/card_catalog.test.ts` gains a
pin that the authored starter deck passes `validateDeck` against the live
catalog.

The four Card Master regulars re-theme onto the new identities, one identity
each, which is exactly what the identities were designed for:

| Regular | Tier | New identity |
|---|---|---|
| Pell, Dockhand | novice | Mirefen Tide (Mudfin, reveal and disrupt) |
| Ossa, Gravedigger | steady | Gravebound Court (Undead discard recursion) |
| Bregg, Huntsman | sharp | Briarpack (Beast, the Pack counter engine) |
| The Card Master | master | Ironward Assembly plus Relicguard Order (floors, caps, silence, tie control) |

The other 16 identities are the obvious seam for adding regulars later; that is
out of scope here.

## 5. i18n: the largest single chunk of work

400 new English keys (`cards.name.*` x200, `cards.text.*` x200) go into
`src/ui/i18n.catalog/cards.ts`, English only, per the contributor rule.

**M16 applies to effectively all of them.** A new wordy English value (4+
consecutive lowercase letters after stripping `{tokens}`) needs its five
non-Latin fills (`zh_CN`, `zh_TW`, `ja_JP`, `ko_KR`, `ru_RU`) in the same change
or `tests/i18n_completeness.test.ts` reds even at PR tier. Every rules sentence is
prose, and card names like "3 Wolves' Howl" clear the bar too. Budget **about
2,000 locale fills** (400 keys x 5 locales) and use the `i18n-locale-fill` skill
rather than hand-writing them. The other 16 locales stay pending until the
maintainer's release-tier fill.

Also delete the 30 retired `cards.name.*` / `cards.text.*` rows from all 21
overlay files. Nothing gates orphan overlay keys today, so this is tidiness
rather than a hard requirement, but leaving 60 dead keys across 21 files is
exactly the kind of drift the release-tier fill later trips over.

## 6. Deck builder at 20 options per row

`buildDeckBuilderView` renders one row per value holding every card authored at
that value. Today that is 3 tiles per row, 30 total. After this change it is 20
tiles per row, 200 total, all painted at once. That is a real regression in both
legibility and per-frame cost, and it is the one UI change this catalog forces.

The fix stays inside the existing pure-core-plus-thin-painter seam
(`src/ui/CLAUDE.md`): extend `DeckBuilderInput` with a filter
(`{ identity?: CardSetId; tribe?: CardTribe; search?: string }`) and have
`buildDeckBuilderView` narrow each row's `options` through it, with the chosen
cards always kept visible so a filter can never hide a slot you already spent.
The window gains an identity/tribe filter strip and a scroll container per row.
The filter itself is pure and testable in `tests/deck_builder_view.test.ts` with
no DOM.

This means `CardDefinition` should carry the identity: add
`readonly set: CardSetId` (a new string union of the 20 identity ids in
`types.ts`) rather than inferring it from the id prefix. It is real content
metadata, the deck builder needs it, and the wiki will want it later.

## 7. Tests

Re-anchor (existing card ids disappear):

- `tests/card_catalog.test.ts` lines 84 and 93: `pack_alpha` and
  `sableweb_hexer` anchor the "scaling text resolves to a live number" and "a
  reduction is stated as a positive number" pins. Re-point at equivalents in the
  new catalog (a `floor(counter(self, Pack) / 2)` card and a `constant(-N)` card
  respectively). Keep both pins: they are the two that actually catch tooltip
  regressions.
- `tests/card_i18n.test.ts`, `tests/card_face_markup.test.ts`,
  `tests/card_face_view.test.ts`, `tests/card_duel_window_clock.test.ts`,
  `tests/card_opponents.test.ts`: swap the sampled ids.
- `tests/card_duel_resolve.test.ts` needs **no** change: it defines its own cards
  locally via `defineCard`, which is why it is the right shape.

Add:

- A catalog-shape suite: exactly 20 cards at every value; exactly 20 identities
  with a complete 1-to-10 run each; every counter read by a condition or
  expression is granted by some card; the authored starter deck validates; no
  duplicate display name.
- A per-identity smoke test: play each identity's deck against itself through the
  real resolver for a full match and assert no resolution-step overflow and no
  thrown error. This is the cheap catch-all for a mis-imported card.

Regenerate `tests/parity/golden/card_duel.json` (the default deck changes, so the
shuffle draw order changes). The scenario itself is kept, per the preservation
ledger in `docs/prd/card-duel-v2.md`.

## 8. Art

200 `art` ids, zero committed paintings: every card renders the procedural face
keyed on tribe and value, which is the designed fallback, so this ships looking
coherent on day one. The workbook's `Art Composition` column is a ready-made
per-card brief ("3 wolves howl on a ridge") and pairs with the
count-in-the-name convention (a value-N card shows N creatures). Commissioning is
a separate change through `scripts/convert_card_art_webp.mjs` and
`src/ui/card_image_ids.ts`; `tests/card_art.test.ts` already gates the id set
against the committed files in both directions.

## 9. Sequence

1. **Import, normalize, repair.** Write `scripts/import_card_catalog.mjs` against
   the HIGH-POWER workbook, normalize ids to `<identity>_<slug>`, apply the five
   target repairs and the 30 sentence rewrites from section 1.2, and emit the 20
   identity modules plus the English i18n block. The script should FAIL LOUDLY on
   any row it cannot map to the grammar rather than emitting a guess. Review the
   output by hand, identity by identity.
2. **Content lands.** `sets/` plus barrel, `CardSetId` in `types.ts`, authored
   starter deck, re-themed regulars. Old `launch_set.ts` and its 60 i18n keys
   removed.
3. **Tests green in the sim.** Catalog-shape suite, per-identity smoke suite,
   re-anchored pins, parity golden regenerated.
4. **Deck builder filter.** Pure-core filter, window filter strip, tests.
   Before/after screenshots, desktop and mobile, per the PR template.
5. **i18n.** English catalog complete, M16 fills for the five non-Latin locales
   via the `i18n-locale-fill` skill, stale overlay rows removed.
6. **Gate.** `node scripts/gate_select.mjs`, then `/qa` over the diff with
   `content-obligations-reviewer` dispatched (this is a content diff).

Steps 1 to 3 are one reviewable unit; 4, 5, and 6 can each be their own commit on
the same branch.

## 10. Explicitly out of scope

- Any rules-engine change. If a card needs one, that card is wrong, not the
  engine.
- New card art.
- New Card Master regulars beyond re-theming the existing four.
- A Guide/wiki page for the card catalog. Cards are not currently generated into
  `src/guide/content.generated.ts`, and adding a new content TYPE to the wiki is
  its own contract (`src/guide/CLAUDE.md`).

## 11. As built: the deviations from this plan

The import ran and the plan held, with four deliberate departures. They are here
rather than in a commit message because each one is a decision a later reader
would otherwise re-litigate.

### 11.1 One rules-engine addition, against section 10

Section 10 says no engine change. Six cards (two each in Greenwake Circle,
Tableborn Circle, and Crownless Legends) read "if you have played at least three
different tribes". The workbook spelled that `historyCompare(self, unique tribes,
gte, 3)`, which is prose, not grammar: a history filter counts CARDS matching one
tribe and can never count DISTINCT tribes. The engine already had
`uniqueTribesPlayed` as an EXPRESSION with no condition leaf beside it.

It was expressible without a change, as
`min(1, max(0, uniqueTribesPlayed - 2)) * N`, and that is exactly why the leaf was
worth adding instead: six cards is past the rule of three, and the arithmetic
spelling is unreadable at the point a designer has to check it. So
`uniqueTribesCompare` was added to `CardConditionTree` and `conditions.ts`,
mirroring the expression it reads. It is one leaf, it introduces no new state, and
it draws no rng.

### 11.2 The five illegal targets, re-aimed to match their identity

The workbook's high-power pass left five cards whose target and primitive did not
compose, so the effect silently did nothing. Each was re-aimed at a selector shape
already in use elsewhere in the SAME identity, so the fix reads as that set's own
design language rather than as a patch:

| Card | Was | Now |
|---|---|---|
| Eastbrook `1 Ranger's Patrol` | `returnToHand` at `thisCard` (a board card is not in a zone) | `zone(self, discard, highest, count=1, tribe=Beast)`: the handlers pull a Beast back, which is the identity's whole idea |
| Emberwatch `1 Warden's Watch` | same | the same shape, tribe-locked to Human and capped at value 3 |
| Questbound `1 Traveler's Errand` | same | the same shape, deliberately NOT tribe-locked: Questbound is the general-utility line |
| Mirefen `10 Mudfins' Flood` | `discard` at `player(opponent)` (a player is not a discardable card) | `zone(opponent, hand, random, count=4)`, the shape the rest of Mirefen discards with |
| Roadknife `10 Bandits' Last Score` | same | same |

### 11.3 Prose counts won over data counts

Eight cards had a rules sentence promising more than the selector delivered
("reveal 6 random cards" against `count=2`). The sentence is what the power pass
author wrote, so the SELECTOR moved to match it, and the placeholder is then
derived from the selector, which is what keeps them welded. Two cards
(`10 Wolves' Wild Night`, `10 Spiders' Brood Rite`) had a drawback clause whose
cost the power pass had set to zero; the clause and its no-op effect were both
deleted, because "lose 0 Pack" is not a drawback, it is a sentence a player has to
read and discard.

### 11.4 Every number in a rules sentence is now a placeholder

41 sentences carried a hardcoded digit. All of them now read a `{placeholder}`
resolved from the effect that produces it, so a tuning pass can never leave the
English lying and a translator never retypes a number. The scaling cards took a
new two-value shape, `Gets +{rate} for each Pack you have, currently +{amount}`:
the rate is the printed rule and the amount is the live total, which satisfies
`docs/design/tooltip-writing.md` without making the player do the multiplication.
`tests/card_catalog.test.ts` now fails on any bare digit outside a placeholder,
across the whole catalog.

### 11.5 The bots read the projection, not the face number

Not in the original plan, and the catalog swap is what made it necessary. With
effects on every card, `CardInstance.value` stopped being a card's value, and all
four policies were choosing on it: a 2 that resolves at 23 was being shed on a
throwaway round. `src/sim/minigames/card_duel/projection.ts` answers what a hand
card would resolve to, using only what the seat can see and mutating nothing;
`CardBotView.projectedValues` carries it, and `cardWorth` is the single accessor
every policy reads value through. The card counting stays a count of PRINTED
values on purpose: Master knows its own cards because it can read them, and cannot
know the opponent's, which is exactly the information a strong human has.
