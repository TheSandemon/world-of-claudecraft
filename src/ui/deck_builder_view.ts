// Pure view-core for the ClaudeStone deck builder.
//
// The builder's core job is making the deck rule LEGIBLE: ten value rows, two
// slots each, and a pool of the cards you may put in ONE of them. The
// constraint explains itself through the layout instead of through an error
// message, which is why this core is shaped as rows-of-slots rather than as a
// flat card list plus a validator.
//
// The model is deliberately TWO things at once, and the split is the design:
// `rows` is the whole deck at a glance (ten values, twenty slots, no card
// faces), and `pool` is the cards on offer at the ONE value the player is
// working on. It used to hand every row its own full pool, which is how the
// window ended up listing all two hundred cards in the game on one page: an
// undifferentiated wall to scroll rather than a deck to build. A player fills
// one value at a time, so the core answers one value at a time.
//
// DOM-free and i18n-free: tests/deck_builder_view.test.ts drives it directly.

import { COPIES_PER_VALUE } from '../sim/minigames/card_duel/deck';
import type {
  CardDefinition,
  CardId,
  CardSetId,
  CardValue,
} from '../sim/minigames/card_duel/types';
import { CARD_VALUES } from '../sim/minigames/card_duel/types';

/** One card offered at a value, and whether the draft already holds it. */
export interface DeckBuilderOption {
  cardId: CardId;
  def: CardDefinition;
  /** In the draft deck right now (so its slot is spent). */
  chosen: boolean;
}

/**
 * One value's two slots. NO options: the pool belongs to the focused value
 * alone (see `DeckBuilderViewModel.pool`), so the ten rows stay cheap enough to
 * show all at once as the deck overview they are.
 */
export interface DeckBuilderRow {
  value: CardValue;
  /** Exactly COPIES_PER_VALUE entries; a null is an empty slot. */
  slots: (CardId | null)[];
  /** True once both slots are filled: the row is done. */
  complete: boolean;
}

export interface DeckBuilderViewModel {
  /** All ten values, slots only: the deck as a whole, always in view. */
  rows: DeckBuilderRow[];
  /** The value the pool is showing, and the row the deck column highlights. */
  focusValue: CardValue;
  /** The cards on offer at `focusValue`, after the set filter. The ONLY place
   *  card options appear: one value's worth, never the whole catalog. */
  pool: DeckBuilderOption[];
  /** Every design identity the pool holds, in catalog order: the filter chips.
   *  Derived from the cards rather than declared, so an identity added to the
   *  catalog appears here with no second list to update. */
  sets: CardSetId[];
  /** The identity currently filtering the pools, or null for all of them. */
  setFilter: CardSetId | null;
  /** Slots filled out of the twenty a legal deck needs. */
  filled: number;
  required: number;
  /** Every slot filled: the deck can be saved. */
  legal: boolean;
  /** The saved deck names, and which one is active. */
  savedNames: string[];
  activeName: string;
  /** The name the draft will be saved under. */
  draftName: string;
}

export interface DeckBuilderInput {
  /** The draft, as card ids in any order. */
  draft: readonly CardId[];
  catalog: { get(id: CardId): CardDefinition | undefined };
  /** Every authored card, so a row can offer its pool. */
  cards: readonly CardDefinition[];
  /** Narrows the pool to one design identity. Twenty cards at a value is past
   *  the point where a pool can be read at a glance, and an identity is the
   *  unit a player actually thinks in ("I am building Briarpack"), so this is
   *  the filter the catalog's size calls for rather than a generic search box. */
  setFilter?: CardSetId | null;
  /** Which value the pool is for. Defaults to the first value still missing a
   *  card, so opening the builder lands on the work rather than on value one. */
  focusValue?: CardValue;
  savedNames: readonly string[];
  activeName: string;
  draftName: string;
}

/**
 * Builds the row model. A draft card the catalog no longer knows is dropped
 * rather than shown as a mystery slot, and a value holding more than its two
 * copies keeps only the first two, so a corrupt draft still renders a usable
 * builder.
 */
