// The thin consumer half of the card face: it turns a CardFaceModel into
// markup and does nothing else. Every number here was decided by
// card_face_view.ts and every string comes from card_i18n.ts.
//
// NOT named `*_painter.ts` on purpose. A painter in this repo writes DOM on the
// PainterHost seam under the per-frame write contract; this module writes no
// DOM at all. Every surface that shows a card face (the duel window's hand, the
// reveal stage, the deck builder's collection cells) is COLD and event-driven,
// rebuilding its own subtree behind an invalidation signature, so the face is
// markup those rebuilds insert. Calling it a painter would enter it into a gate
// whose contract it cannot meaningfully satisfy, and would say something false
// about its cadence.
//
// The animation lives entirely in CSS (transform and opacity only), so a
// graphics preset or reduced-motion setting can drop it without touching a
// single number here: information is never gated on an animation completing.

import type { CardCatalog } from '../../sim/minigames/card_duel/match_state';
import type { CardDefinition } from '../../sim/minigames/card_duel/types';
import { cardArtUrl } from '../card_art';
import { cardName, cardRulesText, cardRulesTextFrom, cardTribeName } from '../card_i18n';
import { esc } from '../esc';
import { formatNumber, t } from '../i18n';
import { type CardFaceModel, deltaLabel, rarityClass } from './card_face_view';
import { cardSceneSvg } from './card_scene_markup';
import { buildCardScene } from './card_scene_view';

