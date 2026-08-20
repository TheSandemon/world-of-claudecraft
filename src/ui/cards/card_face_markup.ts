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
import { cardArtUrl } from '../card_art';
import { cardName, cardRulesText, cardRulesTextFrom, cardTribeName } from '../card_i18n';
import { esc } from '../esc';
import { formatNumber, t } from '../i18n';
import { type CardFaceModel, deltaLabel, rarityClass } from './card_face_view';

/** A whole number as the player's locale writes it. */
function num(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/**
 * The art panel: the committed painting when one exists, otherwise a
 * procedural panel keyed on the card's tribe and value, so a card with no
 * commissioned art still reads as a card rather than a blank rectangle.
 */
function artPanel(model: CardFaceModel): string {
  const url = cardArtUrl(model.art);
  if (url) {
    // Decorative: the name plate below is the accessible text, so an alt here
    // would just repeat it to a screen reader.
    return `<img class="cf-art" src="${esc(url)}" alt="" loading="lazy" decoding="async" />`;
  }
  const tribe = model.tribes[0] ?? 'none';
  return `<div class="cf-art cf-art-procedural" data-tribe="${esc(tribe)}" data-value="${model.baseValue}"></div>`;
}

function tribeLine(model: CardFaceModel): string {
  if (model.tribes.length === 0) return '';
  const names = model.tribes.map((tribe) => esc(cardTribeName(tribe)));
  return `<div class="cf-tribes">${names.join('<span class="cf-tribe-sep">/</span>')}</div>`;
}

/**
 * The modifier strip: what the effects did to this card, right now. Rendered
 * at every graphics tier and on every device, with no hover requirement.
 */
function modifierStrip(model: CardFaceModel): string {
  const label = deltaLabel(model);
  if (!label) return '';
  const kind = model.delta > 0 ? 'cf-delta-up' : 'cf-delta-down';
  const aria = t('cards.card.effectiveLabel', { value: num(model.effectiveValue) });
  return `<div class="cf-delta ${kind}" aria-label="${esc(aria)}">${esc(label)}</div>`;
}

export interface CardFacePaintOptions {
  /** Marks the face as the play target the window wires a click to. */
  playAttribute?: string;
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
  const tag = opts.playAttribute ? 'button' : 'div';
  const buttonBits = opts.playAttribute
    ? ` type="button"${model.playable ? '' : ' disabled'} aria-label="${esc(t('cards.card.play', { name }))}"`
    : '';
  // The effective value is the corner plate: it is what the comparison uses,
  // so it is the number that must be readable first. The printed value rides
  // beside it whenever an effect moved it.
  const cornerBase =
    model.delta === 0 ? '' : `<span class="cf-base">${esc(num(model.baseValue))}</span>`;
  return (
    `<${tag} class="${classes}"${play}${buttonBits}>` +
    `<div class="cf-frame">` +
    artPanel(model) +
    `<div class="cf-corner"><span class="cf-value">${esc(num(model.effectiveValue))}</span>${cornerBase}</div>` +
    modifierStrip(model) +
    `<div class="cf-plate"><div class="cf-name">${esc(name)}</div>${tribeLine(model)}</div>` +
    (rules ? `<div class="cf-rules">${esc(rules)}</div>` : '') +
    `</div>` +
    `</${tag}>`
  );
}
