// Rules-text VALUE resolution. This module returns a key id plus resolved
// numbers, NEVER a string.
//
// Two rules meet here. The i18n one: src/sim/ is language-agnostic, so a card
// carries key ids and the client calls t(). The tooltip one
// (docs/design/tooltip-writing.md): a scaling effect states the value it will
// actually apply, so "+1 for every two Beasts" shows the live number rather
// than the formula.
//
// What this module deliberately does NOT do is assemble a sentence out of the
// effect tree. Clause-order assembly translates badly into any language whose
// word order differs from English, and a machine-built sentence cannot be
// reviewed against the tooltip contract. Each card authors ONE whole sentence
// with placeholders; the effect tree only supplies the numbers.

import { type CardEvalContext, evaluateAmount } from './expressions';
import { buildBoard, type CardCatalog, createMatchState } from './match_state';
import type { CardDefinition } from './types';

/** A card's rules text, ready for `t(textId, values)`. */
export interface CardTextModel {
  textId: string;
  values: Record<string, number>;
}

/**
 * The values a card's effect tree can supply to its text.
 *
 * An effect names them explicitly with `textValues`. An effect that carries an
 * `amount` and names nothing also supplies `amount`, since that is what almost
 * every card's sentence wants and repeating it per card would be noise. Later
 * effects never overwrite an earlier effect's name: the first one wins, so the
 * placeholder a sentence reads is stable however the effect list grows.
 */
export function resolveCardTextValues(
  def: CardDefinition,
  ctx: CardEvalContext,
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const effect of def.effects) {
    if (effect.textValues) {
      for (const name of Object.keys(effect.textValues).sort()) {
        if (!(name in values)) values[name] = evaluateAmount(effect.textValues[name], ctx);
      }
      continue;
    }
    if ('amount' in effect.effect && !('amount' in values)) {
      // A negative authored amount reads as a positive number in the sentence
      // ("gets -{amount}"), because the sign belongs to the English, not the
      // data: a locale that words it as a reduction should not print a minus.
      values.amount = Math.abs(evaluateAmount(effect.effect.amount, ctx));
    }
  }
  return values;
}

export function resolveCardText(def: CardDefinition, ctx: CardEvalContext): CardTextModel {
  return { textId: def.textId, values: resolveCardTextValues(def, ctx) };
}

/**
 * An evaluation context for a card that is NOT in a live match: a collection
 * cell, a deck builder row, a wiki page. Scaling expressions read an empty
 * match, so "+1 for every two Beasts you have played" resolves to 0, which is
 * the honest answer before a match starts.
 */
export function staticCardContext(catalog: CardCatalog): CardEvalContext {
  const state = createMatchState(
    { deck: [], hand: [], discard: [] },
    { deck: [], hand: [], discard: [] },
  );
  return { state, board: buildBoard(state, catalog), catalog, seat: 'a', thisCard: null };
}
