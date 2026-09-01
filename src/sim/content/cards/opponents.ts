// The Card Master's regulars: the named computer opponents a player can sit
// down against, online or offline, at any hour.
//
// Each regular is a CONTENT record and zero engine code: a difficulty tier
// (which policy runs), a themed but legal deck, and three key ids. That is what
// makes them good value for world building, and it is why adding one is a data
// change.
//
// Two things fall out of the themed decks for free. Each regular is a playable
// showcase of one archetype, so a new player learns what a Beast deck or an
// Undead deck actually does by facing one rather than by reading a wiki page.
// And the deck lists are a balance instrument: a curated "here is a deck that
// works" that seeds the meta at launch instead of leaving it blank.
//
// Every deck here is held to the SAME shape rule players are (exactly twenty
// cards, two per value, no repeated id), pinned by tests/card_opponents.test.ts.

import type { CardBotTier } from '../../minigames/card_duel/bot';
import type { CardDeckEntry } from '../../minigames/card_duel/deck';
import type { CardId, CardValue } from '../../minigames/card_duel/types';
import { cardById, cardsOfValue } from './index';
import { setDeckIds } from './set_lookup';

export interface CardOpponentDef {
  id: string;
  /** i18n key ids. Never English: src/sim/ stays language-agnostic. */
  nameId: string;
  titleId: string;
  /** One line when the match starts. */
  greetingId: string;
  difficulty: CardBotTier;
  /** The card ids this regular favours. The rest of the deck is filled from
   *  the catalog to keep the shape legal, so a themed list never has to
   *  enumerate all twenty slots by hand. */
  favours: readonly CardId[];
}

/**
 * Builds a legal deck from a preferred card list: each preferred card takes a
 * slot at its own value, and every remaining slot is filled from the catalog in
 * id order. The result always satisfies the shape rule, whatever the theme
 * asks for, so a themed list can never ship an unplayable regular.
 */
export function buildOpponentDeck(favours: readonly CardId[]): CardDeckEntry[] {
  const perValue = new Map<CardValue, CardDeckEntry[]>();
  for (const cardId of favours) {
    const def = cardById(cardId);
    if (!def) continue;
    const slots = perValue.get(def.value) ?? [];
    if (slots.length >= 2 || slots.some((entry) => entry.cardId === cardId)) continue;
    slots.push({ cardId: def.id, value: def.value });
    perValue.set(def.value, slots);
  }
  const deck: CardDeckEntry[] = [];
  for (let value = 1; value <= 10; value++) {
    const slots = perValue.get(value as CardValue) ?? [];
    for (const def of cardsOfValue(value as CardValue)) {
      if (slots.length >= 2) break;
      if (slots.some((entry) => entry.cardId === def.id)) continue;
      slots.push({ cardId: def.id, value: def.value });
    }
    deck.push(...slots);
  }
  return deck;
}

export const CARD_OPPONENTS: readonly CardOpponentDef[] = [
  {
    id: 'dockhand_pell',
    nameId: 'dockhand_pell',
    titleId: 'dockhand_pell',
    greetingId: 'dockhand_pell',
    difficulty: 'novice',
    // Mirefen Tide plus Roadknife Guild: reveals, discards, and hand
    // disruption. The gentlest sit-down at the table, and the one that teaches
    // a new player that information is worth something.
    favours: setDeckIds('mirefen_tide', 'roadknife_guild'),
  },
  {
    id: 'gravedigger_ossa',
    nameId: 'gravedigger_ossa',
    titleId: 'gravedigger_ossa',
    greetingId: 'gravedigger_ossa',
    difficulty: 'steady',
    // Gravebound Court plus Boneflame Host: the two Undead recursion lines,
    // cards that come back and grow with the graveyard.
    favours: setDeckIds('gravebound_court', 'boneflame_host'),
  },
  {
    id: 'huntsman_bregg',
    nameId: 'huntsman_bregg',
    titleId: 'huntsman_bregg',
    greetingId: 'huntsman_bregg',
    difficulty: 'sharp',
    // Briarpack plus Eastbrook Company: the pack gets stronger the longer the
    // match runs, and the handlers keep feeding it. The same pairing the
    // starter deck ships, played properly.
    favours: setDeckIds('briarpack', 'eastbrook_company'),
  },
  {
    id: 'the_card_master',
    nameId: 'the_card_master',
    titleId: 'the_card_master',
    greetingId: 'the_card_master',
    difficulty: 'master',
    // Ironward Assembly plus Relicguard Order: the wall at the top. Floors,
    // ceilings, silence, and a tie he wins, instead of bigger numbers.
    favours: setDeckIds('ironward_assembly', 'relicguard_order'),
  },
];

const BY_ID = new Map(CARD_OPPONENTS.map((def) => [def.id, def]));

export function cardOpponentById(id: string): CardOpponentDef | undefined {
  return BY_ID.get(id);
}
