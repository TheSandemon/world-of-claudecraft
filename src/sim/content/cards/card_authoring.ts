// The two shorthands every card module in sets/ is written with.
//
// They exist so twenty identity modules share one spelling instead of each
// re-declaring the same two helpers, and so a reader of any card sees the same
// two words. Neither adds behavior: `card` is an identity function that only
// pins the record's type at its authoring site, and `constant` is the numeric
// literal wrapper the expression grammar wants.

import type { CardDefinition, CardNumericExpr } from '../../minigames/card_duel/types';

/** Type-pins one card record where it is written, so a typo is a compile error
 *  at the card rather than a widened union at the array. */
export const card = (def: CardDefinition): CardDefinition => def;

/** A fixed number, as the expression grammar spells it. */
export const constant = (value: number): CardNumericExpr => ({ type: 'constant', value });
