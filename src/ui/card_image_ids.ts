// Card art ids with committed paintings under public/ui/cards/<art>.webp
// (384x512 portrait WebP, produced by scripts/convert_card_art_webp.mjs).
// GENERATED: do not hand-edit; re-run the script to regenerate. Imported by
// src/ui/card_art.ts, which falls back to the procedural card face for any art id
// that is not a member, so this list is allowed to be smaller than the catalog and
// empty while art is still being commissioned. tests/card_art.test.ts gates it
// against the committed .webp files (exact set equality, both directions).

export const CARD_IMAGE_IDS: ReadonlySet<string> = new Set([
]);
