// Card art resolution: the client half of the `art` id on a CardDefinition.
//
// The sim owns the ID and the client owns the PATH, which is what keeps
// src/sim/ free of client asset layout (it also runs headless and server-side,
// where /ui/cards/... means nothing). A card whose art has not been commissioned
// yet resolves to null and the face component paints its procedural fallback,
// so no card ever renders as a blank rectangle.

import { CARD_IMAGE_IDS } from './card_image_ids';

/** The served path for a committed card painting, or null when the art id has
 *  no file and the procedural face should be drawn instead. */
export function cardArtUrl(art: string): string | null {
  return CARD_IMAGE_IDS.has(art) ? `/ui/cards/${art}.webp` : null;
}

export function hasCardArt(art: string): boolean {
  return CARD_IMAGE_IDS.has(art);
}

export { CARD_IMAGE_IDS };
