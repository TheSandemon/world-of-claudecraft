// The thin consumer half of the default card art: a scene model in, one inline
// SVG out. It writes no DOM and makes no decisions; card_scene_view.ts decided
// every colour, position and shape name before this file was called.
//
// NOT named `*_painter.ts`, for the reason card_face_markup.ts gives: a painter
// in this repo writes DOM on the PainterHost seam under the per-frame write
// contract, and this emits a string that a cold rebuild inserts.
//
// INLINE SVG rather than an <img> or a data URI, for three reasons that all
// matter here. It inherits the card's own size at all four face sizes without a
// second asset per size; it costs no network round trip for two hundred cards
// that would otherwise be two hundred requests; and it is drawn with the
// setting's palette rather than baked, so the scene reads correctly against the
// frame in both themes.
//
// Everything is `aria-hidden`. The card's accessible name already carries its
// name, value and rules sentence (card_face_markup.ts), and a decorative
// backdrop announcing "a dragon over burning ground" to a screen reader would
// bury the three facts the player actually acts on.

import type {
  CardSceneHorizonKind,
  CardSceneModel,
  CardSceneMotifKind,
  CardSceneSubject,
} from './card_scene_view';

/** The panel's own coordinate space. 3:4, matching the committed paintings
 *  (384x512), so a card that later gains one changes nothing but the source. */
const W = 96;
const H = 128;
/** Where the ground meets the sky. Low enough that the subject stands against
 *  sky rather than against ground, which is what makes a silhouette read. */
const HORIZON_Y = 92;

/** Two decimal places, and never `-0`: the markup is compared byte-for-byte by
 *  the face-markup tests, so a stray sign flip would be a spurious diff. */
function n(value: number): string {
  const r = Math.round(value * 100) / 100;
  return String(r === 0 ? 0 : r);
}

/**
 * The subject silhouettes, drawn in a 40x40 box centred on (0, 0) and scaled by
 * the caller. Shapes rather than glyphs: a filled path reads at the hand size
 * (about 40px wide), where an outline would collapse into a smudge.
 */
const SUBJECT_PATHS: Record<Exclude<CardSceneSubject, 'none'>, string> = {
  // A profile: head and jaw forward on a raised neck, one wing swept up behind
  // the shoulder, body over two legs, tail trailing back. Drawn side-on rather
  // than facing the viewer, because a front-on dragon at 40px is a blob with
  // points on it, which is what the first pass of this shape was.
  dragon:
    'M20 -12 L11 -13 L7 -9 L14 -8 L8 -5 L2 -6 L-2 -1 L-6 -14 L-14 -20 L-11 -8 L-16 -12 L-13 -2 L-10 3 L-18 6 L-9 6 L-4 4 L-2 12 L-5 16 L1 16 L2 8 L6 12 L4 16 L10 16 L9 7 L4 2 L6 -3 L13 -5 L20 -9 Z',
  // Low body, head down, tail level: a wolf at a walk.
  wolf: 'M-17 12 L-14 0 L-6 -3 L4 -3 L12 -8 L15 -12 L17 -6 L13 -1 L15 12 L10 12 L8 4 L-4 4 L-6 12 L-11 12 L-12 4 Z',
  // A standing figure with a cloak. The shoulders MEET the head: a two-unit
  // gap between the two subpaths renders as a head floating over a cloak.
  human: 'M0 -19 A5 5 0 1 1 0 -9 A5 5 0 1 1 0 -19 Z M-8 -10 L8 -10 L12 16 L-12 16 Z',
  // Ribs and a skull: the same figure, hollowed.
  skeleton:
    'M0 -18 A5 5 0 1 1 0 -8 A5 5 0 1 1 0 -18 Z M-2 -7 L2 -7 L2 14 L-2 14 Z M-9 -3 L9 -3 L9 0 L-9 0 Z M-8 4 L8 4 L8 7 L-8 7 Z M-6 11 L-2 11 L-6 18 Z M6 11 L2 11 L6 18 Z',
  // Horns, hunched shoulders.
  demon: 'M-10 -16 L-6 -8 L6 -8 L10 -16 L7 -6 L12 2 L9 16 L-9 16 L-12 2 L-7 -6 Z',
  // Body and eight legs.
  spider:
    'M0 -4 A7 8 0 1 1 0 12 A7 8 0 1 1 0 -4 Z M-6 0 L-18 -8 M-6 4 L-19 2 M-6 8 L-17 13 M-5 11 L-13 19 M6 0 L18 -8 M6 4 L19 2 M6 8 L17 13 M5 11 L13 19',
  // A fish standing upright on fins.
  mudfin:
    'M0 -16 C9 -8 11 4 6 14 L-6 14 C-11 4 -9 -8 0 -16 Z M-6 14 L-14 19 L-3 17 Z M6 14 L14 19 L3 17 Z',
  // A mound with a snout coming out of it.
  burrower: 'M-18 16 C-14 2 -6 -4 0 -4 C6 -4 14 2 18 16 Z M0 -6 L4 -14 L-4 -14 Z',
  // Stacked blocks.
  golem:
    'M-9 -18 L9 -18 L9 -8 L-9 -8 Z M-13 -6 L13 -6 L13 6 L-13 6 Z M-9 8 L-2 8 L-2 18 L-9 18 Z M2 8 L9 8 L9 18 L2 18 Z',
  // A rising column with a core.
  elemental: 'M0 -19 C10 -10 13 2 8 17 L-8 17 C-13 2 -10 -10 0 -19 Z',
  // A hood with a head inside it and no feet, the hem torn into three tails
  // that trail off. The plain dome this replaced read as a headstone.
  spirit:
    'M0 -20 C10 -20 14 -10 12 1 L14 10 L9 6 L6 15 L2 8 L-2 15 L-6 6 L-11 10 L-9 1 C-11 -10 -10 -20 0 -20 Z',
  // A figure with a hat brim and a blade at the hip.
  bandit:
    'M-11 -14 L11 -14 L8 -11 L-8 -11 Z M0 -18 A4 4 0 1 1 0 -11 A4 4 0 1 1 0 -18 Z M-7 -11 L7 -11 L10 16 L-10 16 Z M9 0 L17 12',
};

