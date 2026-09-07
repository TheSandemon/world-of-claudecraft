import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, cardById } from '../src/sim/content/cards';
import { cardFaceHtml } from '../src/ui/cards/card_face_markup';
import { buildCardFaceModel } from '../src/ui/cards/card_face_view';

const here = path.dirname(fileURLToPath(import.meta.url));
// The card face is styled by src/styles/cards.css, the one sheet BOTH the game
// client and the standalone /cards playtest slice load (see that file's header).
const CARDS_CSS = readFileSync(path.join(here, '..', 'src', 'styles', 'cards.css'), 'utf8');

// A value-3 Beast with rules text, and a value-6 card whose bonus SCALES: the
// two shapes the face has to render differently.
const WOLF_ID = 'briarpack_wolves_howl';
const SCALER_ID = 'briarpack_wolves_moonrun';
const wolf = cardById(WOLF_ID);
const scaler = cardById(SCALER_ID);

function faceOf(id: string, over: Parameters<typeof buildCardFaceModel>[2] = {}) {
  const def = cardById(id);
  return cardFaceHtml(
    buildCardFaceModel({ iid: 7, cardId: id, value: def?.value ?? 1 }, def, over),
    { catalog: CARD_CATALOG },
  );
}

describe('card face markup', () => {
  it('paints the name and rules text as real localized text, never a key id', () => {
    expect(wolf).toBeDefined();
    const html = faceOf(WOLF_ID);
    expect(html).toContain('Howl');
    expect(html).toContain('Beast');
    expect(html).not.toContain('cards.name.');
    expect(html).not.toContain('cards.text.');
    expect(html).not.toContain(WOLF_ID);
  });

  it('shows the effective value, and the printed value only when an effect moved it', () => {
    const plain = faceOf(WOLF_ID);
    expect(plain).toContain('cf-value');
    // Unmodified, the printed value IS the effective value: `3 + 0 = 3` would
    // be three ways of saying one number.
    expect(plain).not.toContain('cf-base');
    expect(plain).not.toContain('cf-delta');
    expect(plain).not.toContain('cf-eq');

    const buffed = faceOf(WOLF_ID, { effectiveValue: 5 });
    expect(buffed).toContain('cf-delta-up');
    expect(buffed).toContain('+2');
    // Both numbers are present at once: the player never has to remember what
    // the card was printed at to read what it is worth.
    expect(buffed).toContain('cf-base');
  });

  it('reads the three numbers as ONE sum: printed, what moved it, what it is now', () => {
    // The defect: all three were on the face and none of them read together.
    // The effective value sat in the top-left, the printed value hid BEHIND it
    // struck through, and the modifier sat in the opposite corner, so a player
    // choosing between cards in hand had to look in two places and do the
    // arithmetic the face exists to have already done.
    const buffed = faceOf(WOLF_ID, { effectiveValue: 5 });
    const sum = buffed.match(/<div class="cf-corner cf-corner-sum"[^>]*>(.*?)<\/div>/)?.[1] ?? '';
    expect(sum, 'no grouped sum in the corner').not.toBe('');
    // Order is the whole point: printed, signed modifier, equals, effective.
    const terms = [
      ...sum.matchAll(/class="(cf-base|cf-delta|cf-eq|cf-value)[^"]*"[^>]*>([^<]*)</g),
    ];
    expect(terms.map((m) => m[1])).toEqual(['cf-base', 'cf-delta', 'cf-eq', 'cf-value']);
    expect(terms.map((m) => m[2])).toEqual(['3', '+2', '=', '5']);
    // And it is one group to a screen reader rather than four loose numbers:
    // "three plus two equals five" read as digits is worse than the sentence
    // the button's own accessible name already carries.
    expect(sum).not.toContain('aria-hidden="true">5<');
    for (const cls of ['cf-base', 'cf-delta', 'cf-eq']) {
      expect(sum, `${cls} must be hidden from the reader`).toMatch(
        new RegExp(`class="${cls}[^"]*" aria-hidden="true"`),
      );
    }
  });

  it('shows a debuff as a signed subtraction, not an unexplained smaller number', () => {
    const nerfed = faceOf(WOLF_ID, { effectiveValue: 1 });
    expect(nerfed).toContain('cf-delta-down');
    expect(nerfed).toContain('-2');
    const sum = nerfed.match(/<div class="cf-corner cf-corner-sum"[^>]*>(.*?)<\/div>/)?.[1] ?? '';
    const terms = [
      ...sum.matchAll(/class="(?:cf-base|cf-delta|cf-eq|cf-value)[^"]*"[^>]*>([^<]*)</g),
    ];
    expect(terms.map((m) => m[1])).toEqual(['3', '-2', '=', '1']);
  });

  it("falls back to the card's DRAWN SCENE rather than a broken image or a blank", () => {
    const html = faceOf(WOLF_ID);
    // No paintings are committed yet, so every card in the game is on this
    // fallback today: it is the art, not a placeholder behind it.
    expect(html).not.toContain('<img');
    expect(html).toContain('cf-art-scene');
    expect(html).toContain('<svg');
    // A real scene, not an empty frame: the ground, a horizon prop and the
    // tribe's silhouette are all in it. The old fallback was a flat gradient
    // keyed on tribe that only five of the twelve tribes even had, so two
    // hundred cards rendered as about six coloured rectangles.
    expect(html).toContain('<rect');
    expect(html).toContain('<path');
    expect(html).not.toContain('undefined');
  });

  it('draws a visibly different scene for two different cards', () => {
    // Teeth: a fallback that is the same picture every time is the blank
    // rectangle again, wearing more markup.
    expect(faceOf(WOLF_ID)).not.toBe(faceOf('hollow_knight'));
  });

  it('prefers the values the sim resolved over a static re-derivation', () => {
    expect(scaler).toBeDefined();
    const live = cardFaceHtml(
      buildCardFaceModel(
        { iid: 3, cardId: SCALER_ID, value: 6, textValues: { rate: 1, amount: 4 } },
        scaler,
      ),
      { catalog: CARD_CATALOG },
    );
    // The wire values win over a static re-derivation: the card says +4 because
    // that is what the sim priced this round, not the 0 an empty match reads.
    expect(live).toContain('for each Pack you have');
    expect(live).toContain('+4');
  });

  it('escapes every interpolated string', () => {
    const nasty = { ...(wolf as NonNullable<typeof wolf>), id: '<script>', art: '"><img src=x' };
    const html = cardFaceHtml(buildCardFaceModel({ iid: 1, cardId: nasty.id, value: 3 }, nasty), {
      catalog: CARD_CATALOG,
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
  });

  it('renders as a button only when it is a play target', () => {
    const cell = faceOf(WOLF_ID, { size: 'cell' });
    expect(cell.startsWith('<div')).toBe(true);
    const def = cardById(WOLF_ID);
    const hand = cardFaceHtml(
      buildCardFaceModel({ iid: 7, cardId: WOLF_ID, value: 3 }, def, { playable: true }),
      { catalog: CARD_CATALOG, playAttribute: 'data-play' },
    );
    expect(hand.startsWith('<button')).toBe(true);
    expect(hand).toContain('data-play="7"');
    expect(hand).not.toContain('disabled');
  });

  it('disables the face while the player is waiting on the opponent', () => {
    const def = cardById(WOLF_ID);
    const locked = cardFaceHtml(
      buildCardFaceModel({ iid: 7, cardId: WOLF_ID, value: 3 }, def, { playable: false }),
      { catalog: CARD_CATALOG, playAttribute: 'data-play' },
    );
    expect(locked).toContain('disabled');
    expect(locked).toContain('cf-locked');
  });

  it('one component, three sizes: the size is a class, never different markup', () => {
    const hand = faceOf(WOLF_ID, { size: 'hand' });
    const stage = faceOf(WOLF_ID, { size: 'stage' });
    const cell = faceOf(WOLF_ID, { size: 'cell' });
    expect(hand).toContain('cf-size-hand');
    expect(stage).toContain('cf-size-stage');
    expect(cell).toContain('cf-size-cell');
    const strip = (html: string) => html.replace(/cf-size-\w+/, 'cf-size-X');
    expect(strip(stage)).toBe(strip(hand));
    expect(strip(cell)).toBe(strip(hand));
  });

  /**
   * Every declaration block whose selector list is exactly this one class, at
   * the sheet's top nesting level.
   *
   * ALL of them, not the first: `.cf-value` also appears as the last selector
   * of the shared `font-size: inherit` group, and taking the first match there
   * would silently test the wrong rule.
   */
  const rulesFor = (sel: string) => {
    const out: string[] = [];
    for (let at = CARDS_CSS.indexOf(`\n  .${sel} {`); at >= 0; ) {
      out.push(CARDS_CSS.slice(at, CARDS_CSS.indexOf('}', at)));
      at = CARDS_CSS.indexOf(`\n  .${sel} {`, at + 1);
    }
    return out;
  };
  /** The one that carries the colour. */
  const colourRuleFor = (sel: string) =>
    rulesFor(sel).find((rule) => rule.includes('color:')) ?? '';

  it('sizes the sum ONCE and tells its terms apart by colour alone', () => {
    // Three sizes read as a heading with footnotes. This is one expression
    // whose three parts are equally worth reading, so the size is set once on
    // the group and every term inherits it; colour carries the roles.
    expect(rulesFor('cf-corner').join('')).toContain('font-size:');
    const at = CARDS_CSS.indexOf('.cf-base,\n  .cf-delta,\n  .cf-eq,\n  .cf-value {');
    expect(at, 'the four terms must share one inherit rule').toBeGreaterThan(-1);
    expect(CARDS_CSS.slice(at, CARDS_CSS.indexOf('}', at))).toContain('font-size: inherit');
    // Teeth: no term may re-declare its own size, at any face size, or the
    // group stops being one declaration and the sizes drift apart again.
    for (const term of ['cf-base', 'cf-delta', 'cf-eq', 'cf-value']) {
      for (const rule of rulesFor(term)) {
        // `font-size: inherit` IS the contract; a concrete size is the drift.
        expect(rule, `${term} re-declares a size`).not.toMatch(/font-size:(?!\s*inherit\b)/);
      }
      expect(CARDS_CSS, `${term} is re-sized at some face size`).not.toContain(
        `.${term} {\n      font-size`,
      );
    }
  });

  it('paints the three roles white, green (or red) and gold', () => {
    // The printed value is plain white, the modifier is coloured by DIRECTION
    // (a debuff in the same green as a buff would be actively misleading), and
    // the value the round will compare takes the HUD's resolved-number gold.
    expect(colourRuleFor('cf-base')).toContain('var(--color-text-light)');
    expect(colourRuleFor('cf-delta-up')).toContain('var(--color-stat-bonus)');
    expect(colourRuleFor('cf-delta-down')).toContain('var(--color-debuff)');
    expect(colourRuleFor('cf-value')).toContain('var(--gold)');
    // Tokens, never literals (src/styles/CLAUDE.md).
    for (const sel of ['cf-base', 'cf-delta-up', 'cf-delta-down', 'cf-value']) {
      expect(colourRuleFor(sel), `${sel} hardcodes a colour`).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it('centres every word on the face, from the frame down', () => {
    // The name plate, the tribe line and the rules sentence all inherited the
    // default left alignment, so each face read as a centred picture sitting on
    // a ragged left-aligned column. Pinned on the FRAME because that is what
    // makes it total: a block added to the face later is centred by
    // construction rather than by remembering to add a fourth rule.
    const frameAt = CARDS_CSS.indexOf('\n  .cf-frame {');
    const frame = CARDS_CSS.slice(frameAt, CARDS_CSS.indexOf('}', frameAt));
    expect(frame).toContain('text-align: center');
    // And nothing below it puts the alignment back.
    for (const sel of ['cf-plate', 'cf-name', 'cf-tribes', 'cf-rules']) {
      const at = CARDS_CSS.indexOf(`\n  .${sel} {`);
      expect(at, `no rule for .${sel}`).toBeGreaterThan(-1);
      expect(CARDS_CSS.slice(at, CARDS_CSS.indexOf('}', at))).not.toContain('text-align: left');
    }
  });

  it('every class the markup mints has a rule in the stylesheet', () => {
    const html =
      faceOf(WOLF_ID, { effectiveValue: 5, revealed: true, silenced: true }) +
      faceOf('hollow_knight', { size: 'stage', effectiveValue: 6 }) +
      faceOf('grix_tunnelking', { size: 'cell' });
    const classes = new Set(
      [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    );
    for (const cls of classes) {
      expect(CARDS_CSS.includes(`.${cls}`), `no CSS rule for .${cls}`).toBe(true);
    }
  });
});
