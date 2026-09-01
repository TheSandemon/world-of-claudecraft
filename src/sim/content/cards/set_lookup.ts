// Design-identity lookups, reading the identity modules DIRECTLY rather than
// the catalog barrel.
//
// That indirection is load-bearing, not stylistic. `opponents.ts` builds each
// regular's deck from two identities at module scope, and the barrel re-exports
// `opponents.ts`, so an identity lookup living in the barrel evaluates before
// the barrel's own `CARDS` exists and reads undefined. Hanging these two off
// `sets/` instead breaks the cycle by construction: nothing here imports the
// barrel, so nothing here can be caught half-initialized by it.

import type { CardDefinition, CardId, CardSetId } from '../../minigames/card_duel/types';
import { ALL_SET_CARDS } from './sets';

/** One design identity's complete run, low value first. The deck builder's
 *  identity filter and the Card Master's regulars both read this. */
export function cardsOfSet(set: CardSetId): readonly CardDefinition[] {
  return ALL_SET_CARDS.filter((def) => def.set === set).sort((a, b) => a.value - b.value);
}

/** The card ids of one or more identities, as a deck-building preference list.
 *  Two identities is exactly twenty cards, which is a whole legal deck. */
export function setDeckIds(...sets: readonly CardSetId[]): CardId[] {
  return sets.flatMap((set) => cardsOfSet(set).map((def) => def.id));
}
