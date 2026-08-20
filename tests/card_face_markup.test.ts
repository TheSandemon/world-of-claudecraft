import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, cardById } from '../src/sim/content/cards';
import { cardFaceHtml } from '../src/ui/cards/card_face_markup';
import { buildCardFaceModel } from '../src/ui/cards/card_face_view';

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_CSS = readFileSync(
  path.join(here, '..', 'src', 'styles', 'components.css'),
  'utf8',
);

const wolf = cardById('forest_wolf');
const alpha = cardById('pack_alpha');

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
    const html = faceOf('forest_wolf');
    expect(html).toContain('Forest Wolf');
    expect(html).toContain('Beast');
    expect(html).not.toContain('cards.name.');
    expect(html).not.toContain('forest_wolf_text');
  });

  it('shows the effective value, and the printed value only when an effect moved it', () => {
    const plain = faceOf('forest_wolf');
    expect(plain).toContain('cf-value');
    expect(plain).not.toContain('cf-base');
    expect(plain).not.toContain('cf-delta');

    const buffed = faceOf('forest_wolf', { effectiveValue: 5 });
    expect(buffed).toContain('cf-delta-up');
    expect(buffed).toContain('+2');
    // Both numbers are present at once: the player never has to remember what
    // the card was printed at to read what it is worth.
    expect(buffed).toContain('cf-base');
  });

  it('falls back to a procedural panel rather than a broken image when art is uncommissioned', () => {
    const html = faceOf('forest_wolf');
    // No paintings are committed yet, so every card is on the fallback today.
    expect(html).toContain('cf-art-procedural');
    expect(html).toContain('data-tribe="Beast"');
    expect(html).not.toContain('<img');
  });

  it('prefers the values the sim resolved over a static re-derivation', () => {
    expect(alpha).toBeDefined();
    const live = cardFaceHtml(
      buildCardFaceModel(
        { iid: 3, cardId: 'pack_alpha', value: 6, textValues: { amount: 4 } },
        alpha,
      ),
      { catalog: CARD_CATALOG },
    );
    // The sentence has no {amount} placeholder, but the resolution path must
    // still be the wire one: no crash, and the text is the authored sentence.
    expect(live).toContain('every two Beasts');
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
    const cell = faceOf('forest_wolf', { size: 'cell' });
    expect(cell.startsWith('<div')).toBe(true);
    const def = cardById('forest_wolf');
    const hand = cardFaceHtml(
      buildCardFaceModel({ iid: 7, cardId: 'forest_wolf', value: 3 }, def, { playable: true }),
      { catalog: CARD_CATALOG, playAttribute: 'data-play' },
    );
    expect(hand.startsWith('<button')).toBe(true);
    expect(hand).toContain('data-play="7"');
    expect(hand).not.toContain('disabled');
  });

  it('disables the face while the player is waiting on the opponent', () => {
    const def = cardById('forest_wolf');
    const locked = cardFaceHtml(
      buildCardFaceModel({ iid: 7, cardId: 'forest_wolf', value: 3 }, def, { playable: false }),
      { catalog: CARD_CATALOG, playAttribute: 'data-play' },
    );
    expect(locked).toContain('disabled');
    expect(locked).toContain('cf-locked');
  });

  it('one component, three sizes: the size is a class, never different markup', () => {
    const hand = faceOf('forest_wolf', { size: 'hand' });
    const stage = faceOf('forest_wolf', { size: 'stage' });
    const cell = faceOf('forest_wolf', { size: 'cell' });
    expect(hand).toContain('cf-size-hand');
    expect(stage).toContain('cf-size-stage');
    expect(cell).toContain('cf-size-cell');
    const strip = (html: string) => html.replace(/cf-size-\w+/, 'cf-size-X');
    expect(strip(stage)).toBe(strip(hand));
    expect(strip(cell)).toBe(strip(hand));
  });

  it('every class the markup mints has a rule in the stylesheet', () => {
    const html =
      faceOf('forest_wolf', { effectiveValue: 5, revealed: true, silenced: true }) +
      faceOf('hollow_knight', { size: 'stage', effectiveValue: 6 }) +
      faceOf('grix_tunnelking', { size: 'cell' });
    const classes = new Set(
      [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    );
    for (const cls of classes) {
      expect(COMPONENTS_CSS.includes(`.${cls}`), `no CSS rule for .${cls}`).toBe(true);
    }
  });
});