/** Which subjects are drawn as strokes rather than fills (the spider's legs,
 *  the bandit's blade), so the path above is not filled into a blob. */
const STROKE_SUBJECTS: ReadonlySet<CardSceneSubject> = new Set(['spider', 'bandit']);

/**
 * The one lit detail inside a silhouette, drawn in the rim colour over the
 * body: the spirit's face in its hood, the dragon's eye, the golem's core.
 *
 * A second path rather than a subpath of the silhouette, because a subpath
 * inside a filled shape is invisible: it fills in the same colour as the body
 * it sits in. The spirit shipped that way for one pass and read as a
 * headstone, which is not a small miss on a card whose whole job is to be
 * recognisable at a glance. Only the subjects that need one have one.
 */
const SUBJECT_DETAIL: Partial<Record<CardSceneSubject, string>> = {
  spirit: 'M0 -15 A4 5 0 1 1 0 -5 A4 5 0 1 1 0 -15 Z',
  dragon: 'M11 -11 A1.4 1.4 0 1 1 11 -8 A1.4 1.4 0 1 1 11 -11 Z',
  golem: 'M-3 -2 L3 -2 L3 3 L-3 3 Z',
  demon: 'M-4 -4 L-1 -2 L-4 0 Z M4 -4 L1 -2 L4 0 Z',
  elemental: 'M0 -8 C4 -3 4 3 0 8 C-4 3 -4 -3 0 -8 Z',
};

/** Horizon props, drawn standing ON the horizon line: each path is written in a
 *  space whose origin is where it meets the ground. */
const HORIZON_PATHS: Record<CardSceneHorizonKind, string> = {
  pine: 'M0 0 L-6 0 L0 -22 L6 0 Z',
  stone: 'M-5 0 L-4 -9 L0 -12 L4 -9 L5 0 Z',
  headstone: 'M-4 0 L-4 -8 A4 4 0 0 1 4 -8 L4 0 Z',
  reed: 'M0 0 L-1 -14 M0 0 L3 -11 M0 0 L-4 -9',
  stalagmite: 'M-4 0 L0 -18 L4 0 Z',
  pillar: 'M-4 0 L-4 -20 L-5 -22 L5 -22 L4 -20 L4 0 Z',
  peak: 'M-11 0 L0 -26 L11 0 Z',
  post: 'M-1 0 L-1 -16 L1 -16 L1 0 Z M-5 -13 L5 -13 L5 -11 L-5 -11 Z',
  arch: 'M-9 0 L-9 -10 A9 9 0 0 1 9 -10 L9 0 L5 0 L5 -10 A5 5 0 0 0 -5 -10 L-5 0 Z',
};

/** Which props are strokes (the reeds are lines, not a shape). */
const STROKE_PROPS: ReadonlySet<CardSceneHorizonKind> = new Set(['reed']);

