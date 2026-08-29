// Pure view-core for the ClaudeStone deck builder.
//
// The builder's core job is making the deck rule LEGIBLE: ten value rows, two
// slots each, and a pool per row holding only the cards of that value, with the
// ones already in the deck marked as taken. The constraint explains itself
// through the layout instead of through an error message, which is why this
// core is shaped as rows-of-slots rather than as a flat card list plus a
// validator.
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

/** One value's two slots, plus everything authored at that value. */
export interface DeckBuilderRow {
  value: CardValue;
  /** Exactly COPIES_PER_VALUE entries; a null is an empty slot. */
  slots: (CardId | null)[];
  options: DeckBuilderOption[];
  /** True once both slots are filled: the row is done. */
  complete: boolean;
}

export interface DeckBuilderViewModel {
  rows: DeckBuilderRow[];
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
  /** Narrows each row's pool to one design identity. Twenty cards per value is
   *  past the point where a row can be read at a glance, and an identity is the
   *  unit a player actually thinks in ("I am building Briarpack"), so this is
   *  the filter the catalog's size calls for rather than a generic search box. */
  setFilter?: CardSetId | null;
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
    const options = input.cards
      .filter((def) => def.value === value)
      // A card already in the draft stays visible under any filter: hiding it
      // would leave the player looking at a filled slot with no way to clear it.
      .filter((def) => setFilter === null || def.set === setFilter || chosen.includes(def.id))
      .map((def) => ({ cardId: def.id, def, chosen: chosen.includes(def.id) }));
    return { value, slots, options, complete: chosen.length === COPIES_PER_VALUE };
  });

  const filled = rows.reduce((sum, row) => sum + row.slots.filter(Boolean).length, 0);
  const required = CARD_VALUES.length * COPIES_PER_VALUE;
  return {
    rows,
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

/** A repaint signature over everything the builder shows. */
export function deckBuilderSignature(view: DeckBuilderViewModel): string {
  return [
    view.draftName,
    view.activeName,
    view.savedNames.join(','),
    view.filled,
    // The filter changes which cards a row OFFERS, so it has to reach the
    // signature or switching identities would repaint nothing.
    view.setFilter ?? '*',
    view.rows.map((row) => row.slots.map((slot) => slot ?? '-').join('+')).join('|'),
  ].join('#');
}
