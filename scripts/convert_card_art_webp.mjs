// Ingest delivered Card Duel card paintings to shipping WebP, and regenerate
// the id list the client imports.
//
// Cards are PORTRAIT, not the square 128px icon, so they get their own
// directory and sizing rather than riding public/ui/items/. A delivery is one
// image per art id named exactly `<art>.<ext>`; each is fitted to a
// CARD_WIDTH x CARD_HEIGHT WebP under public/ui/cards/<art>.webp, and
// src/ui/card_image_ids.ts is rewritten from whatever ends up committed there.
//
// The art id is NOT the card id (docs/prd/card-duel-v2.md section 3): several
// cards may share one painting, so an art id is orphaned only when NO card
// references it. Ids no live card references are skipped with a log.
//
// A card with no committed painting is not an error: it renders the procedural
// face keyed on tribe and value (src/ui/card_art.ts), so the set is allowed to
// be smaller than the catalog, and empty while the art is still being
// commissioned. It may never be LARGER: tests/card_art.test.ts gates the
// generated list against the committed files in both directions.
//
// Usage:  node scripts/convert_card_art_webp.mjs [source-dir]
//   With no source dir it only regenerates the id list from the committed
//   files, which is the idempotent no-op a contributor runs after deleting art.
//
// The content module is loaded through esbuild exactly like
// scripts/convert_deed_icons_webp.mjs (never import raw .ts under node).
// Deterministic: same sources in, byte-identical output.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import sharp from 'sharp';

const root = process.cwd();
const OUT_DIR = path.join(root, 'public/ui/cards');
const MODULE_FILE = path.join(root, 'src/ui/card_image_ids.ts');

// Portrait card face. 384x512 is the 3:4 the face component paints at its
// largest (the reveal stage) on a 2x display; the hand and collection sizes
// are CSS downscales of the same file.
const CARD_WIDTH = 384;
const CARD_HEIGHT = 512;
const WEBP_OPTIONS = { quality: 82, alphaQuality: 100, smartSubsample: true, effort: 6 };
const SOURCE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** Every art id the live catalog references. */
async function liveArtIds() {
  const built = await esbuild.build({
    stdin: {
      contents: `export { CARDS } from './src/sim/content/cards/index.ts';`,
      resolveDir: root,
      sourcefile: 'cards-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`;
  const { CARDS } = await import(dataUrl);
  return new Set(CARDS.map((def) => def.art));
}

function moduleText(ids) {
  const lines = ids.map((id) => `  '${id}',`).join('\n');
  return `// Card art ids with committed paintings under public/ui/cards/<art>.webp
// (${CARD_WIDTH}x${CARD_HEIGHT} portrait WebP, produced by scripts/convert_card_art_webp.mjs).
// GENERATED: do not hand-edit; re-run the script to regenerate. Imported by
// src/ui/card_art.ts, which falls back to the procedural card face for any art id
// that is not a member, so this list is allowed to be smaller than the catalog and
// empty while art is still being commissioned. tests/card_art.test.ts gates it
// against the committed .webp files (exact set equality, both directions).

export const CARD_IMAGE_IDS: ReadonlySet<string> = new Set([
${lines}${lines ? '\n' : ''}]);
`;
}

const srcArg = process.argv[2];
const live = await liveArtIds();
mkdirSync(OUT_DIR, { recursive: true });

const converted = [];
const orphans = [];
if (srcArg) {
  const srcDir = path.resolve(srcArg);
  if (!existsSync(srcDir)) {
    console.error(`[assets:cards] source dir not found: ${srcDir}`);
    process.exit(1);
  }
  const files = readdirSync(srcDir)
    .filter((f) => SOURCE_EXTS.has(path.extname(f).toLowerCase()))
    .sort();
  for (const file of files) {
    const id = path.basename(file, path.extname(file));
    if (!live.has(id)) {
      orphans.push(id);
      continue;
    }
    const buf = await sharp(path.join(srcDir, file))
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover', position: 'centre' })
      .webp(WEBP_OPTIONS)
      .toBuffer();
    writeFileSync(path.join(OUT_DIR, `${id}.webp`), buf);
    converted.push(id);
  }
}

const committed = readdirSync(OUT_DIR)
  .filter((f) => path.extname(f).toLowerCase() === '.webp')
  .map((f) => path.basename(f, '.webp'))
  .sort();
writeFileSync(MODULE_FILE, moduleText(committed));

const missing = [...live].filter((id) => !committed.includes(id)).sort();
console.log(
  `[assets:cards] converted ${converted.length}, skipped ${orphans.length} orphan(s); ` +
    `${committed.length} committed painting(s), ${missing.length} art id(s) on the procedural fallback`,
);
if (orphans.length)
  console.log(`  orphans (no card references them): ${orphans.sort().join(', ')}`);
if (missing.length) console.log(`  procedural fallback: ${missing.join(', ')}`);