/** Motifs, in a 12x12 box centred on (0, 0). */
const MOTIF_PATHS: Record<CardSceneMotifKind, string> = {
  flame: 'M0 6 C-5 3 -4 -2 0 -6 C1 -3 3 -3 3 0 C5 -1 5 2 0 6 Z',
  moon: 'M2 -6 A6 6 0 1 0 2 6 A7 7 0 1 1 2 -6 Z',
  sun: 'M0 -4 A4 4 0 1 1 0 4 A4 4 0 1 1 0 -4 Z M0 -8 L0 -6 M0 6 L0 8 M-8 0 L-6 0 M6 0 L8 0',
  bolt: 'M1 -7 L-4 1 L-1 1 L-2 7 L4 -1 L1 -1 Z',
  rain: 'M0 -6 C3 -2 4 1 4 3 A4 4 0 1 1 -4 3 C-4 1 -3 -2 0 -6 Z',
  web: 'M0 -7 L0 7 M-7 0 L7 0 M-5 -5 L5 5 M5 -5 L-5 5 M0 -3 L3 0 L0 3 L-3 0 Z',
  bone: 'M-6 -4 A2 2 0 1 1 -3 -1 L3 1 A2 2 0 1 1 6 4 A2 2 0 1 1 3 5 L-3 3 A2 2 0 1 1 -6 -4 Z',
  coin: 'M0 -6 A6 6 0 1 1 0 6 A6 6 0 1 1 0 -6 Z M0 -3 A3 3 0 1 0 0 3 A3 3 0 1 0 0 -3 Z',
  blade: 'M-1 7 L-1 -3 L0 -7 L1 -3 L1 7 Z M-4 3 L4 3 L4 4 L-4 4 Z',
  shield: 'M0 -7 L6 -4 L6 2 C6 5 3 7 0 8 C-3 7 -6 5 -6 2 L-6 -4 Z',
  crown: 'M-7 4 L-7 -4 L-3 0 L0 -6 L3 0 L7 -4 L7 4 Z',
  scroll: 'M-5 -6 L5 -6 L5 6 L-5 6 Z M-3 -3 L3 -3 M-3 0 L3 0 M-3 3 L1 3',
  lantern: 'M-3 -6 L3 -6 L4 4 L-4 4 Z M-1 -8 L1 -8 L1 -6 L-1 -6 Z',
  star: 'M0 -7 L2 -2 L7 -2 L3 1 L5 6 L0 3 L-5 6 L-3 1 L-7 -2 L-2 -2 Z',
  leaf: 'M0 7 C-6 2 -6 -4 0 -7 C6 -4 6 2 0 7 Z M0 6 L0 -5',
  cup: 'M-5 -5 L5 -5 L4 1 A4 4 0 0 1 -4 1 Z M0 3 L0 6 M-4 6 L4 6',
};

/** Which motifs are strokes (line work rather than a filled shape). */
const STROKE_MOTIFS: ReadonlySet<CardSceneMotifKind> = new Set(['web', 'sun', 'scroll', 'cup']);

/**
 * Draws one card's default art.
 *
 * Layered back to front, which is the whole reason it reads as a place rather
 * than as a pile of shapes: sky, stars, ground, horizon props, the glow behind
 * the subject, the subject, then the motifs in front of it.
 *
 * `id` namespaces the gradient definitions. Several faces are on screen at once
 * (a hand of five, a collection page of forty) and SVG ids are DOCUMENT-global,
 * so a shared id would silently paint every card in the first one's sky.
 */
