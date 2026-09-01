// Pure view-core for the ClaudeStone card face: one component, three sizes (the
// hand, the reveal stage, a collection cell), same model and same markup.
//
// DOM-free and i18n-free: it resolves ids and numbers, and card_face_markup.ts
// resolves the text through card_i18n.ts. tests/card_face_view.test.ts drives
// it directly with plain data, which is the same shape whether it came from Sim
// or ClientWorld.
//
// The rule this core exists to hold: every number a player acts on is decided
// HERE and is present the instant the snapshot arrives. The face may animate
// over it, but nothing is ever gated on an animation finishing.

import type { CardDefinition, CardRarity, CardTribe } from '../../sim/minigames/card_duel/types';
import type { CardMinigameCard } from '../../sim/social/card_duel';

/** Which size the face paints at. Same markup for all four; only the CSS
 *  variant differs. `inspect` is the enlarged copy the card inspector shows
 *  over a face too small to carry its own rules sentence. */
export type CardFaceSize = 'hand' | 'stage' | 'cell' | 'inspect';

export interface CardFaceModel {
  iid: number;
  cardId: string;
  /** Art id, resolved to a file (or the procedural fallback) by the painter. */
  art: string;
  nameId: string;
  /** Empty for a card with no rules text (the unauthored basics). */
  textId: string;
  /** Resolved placeholders for the rules sentence. */
  textValues: Record<string, number>;
  /** The printed number. */
  baseValue: number;
  /** The number the comparison would use right now. */
  effectiveValue: number;
  /** effectiveValue - baseValue: what the modifiers did, signed. */
  delta: number;
  tribes: readonly CardTribe[];
  rarity: CardRarity;
  size: CardFaceSize;
  /** The player may commit this card right now. */
  playable: boolean;
  /** The opponent is entitled to see this card (a reveal effect fired). */
  revealed: boolean;
  /** This card's own effects are suppressed for the round. */
  silenced: boolean;
  /** True when the definition is missing (a retired id in an old save): the
   *  face still paints, from the instance alone. */
  unknown: boolean;
}

export interface CardFaceOptions {
  size?: CardFaceSize;
  /** The live comparison value, when the card is on the board. Defaults to the
   *  printed value, which is what a card in hand is worth. */
  effectiveValue?: number;
  playable?: boolean;
  revealed?: boolean;
  silenced?: boolean;
}

/**
 * Builds the face model for one card instance.
 *
 * `def` may be undefined: a retired card id must still render (as its number
 * and nothing else) rather than throwing or painting a blank rectangle.
 */
export function buildCardFaceModel(
  card: CardMinigameCard,
  def: CardDefinition | undefined,
  opts: CardFaceOptions = {},
): CardFaceModel {
  const effectiveValue = opts.effectiveValue ?? card.value;
  return {
    iid: card.iid,
    cardId: card.cardId,
    // With no definition the art id falls back to the card id, which resolves
    // to no file and therefore to the procedural face.
    art: def?.art ?? card.cardId,
    nameId: def?.nameId ?? '',
    textId: def?.textId ?? '',
    textValues: card.textValues ? { ...card.textValues } : {},
    baseValue: card.value,
    effectiveValue,
    delta: effectiveValue - card.value,
    tribes: def?.tribes ?? [],
    rarity: def?.rarity ?? 'common',
    size: opts.size ?? 'hand',
    playable: opts.playable ?? false,
    revealed: opts.revealed ?? false,
    silenced: opts.silenced ?? false,
    unknown: def === undefined,
  };
}

/**
 * The repaint signature for one face: every field a viewer can act on. Two
 * models with the same signature paint identically, so a window can skip the
 * rebuild without ever holding a stale number.
 */
export function cardFaceSignature(model: CardFaceModel): string {
  const values = Object.keys(model.textValues)
    .sort()
    .map((key) => `${key}=${model.textValues[key]}`)
    .join(',');
  return [
    model.iid,
    model.cardId,
    model.baseValue,
    model.effectiveValue,
    model.size,
    model.playable ? 'p' : '-',
    model.revealed ? 'r' : '-',
    model.silenced ? 's' : '-',
    model.tribes.join('/'),
    values,
  ].join('|');
}

/** The CSS class for a rarity frame. Rarity reuses the shipped item-quality
 *  colors rather than introducing a second color vocabulary. */
export function rarityClass(rarity: CardRarity): string {
  return `cf-rarity-${rarity}`;
}

/** The sign-prefixed delta a player reads ("+2", "-3"), or an empty string
 *  when nothing changed the value. Never hidden and never delayed: it is the
 *  single most actionable number on the face. */
export function deltaLabel(model: CardFaceModel): string {
  if (model.delta === 0) return '';
  return model.delta > 0 ? `+${model.delta}` : String(model.delta);
}
