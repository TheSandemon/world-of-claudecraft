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
    expect(plain).not.toContain('cf-base');
    expect(plain).not.toContain('cf-delta');

    const buffed = faceOf(WOLF_ID, { effectiveValue: 5 });
    expect(buffed).toContain('cf-delta-up');
    expect(buffed).toContain('+2');
    // Both numbers are present at once: the player never has to remember what
    // the card was printed at to read what it is worth.
    expect(buffed).toContain('cf-base');
  });

  it('falls back to a procedural panel rather than a broken image when art is uncommissioned', () => {
    const html = faceOf(WOLF_ID);
    // No paintings are committed yet, so every card is on the fallback today.
    expect(html).toContain('cf-art-procedural');
    expect(html).toContain('data-tribe="Beast"');
    expect(html).not.toContain('<img');
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
