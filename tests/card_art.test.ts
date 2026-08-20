import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/sim/content/cards';
import { cardArtUrl, hasCardArt } from '../src/ui/card_art';
import { CARD_IMAGE_IDS } from '../src/ui/card_image_ids';

// The card art gate. Cards are portrait rather than the square 128px icon, so
// they own their own directory, and the id list is generated from whatever is
// committed there (scripts/convert_card_art_webp.mjs).
//
// The asymmetry is deliberate and is the whole point of the fallback: the list
// may be SMALLER than the catalog (art is commissioned over time and a card
// with none renders its procedural face), but it may never be LARGER than the
// committed files, or a card would resolve to a 404 and paint a blank
// rectangle.

const here = path.dirname(fileURLToPath(import.meta.url));
const ART_DIR = path.join(here, '..', 'public', 'ui', 'cards');

function committedArtIds(): string[] {
  // An art tree, not a source tree: read with the plain fs API the sibling icon
  // gates use (tests/deed_icons.test.ts), not the .ts source walker.
  if (!existsSync(ART_DIR)) return [];
  return readdirSync(ART_DIR)
    .filter((f) => path.extname(f).toLowerCase() === '.webp')
    .map((f) => path.basename(f, '.webp'))
    .sort();
}

describe('card art', () => {
  it('CARD_IMAGE_IDS is an exact bijection with the committed webp files', () => {
    expect([...CARD_IMAGE_IDS].sort()).toEqual(committedArtIds());
  });

  it('the art tree holds WebP only', () => {
    if (!existsSync(ART_DIR)) return;
    const strays = readdirSync(ART_DIR).filter((f) => path.extname(f).toLowerCase() !== '.webp');
    expect(strays, `non-webp files committed under public/ui/cards: ${strays.join(', ')}`).toEqual(
      [],
    );
  });

  it('every wired art id belongs to a live card, so nothing ships unreferenced', () => {
    const live = new Set(CARDS.map((def) => def.art));
    for (const id of CARD_IMAGE_IDS) {
      expect(live.has(id), `${id}.webp is committed but no card references it`).toBe(true);
    }
  });

  it('resolves a committed painting to its served path and an uncommissioned one to null', () => {
    for (const def of CARDS) {
      if (hasCardArt(def.art)) {
        expect(cardArtUrl(def.art)).toBe(`/ui/cards/${def.art}.webp`);
      } else {
        // Null is the signal for the procedural face, never a broken path.
        expect(cardArtUrl(def.art)).toBeNull();
      }
    }
  });

  it('art ids are ids, never paths, so no client asset layout reaches the sim', () => {
    // The other half of this rule (no sim module spells the client art path at
    // all) is scanned in tests/card_duel_engine_guards.test.ts, which walks the
    // source tree through the shared walker.
    for (const def of CARDS) {
      expect(def.art).not.toContain('/');
      expect(def.art).not.toContain('.webp');
    }
  });
});
