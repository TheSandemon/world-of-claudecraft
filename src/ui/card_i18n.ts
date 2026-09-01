// Card name and rules-text localization: the ONE place a CardDefinition's key
// ids become player-visible text.
//
// The English source lives in the catalog (i18n.catalog/cards.ts) under
// `cards.name.*` and `cards.text.*`, and the locale fills ride the ordinary
// overlays like any other key. Routing every call site through here is what
// keeps the later split into per-locale chunks (the deed_i18n.ts /
// reliquary_i18n.ts model, worth its plumbing once the catalog runs to
// hundreds of cards) an internal change with no call site to touch.
//
// Rules text always resolves through the sim's text model, so the numbers a
// player reads are the ones the engine would apply (docs/design/tooltip-writing.md).

import { cardOpponentById } from '../sim/content/cards';
import { BASIC_CARD_NAME_ID } from '../sim/minigames/card_duel/basic_catalog';
import type { CardEvalContext } from '../sim/minigames/card_duel/expressions';
import type { CardCatalog } from '../sim/minigames/card_duel/match_state';
import { resolveCardText, staticCardContext } from '../sim/minigames/card_duel/text';
import type { CardDefinition, CardTribe } from '../sim/minigames/card_duel/types';
import { type TranslationKey, t } from './i18n';

/**
 * The localized name of a card.
 *
 * The ten unauthored basics are the one special case, and it is a real one:
 * they all share the single key id `basic` and one English sentence with the
 * face value spliced in, so `cards.name.basic` was never authored and asking
 * for it THROWS on the untracked key. Resolving it here rather than at each
 * call site is the whole point of this module: the standalone /cards table
 * deals basics by default, and the check being spelled in only some of the
 * surfaces that render a face is what broke it.
 */
export function cardName(def: CardDefinition): string {
  if (def.nameId === BASIC_CARD_NAME_ID) return t('cards.basicName', { value: def.value });
  return t(`cards.name.${def.nameId}` as TranslationKey);
}

/**
 * The localized name of one of the Card Master's regulars, by CONTENT id.
 *
 * A regular has no player meta, so its seat arrives with an empty player name
 * and this id instead. Resolving it here keeps the rule that a sim-side id
 * becomes text in exactly one module. An unknown id (a retired regular in an
 * old client) returns an empty string rather than throwing: a nameless seat is
 * survivable, a thrown window is not.
 */
export function cardOpponentName(opponentId: string): string {
  const def = cardOpponentById(opponentId);
  return def ? t(`cards.opponent.${def.nameId}.name` as TranslationKey) : '';
}

/** The localized tribe name, for the card face's tribe line. */
export function cardTribeName(tribe: CardTribe): string {
  return t(`cards.tribe.${tribe}` as TranslationKey);
}

/**
 * The localized rules text with live values spliced in. Pass the live
 * evaluation context during a match; omit it (with the catalog) for a
 * collection or deck-builder cell, where scaling effects resolve against an
 * empty match.
 */
export function cardRulesText(
  def: CardDefinition,
  ctx: CardEvalContext | { catalog: CardCatalog },
): string {
  if (def.textId === '') return t('cards.noRulesText');
  const live = 'state' in ctx ? ctx : staticCardContext(ctx.catalog);
  const model = resolveCardText(def, live);
  return t(`cards.text.${model.textId}` as TranslationKey, model.values);
}

/**
 * The same sentence, filled from values the SERVER already resolved against
 * the live match. The online client holds only its own projection, never the
 * match state a scaling effect reads, so those numbers arrive on the wire
 * rather than being re-derived here (and re-derived wrongly, as zero).
 */
export function cardRulesTextFrom(
  def: CardDefinition,
  values: Readonly<Record<string, number>>,
): string {
  if (def.textId === '') return t('cards.noRulesText');
  return t(`cards.text.${def.textId}` as TranslationKey, values);
}
