// The ClaudeStone deck-building commands: save, select, and discard a deck.
//
// A sibling of social/card_duel.ts rather than more of it: these touch only the
// player's saved decks, never the live match, so they have no business inside
// the match orchestrator. Server-authoritative, like every other command body
// here: the shape rule is checked HERE, so a hand-built command can never seat
// an illegal deck.

import { CARD_CATALOG } from '../content/cards';
import {
  deckEntriesFrom,
  MAX_DECK_NAME_LENGTH,
  MAX_SAVED_DECKS,
  validateDeck,
} from '../minigames/card_duel';
import type { SimContext } from '../sim_context';

/**
 * Saves (or replaces) one named deck.
 *
 * Server-authoritative: the shape rule is checked HERE, not on the client, so
 * a hand-built command can never seat an illegal deck. A rejected save leaves
 * every stored deck untouched.
 */
export function saveCardDeck(
  ctx: SimContext,
  name: string,
  cardIds: readonly string[],
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DECK_NAME_LENGTH) {
    ctx.error(r.meta.entityId, 'That deck name will not fit on the card box.');
    return;
  }
  const state = r.meta.cards;
  const replacing = state.decks[trimmed] !== undefined;
  if (!replacing && Object.keys(state.decks).length >= MAX_SAVED_DECKS) {
    ctx.error(r.meta.entityId, 'You have no room for another deck.');
    return;
  }
  const verdict = validateDeck(deckEntriesFrom(cardIds, CARD_CATALOG), CARD_CATALOG);
  if (!verdict.ok) {
    // One message for every rejection: the builder's own layout is what
    // explains the rule, and a per-reason error would be a rules lecture in a
    // toast (docs/design/tooltip-writing.md).
    ctx.error(r.meta.entityId, 'A deck is twenty cards: two of each value, and no card twice.');
    return;
  }
  state.decks[trimmed] = [...cardIds];
  if (state.activeDeck === '') state.activeDeck = trimmed;
  // No confirmation line: the builder repaints from this same state, so a chat
  // toast would only repeat what the player is already looking at.
}

/** Picks which saved deck the next match deals. */
export function selectCardDeck(ctx: SimContext, name: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  if (!r.meta.cards.decks[name]) {
    ctx.error(r.meta.entityId, 'You have no deck by that name.');
    return;
  }
  r.meta.cards.activeDeck = name;
}

/** Removes a saved deck. The active pointer moves to whatever is left, or to
 *  nothing, in which case matches deal the default deck again. */
export function deleteCardDeck(ctx: SimContext, name: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const state = r.meta.cards;
  if (!state.decks[name]) {
    ctx.error(r.meta.entityId, 'You have no deck by that name.');
    return;
  }
  delete state.decks[name];
  if (state.activeDeck === name) state.activeDeck = Object.keys(state.decks).sort()[0] ?? '';
}
