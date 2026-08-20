// The unauthored fallback catalog: one plain definition per BASIC_DECK_LIST
// entry, no tribes, no tags, no effects.
//
// This is NOT game content (content lives in src/sim/content/cards/): it is the
// engine's own floor, so a match can always resolve even when a player has no
// deck saved, a saved deck references a retired card id, or a test wants two
// sides of pure numbers. Cards here carry generic key ids rather than authored
// ones, because there is no rules text to translate.

import { BASIC_DECK_LIST } from './deck';
import type { CardCatalog } from './match_state';
import type { CardDefinition, CardId } from './types';

/** The i18n key id every basic card names. It takes the face value as a
 *  placeholder, so ten cards share one authored English sentence. */
export const BASIC_CARD_NAME_ID = 'basic';

export const BASIC_CARD_DEFINITIONS: readonly CardDefinition[] = BASIC_DECK_LIST.map((entry) => ({
  id: entry.cardId,
  nameId: BASIC_CARD_NAME_ID,
  // No rules text: a basic card does nothing but hold its number.
  textId: '',
  art: `basic_${entry.value}`,
  value: entry.value,
  tribes: [],
  tags: [],
  rarity: 'common' as const,
  effects: [],
}));

const BASIC_BY_ID = new Map<CardId, CardDefinition>(
  BASIC_CARD_DEFINITIONS.map((def) => [def.id, def]),
);

export function isBasicCardId(id: CardId): boolean {
  return BASIC_BY_ID.has(id);
}

/** A catalog over the basics alone. */
export const BASIC_CARD_CATALOG: CardCatalog = { get: (id) => BASIC_BY_ID.get(id) };

/**
 * Wraps a catalog so the basics are always resolvable behind it. The authored
 * catalog wins wherever it defines an id; nothing here can shadow real content.
 */
export function withBasicCards(catalog: CardCatalog): CardCatalog {
  return { get: (id) => catalog.get(id) ?? BASIC_BY_ID.get(id) };
}