export function cardSceneSvg(scene: CardSceneModel, id: string): string {
  const p = scene.palette;
  const glowId = `cs-glow-${id}`;
  const parts: string[] = [];

  // The SKY is a CSS background on the <svg> itself rather than a defs
  // gradient plus a full-bleed rect: same picture, about a fifth less markup,
  // and one fewer document-global id to namespace. The GLOW stays an SVG
  // gradient because it is positioned against the subject, which moves.
  parts.push(
    `<defs>` +
      `<radialGradient id="${glowId}">` +
      `<stop offset="0" stop-color="${p.accent}" stop-opacity="0.55"/>` +
      `<stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>` +
      `</radialGradient>` +
      `</defs>`,
  );

  // Stars, placed from the scene's own seed so the sky is this card's sky.
  if (scene.stars > 0) {
    let s = scene.seed || 1;
    const next = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 0x100000000;
    };
    // ONE path of round-capped zero-length dashes rather than a `<circle>`
    // each. A dozen circle elements was the longest run of markup on the card,
    // and the deck builder paints the whole catalog at once.
    const dots: string[] = [];
    for (let i = 0; i < scene.stars; i++) {
      dots.push(`M${n(next() * W)} ${n(next() * (HORIZON_Y - 20))}h.01`);
    }
    parts.push(
      `<path d="${dots.join('')}" stroke="${p.subjectRim}" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>`,
    );
  }

  // The glow the subject stands against: it is what separates a dark
  // silhouette from a dark sky at the hand size.
  parts.push(
    `<ellipse cx="${n(W / 2 + scene.subjectShift)}" cy="${HORIZON_Y - 18}" rx="34" ry="28" fill="url(#${glowId})"/>`,
  );

  // The ground, with a lit lip along the horizon.
  parts.push(
    `<rect y="${HORIZON_Y}" width="${W}" height="${H - HORIZON_Y}" fill="${p.ground}"/>` +
      `<rect y="${HORIZON_Y}" width="${W}" height="1.5" fill="${p.groundEdge}"/>`,
  );

  // Horizon props, behind the subject and in the dimmer horizon colour.
  const props = scene.horizon.map((prop) => {
    const path = HORIZON_PATHS[prop.kind];
    const paint = STROKE_PROPS.has(prop.kind)
      ? `fill="none" stroke="${p.horizon}" stroke-width="${n(1.6 / prop.scale)}" stroke-linecap="round"`
      : `fill="${p.horizon}"`;
    return `<path d="${path}" ${paint} transform="translate(${n((prop.x / 100) * W)} ${HORIZON_Y}) scale(${n(prop.scale)})"/>`;
  });
  if (props.length > 0) parts.push(`<g opacity="0.95">${props.join('')}</g>`);

  // The subject, standing on the horizon.
  if (scene.subject !== 'none') {
    const path = SUBJECT_PATHS[scene.subject];
    const paint = STROKE_SUBJECTS.has(scene.subject)
      ? `fill="${p.subject}" stroke="${p.subject}" stroke-width="${n(2 / scene.subjectScale)}" stroke-linecap="round" stroke-linejoin="round"`
      : `fill="${p.subject}"`;
    // Anchored so the FEET land on the horizon at any scale. Anchoring the
    // centre instead (which is what a fixed offset does) floats a large
    // silhouette off the ground and buries a small one in it.
    const place = `translate(${n(W / 2 + scene.subjectShift)} ${n(HORIZON_Y - 17 * scene.subjectScale)}) scale(${n(scene.subjectScale)})`;
    const detail = SUBJECT_DETAIL[scene.subject];
    const subjectId = `cs-s-${id}`;
    parts.push(
      // Drawn twice: the rim is the same path offset a pixel up-left behind the
      // body, which is the cheapest way to keep a near-black silhouette from
      // disappearing into a near-black sky.
      //
      // The second copy is a `<use>` rather than the path again. These are the
      // longest strings in the file (the dragon is a 24-point outline) and the
      // deck builder paints the WHOLE catalog at once, so emitting each twice
      // was about a fifth of the markup for a picture nobody can see twice.
      `<g transform="${place}">` +
        `<path id="${subjectId}" d="${path}"/>` +
        `<use href="#${subjectId}" fill="none" stroke="${p.subjectRim}" stroke-width="${n(2.4 / scene.subjectScale)}" stroke-linejoin="round" opacity="0.55" transform="translate(-1 -1)"/>` +
        `<use href="#${subjectId}" ${paint}/>` +
        (detail ? `<path d="${detail}" fill="${p.subjectRim}" opacity="0.75"/>` : '') +
        `</g>`,
    );
  }

  // The motifs, in front of everything: they are what the card is about.
  //
  // Each is defined ONCE and drawn twice through `<use>`: a dark backing pass
  // offset under it, then the lit one. The backing is what lets an accent
  // motif read against the brightest part of the sky, which is exactly where
  // the motifs sit; emitting the path twice to get it would have doubled the
  // most numerous shape on the card for no visible gain.
  const motifs = scene.motifs.map((motif) => {
    const path = MOTIF_PATHS[motif.kind];
    const stroke = STROKE_MOTIFS.has(motif.kind);
    const paint = (color: string) =>
      stroke
        ? `fill="none" stroke="${color}" stroke-width="${n(1.4 / motif.scale)}" stroke-linecap="round" stroke-linejoin="round"`
        : `fill="${color}"`;
    const place = `transform="translate(${n((motif.x / 100) * W)} ${n((motif.y / 100) * H)}) scale(${n(motif.scale)})"`;
    // Two plain paths rather than a defs entry and two `<use>`s: a motif path
    // is a dozen points, so an id plus a reference costs more than the copy it
    // saves. The subject above goes the other way for the same reason pointed
    // in the other direction.
    return (
      `<g ${place}>` +
      `<path d="${path}" ${paint('#000000')} opacity="0.35" transform="translate(0.8 0.8)"/>` +
      `<path d="${path}" ${paint(p.accent)} opacity="0.95"/>` +
      `</g>`
    );
  });
  if (motifs.length > 0) parts.push(motifs.join(''));

  return (
    `<svg class="cf-art cf-art-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ` +
    `style="background:linear-gradient(${p.skyTop},${p.skyBottom})" ` +
    // No xmlns: this is inline SVG in an HTML document, where the parser
    // already puts it in the SVG namespace, and it is 42 bytes per card.
    `aria-hidden="true" focusable="false">${parts.join('')}</svg>`
  );
}