/** A whole number as the player's locale writes it. */
function num(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/**
 * The art panel: the committed painting when one exists, otherwise the card's
 * own DRAWN SCENE (card_scene_view.ts).
 *
 * The fallback used to be a flat gradient keyed on tribe, and only five of the
 * twelve tribes had one, so two hundred cards rendered as roughly six coloured
 * rectangles. Since no painting has been commissioned yet, that fallback is
 * what every card in the game actually looks like: a hand of five was five
 * blanks a player could only tell apart by reading the name plate. The scene
 * is drawn from the card's setting, tribe and its own words instead, so a card
 * is recognisable as itself at a glance and at the hand size.
 *
 * Deterministic per card, and keyed on the ART id rather than the card id, so
 * two cards that deliberately share a painting also share a scene: that is
 * exactly what the separate `art` field on a CardDefinition means.
 */
function artPanel(model: CardFaceModel, def: CardDefinition | undefined): string {
  const url = cardArtUrl(model.art);
  if (url) {
    // Decorative: the name plate below is the accessible text, so an alt here
    // would just repeat it to a screen reader.
    return `<img class="cf-art" src="${esc(url)}" alt="" loading="lazy" decoding="async" />`;
  }
  // `def` is absent only for a card the catalog no longer knows (a retired id
  // in a saved deck). The scene is total over that too: no set and no tribe
  // still draws a place, which is the point of the fallback having no failure
  // case of its own.
  const scene = buildCardScene({
    key: model.art,
    tribes: model.tribes,
    tags: def?.tags,
    set: def?.set,
    rarity: model.rarity,
  });
  // The svg id namespace: SVG ids are DOCUMENT-global and a hand holds five of
  // these at once, so the gradients are namespaced per card or every face on
  // screen paints in the first one's sky. The SEED rather than the art id,
  // because the id is an internal string and the markup should not carry one
  // (tests/card_face_markup.test.ts holds that line for the player-visible
  // text, and this keeps it true of the attributes too); it is derived from
  // the art id, so cards that share a painting still share a namespace.
  return cardSceneSvg(scene, scene.seed.toString(36));
}

function tribeLine(model: CardFaceModel): string {
  if (model.tribes.length === 0) return '';
  const names = model.tribes.map((tribe) => esc(cardTribeName(tribe)));
  return `<div class="cf-tribes">${names.join('<span class="cf-tribe-sep">/</span>')}</div>`;
}

/**
 * The value expression: what the card is PRINTED at, what the effects did to
 * it, and what it is worth right now, read left to right as one sum.
 *
 * The three numbers were all on the face already and a player still could not
 * read them as a sentence: the effective value sat in the top-left corner, the
 * printed value hid behind it struck through (which reads as "void", not as
 * "was"), and the modifier sat in the OTHER corner, so working out where a 7
 * came from meant looking in two places and doing the arithmetic. On a card in
 * hand, which is the moment a player is choosing between five of them, that is
 * the one calculation the face exists to have already done.
 *
 * So it is one group: `5 +2 = 7`. The printed value leads because it is the
 * card's identity, the signed modifier is coloured because its DIRECTION is
 * the thing being read, and the effective value is last and largest because it
 * is what the comparison will actually use.
 *
 * Rendered at every graphics tier and on every device, with no hover
 * requirement, exactly as the separate pieces were: this is the same
 * information laid out to be read, never a new thing to reveal.
 */
function valueExpression(model: CardFaceModel): string {
  const effective = `<span class="cf-value">${esc(num(model.effectiveValue))}</span>`;
  // Unmodified: the printed value IS the effective value, and showing `5 + 0 =
  // 5` would be three ways of saying one number.
  if (model.delta === 0) return `<div class="cf-corner">${effective}</div>`;
  const kind = model.delta > 0 ? 'cf-delta-up' : 'cf-delta-down';
  // The group carries the accessible name, not the pieces: a screen reader
  // reading "five plus two equals seven" as three loose numbers is worse than
  // the one sentence the button's own name already gives. Same key the
  // modifier chip carried before the regroup, so no new string.
  const aria = t('cards.card.effectiveLabel', { value: num(model.effectiveValue) });
  return (
    `<div class="cf-corner cf-corner-sum" aria-label="${esc(aria)}">` +
    `<span class="cf-base" aria-hidden="true">${esc(num(model.baseValue))}</span>` +
    `<span class="cf-delta ${kind}" aria-hidden="true">${esc(deltaLabel(model))}</span>` +
    `<span class="cf-eq" aria-hidden="true">=</span>` +
    effective +
    `</div>`
  );
}

export interface CardFacePaintOptions {
  /** Marks the face as the play target the window wires a click to. */
  playAttribute?: string;
  /** Marks the face as inspectable: hover, focus or press-and-hold shows the
   *  whole card at a readable size (src/ui/cards/card_inspect.ts). Opt-in,
   *  because the enlarged copy is only worth showing over a face too small to
   *  carry its own rules sentence. */
  inspect?: boolean;
  catalog: CardCatalog;
}

/** Renders one card face as markup. */
export function cardFaceHtml(model: CardFaceModel, opts: CardFacePaintOptions): string {
  const def = opts.catalog.get(model.cardId);
  const name = def ? cardName(def) : t('cards.basicName', { value: model.baseValue });
  // Prefer the values the sim resolved against the live match; fall back to a
  // static reading only where none arrived (a collection cell, no match).
  const rules = !def
    ? ''
    : Object.keys(model.textValues).length > 0
      ? cardRulesTextFrom(def, model.textValues)
      : cardRulesText(def, { catalog: opts.catalog });
  const classes = [
    'cf',
    `cf-size-${model.size}`,
    rarityClass(model.rarity),
    model.playable ? 'cf-playable' : 'cf-locked',
    model.silenced ? 'cf-silenced' : '',
    model.revealed ? 'cf-revealed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const play = opts.playAttribute ? ` data-play="${model.iid}"` : '';
  const inspect = opts.inspect ? ` data-inspect="${model.iid}"` : '';
  const tag = opts.playAttribute ? 'button' : 'div';
  // The button's own name carries what the face cannot always show: the hand
  // size hides the rules sentence for want of room, and a hidden node is out of
  // the accessibility tree too, so the sentence rides the label instead. That is
  // also why the enlarged inspect popup is aria-hidden: this is the one reading.
  const label = rules
    ? t('cards.card.playDetail', { name, value: num(model.effectiveValue), rules })
    : t('cards.card.play', { name });
  const buttonBits = opts.playAttribute
    ? ` type="button"${model.playable ? '' : ' disabled'} aria-label="${esc(label)}"`
    : '';
  return (
    `<${tag} class="${classes}"${play}${inspect}${buttonBits}>` +
    `<div class="cf-frame">` +
    artPanel(model, def) +
    valueExpression(model) +
    `<div class="cf-plate"><div class="cf-name">${esc(name)}</div>${tribeLine(model)}</div>` +
    (rules ? `<div class="cf-rules">${esc(rules)}</div>` : '') +
    `</div>` +
    `</${tag}>`
  );
}
