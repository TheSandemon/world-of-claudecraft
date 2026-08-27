// The Card Duel catalog: every authored card, plus the lookup the rules engine
// takes as its `CardCatalog`.
//
// One barrel per the content conventions (src/sim/content/CLAUDE.md, "New
// content DOMAIN"): the engine is injected with this rather than importing
// content itself, which is what keeps the rules testable against three
// hand-built cards and the standalone slice free to load a different set.
//
// The cards themselves live one module per design identity under `sets/`, each
// a complete value 1 to 10 run. Twenty identities times ten cards is the whole
// catalog, and twenty cards at every value is what makes a deck slot a real
// choice rather than a formality.

import { withBasicCards } from '../../minigames/card_duel/basic_catalog';
import { type CardDeckEntry, COPIES_PER_VALUE } from '../../minigames/card_duel/deck';
import type { CardCatalog } from '../../minigames/card_duel/match_state';
import {
  CARD_VALUES,
  type CardDefinition,
  type CardId,
  type CardValue,
} from '../../minigames/card_duel/types';
import { ALL_SET_CARDS } from './sets';
import { STARTER_DECK_IDS } from './starter_deck';

/** Every authored card, in a stable id order so any walk of the catalog is
 *  deterministic across hosts. */
export const CARDS: readonly CardDefinition[] = [...ALL_SET_CARDS].sort((a, b) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
);

const BY_ID = new Map<CardId, CardDefinition>(CARDS.map((def) => [def.id, def]));

export function cardById(id: CardId): CardDefinition | undefined {
  return BY_ID.get(id);
}

/** Cards of one value: the pool a deck slot picks from. */
export function cardsOfValue(value: CardValue): readonly CardDefinition[] {
  return CARDS.filter((def) => def.value === value);
}

/**
 * The shipping catalog. The unauthored basics sit behind it, so a saved deck
 * naming a basic (or a match started before a player built a deck) always
 * resolves; nothing here can shadow an authored card.
 */
export const CARD_CATALOG: CardCatalog = withBasicCards({ get: (id) => BY_ID.get(id) });

/** The two lowest-id cards at every value: legal by construction, and the last
 *  resort if the authored starter deck ever fails validation. */
function idOrderDeck(): CardDeckEntry[] {
  return CARD_VALUES.flatMap((value) =>
    cardsOfValue(value)
      .slice(0, COPIES_PER_VALUE)
      .map((def) => ({ cardId: def.id, value: def.value })),
  );
}

/**
 * The deck a player starts with, and the one a match falls back to when a saved
 * deck fails validation.
 *
 * Authored rather than derived: across two hundred cards the "two lowest ids at
 * every value" rule produces a legal deck with no synergy at all, which is a
 * poor first match. `starter_deck.ts` names a real one; the derived list stays
 * as the backstop so a bad edit there degrades to something playable instead of
 * throwing at import.
 */
export const DEFAULT_DECK_LIST: readonly CardDeckEntry[] = (() => {
  const entries: CardDeckEntry[] = [];
  for (const cardId of STARTER_DECK_IDS) {
    const def = BY_ID.get(cardId);
    if (!def) return idOrderDeck();
    entries.push({ cardId: def.id, value: def.value });
  }
  const perValue = new Map<number, number>();
  for (const entry of entries) perValue.set(entry.value, (perValue.get(entry.value) ?? 0) + 1);
  const legal =
    entries.length === CARD_VALUES.length * COPIES_PER_VALUE &&
    CARD_VALUES.every((value) => perValue.get(value) === COPIES_PER_VALUE);
  return legal ? entries : idOrderDeck();
})();

export {
  buildOpponentDeck,
  CARD_OPPONENTS,
  type CardOpponentDef,
  cardOpponentById,
} from './opponents';
export { cardsOfSet, setDeckIds } from './set_lookup';
export { ALL_SET_CARDS } from './sets';
export { STARTER_DECK_IDS } from './starter_deck';