export function buildDeckBuilderView(input: DeckBuilderInput): DeckBuilderViewModel {
  const sets: CardSetId[] = [];
  for (const def of input.cards) if (!sets.includes(def.set)) sets.push(def.set);
  // A filter naming an identity the pool does not hold would silently empty
  // every row, so an unknown one reads as no filter at all.
  const setFilter =
    input.setFilter !== undefined && input.setFilter !== null && sets.includes(input.setFilter)
      ? input.setFilter
      : null;

  const chosenByValue = new Map<CardValue, CardId[]>();
  for (const cardId of input.draft) {
    const def = input.catalog.get(cardId);
    if (!def) continue;
    const list = chosenByValue.get(def.value) ?? [];
    if (list.length >= COPIES_PER_VALUE || list.includes(cardId)) continue;
    list.push(cardId);
    chosenByValue.set(def.value, list);
  }

  const rows: DeckBuilderRow[] = CARD_VALUES.map((value) => {
    const chosen = chosenByValue.get(value) ?? [];
    const slots: (CardId | null)[] = [];
    for (let i = 0; i < COPIES_PER_VALUE; i++) slots.push(chosen[i] ?? null);
    return { value, slots, complete: chosen.length === COPIES_PER_VALUE };
  });

  // Where the work is: the first value still short of its two cards. Only the
  // DEFAULT, so it cannot move under a player who has chosen a value; the
  // window holds the choice once one is made.
  const firstUnfilled = rows.find((row) => !row.complete)?.value ?? CARD_VALUES[0];
  const focusValue = input.focusValue ?? firstUnfilled;

  // The pool: ONE value's cards. Building it for the focused value alone is
  // what keeps the window from being a list of every card in the game.
  const focusChosen = chosenByValue.get(focusValue) ?? [];
  const pool: DeckBuilderOption[] = input.cards
    .filter((def) => def.value === focusValue)
    // A card already in the draft stays visible under any filter: hiding it
    // would leave the player looking at a filled slot with no way to clear it.
    .filter((def) => setFilter === null || def.set === setFilter || focusChosen.includes(def.id))
    .map((def) => ({ cardId: def.id, def, chosen: focusChosen.includes(def.id) }));

  const filled = rows.reduce((sum, row) => sum + row.slots.filter(Boolean).length, 0);
  const required = CARD_VALUES.length * COPIES_PER_VALUE;
  return {
    rows,
    focusValue,
    pool,
    sets,
    setFilter,
    filled,
    required,
    legal: filled === required,
    savedNames: [...input.savedNames],
    activeName: input.activeName,
    draftName: input.draftName,
  };
}

/**
 * A repaint signature over everything the builder shows.
 *
 * Kept as the whole-view digest for callers that want one, and composed from
 * the three below so it cannot disagree with them.
 */
export function deckBuilderSignature(view: DeckBuilderViewModel): string {
  return [
    deckBuilderShellSignature(view),
    deckBuilderDeckSignature(view),
    deckBuilderPoolSignature(view),
  ].join('#');
}

/**
 * The SHELL: the saved-deck list and which of them is active.
 *
 * Deliberately narrow, and every omission is deliberate too. This is the only
 * signature whose change costs a full rebuild, so nothing that moves while a
 * player is working belongs in it.
 *
 * `filled` is not here: it moves on every toggle, and it drives the progress
 * line and the Save button, which the window writes in place. `draftName` is
 * not here either, and that one was a bug rather than a cost: the name field is
 * what the player types into, so rebuilding the window because it changed
 * destroyed the field mid-keystroke and dropped the caret with it. Loading a
 * saved deck still repaints the field, because that moves `activeName`, which
 * IS here. And `setFilter` is not here because it narrows only the POOL, which
 * carries it in its own signature below.
 */
export function deckBuilderShellSignature(view: DeckBuilderViewModel): string {
  return [view.activeName, view.savedNames.join(',')].join('#');
}

/**
 * The DECK column: the twenty slots, and which value is being worked on.
 *
 * The focused value is in it because the column is also the navigator, so the
 * row a player has selected has to look selected.
 */
export function deckBuilderDeckSignature(view: DeckBuilderViewModel): string {
  return [
    view.focusValue,
    view.rows.map((row) => row.slots.map((slot) => slot ?? '-').join('+')).join('|'),
  ].join('#');
}

/**
 * The POOL: which value it is for, which identity it is narrowed to, and which
 * of its cards are already taken.
 *
 * The chosen flags are in it as well as the value, because the pressed state of
 * an option is what tells the player their click landed, and two different
 * drafts can leave a value's slots looking the same.
 */
export function deckBuilderPoolSignature(view: DeckBuilderViewModel): string {
  return [
    view.focusValue,
    view.setFilter ?? '*',
    view.pool.map((option) => (option.chosen ? '1' : '0')).join(''),
  ].join('#');
}

/** The draft as a flat card id list, in value order, ready to send. */
export function draftCardIds(view: DeckBuilderViewModel): CardId[] {
  return view.rows.flatMap((row) => row.slots.filter((id): id is CardId => id !== null));
}

/**
 * Toggles one card in the draft: chosen cards come out, unchosen ones go in if
 * their value still has a free slot. Returns the new draft, never mutating the
 * old one, so a caller can diff or discard it.
 */
export function toggleDraftCard(
  draft: readonly CardId[],
  cardId: CardId,
  catalog: { get(id: CardId): CardDefinition | undefined },
): CardId[] {
  const def = catalog.get(cardId);
  if (!def) return [...draft];
  if (draft.includes(cardId)) return draft.filter((id) => id !== cardId);
  const atValue = draft.filter((id) => catalog.get(id)?.value === def.value).length;
  // The rule enforces itself: a full row simply refuses, so the player never
  // builds something the save would reject.
  if (atValue >= COPIES_PER_VALUE) return [...draft];
  return [...draft, cardId];
}
