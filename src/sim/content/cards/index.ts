// The Card Duel catalog: every authored card, plus the lookup the rules engine
// takes as its `CardCatalog`.
//
// One barrel per the content conventions (src/sim/content/CLAUDE.md, "New
// content DOMAIN"): the engine is injected with this rather than importing
// content itself, which is what keeps the rules testable against three
// hand-built cards and the standalone slice free to load a different set.

import { withBasicCards } from '../../minigames/card_duel/basic_catalog';
import { type CardDeckEntry, COPIES_PER_VALUE } from '../../minigames/card_duel/deck';
import type { CardCatalog } from '../../minigames/card_duel/match_state';
import {
  CARD_VALUES,
  type CardDefinition,
  type CardId,
  type CardValue,
} from '../../minigames/card_duel/types';
import { LAUNCH_CARDS } from './launch_set';

/** Every authored card, in a stable id order so any walk of the catalog is
 *  deterministic across hosts. */
export const CARDS: readonly CardDefinition[] = [...LAUNCH_CARDS].sort((a, b) =>
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

/**
 * The deck a player starts with, and the one a match falls back to when a saved
 * deck fails validation. A legal list by construction: the two lowest-id cards
 * at every value, which is stable as the catalog grows because the ids are
 * sorted rather than positional.
 */
export const DEFAULT_DECK_LIST: readonly CardDeckEntry[] = CARD_VALUES.flatMap((value) =>
  cardsOfValue(value)
    .slice(0, COPIES_PER_VALUE)
    .map((def) => ({ cardId: def.id, value: def.value })),
);

export { LAUNCH_CARDS } from './launch_set';
export {
  buildOpponentDeck,
  CARD_OPPONENTS,
  type CardOpponentDef,
  cardOpponentById,
} from './opponents';
