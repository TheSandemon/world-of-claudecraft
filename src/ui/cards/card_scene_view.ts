// Pure view-core for the DEFAULT card art: the scene a card describes, decided
// from the card itself.
//
// Every ClaudeStone card falls back to procedural art until a painting is
// commissioned (src/ui/card_art.ts), and today none of the two hundred has one,
// so the fallback IS the art. It used to be a flat gradient keyed on tribe, and
// only five of the twelve tribes even had a colour: two hundred cards rendered
// as about six coloured rectangles, which is a card that tells a player nothing
// about itself and cannot be told apart from the card beside it in a hand.
//
// So the fallback draws the SCENE instead, and it reads the scene off the card:
//
//   - the SETTING comes from the design identity and the tags (Ashen Flight
//     burns, Mirefen floods, Tunnel Crown is underground),
//   - the SUBJECT is the tribe's silhouette (a dragon, a wolf, a skeleton),
//   - the MOTIFS come from the words in the card's own id, which is where the
//     card says what it is about: `boneflame_host_pyre_night` gets a pyre and a
//     moon because it says pyre and night.
//
// DOM-free and i18n-free: it returns a model of shapes and colours, and
// card_scene_markup.ts turns that into SVG. Deterministic by construction, from
// a hash of the card's own key: the same card is the same picture in every
// hand, every session and every host, with no wall clock and no Math.random
// anywhere in it. That matters beyond tidiness, because a card a player is
// learning to recognise must not be redrawn differently the next time they see
// it.

import type {
  CardRarity,
  CardSetId,
  CardTag,
  CardTribe,
} from '../../sim/minigames/card_duel/types';

/** The ground a scene stands on, and the sky over it. */
export type CardSceneSetting =
  | 'ember'
  | 'forest'
  | 'moor'
  | 'grave'
  | 'mire'
  | 'under'
  | 'vault'
  | 'storm'
  | 'road'
  | 'hall';

/** The figure the scene is about: one silhouette per tribe, plus the empty
 *  case for a card with no tribe at all (the unauthored basics). */
export type CardSceneSubject =
  | 'dragon'
  | 'wolf'
  | 'human'
  | 'skeleton'
  | 'demon'
  | 'spider'
  | 'mudfin'
  | 'burrower'
  | 'golem'
  | 'elemental'
  | 'spirit'
  | 'bandit'
  | 'none';

/** What stands on the horizon behind the subject. */
export type CardSceneHorizonKind =
  | 'pine'
  | 'stone'
  | 'headstone'
  | 'reed'
  | 'stalagmite'
  | 'pillar'
  | 'peak'
  | 'post'
  | 'arch';

/** A small thing in the air or the foreground, read off the card's own words. */
export type CardSceneMotifKind =
  | 'flame'
  | 'moon'
  | 'sun'
  | 'bolt'
  | 'rain'
  | 'web'
  | 'bone'
  | 'coin'
  | 'blade'
  | 'shield'
  | 'crown'
  | 'scroll'
  | 'lantern'
  | 'star'
  | 'leaf'
  | 'cup';

export interface CardScenePalette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundEdge: string;
  /** The subject silhouette, and the rim light down one side of it. */
  subject: string;
  subjectRim: string;
  /** Horizon props, always dimmer than the subject: depth is what stops a
   *  scene reading as a sticker sheet. */
  horizon: string;
  /** Motifs and the glow behind the subject. */
  accent: string;
}

export interface CardSceneProp {
  kind: CardSceneHorizonKind;
  /** Percent across the panel, 0 to 100. */
  x: number;
  /** Multiplier on the prop's nominal height. */
  scale: number;
}

export interface CardSceneMotif {
  kind: CardSceneMotifKind;
  x: number;
  y: number;
  scale: number;
}

export interface CardSceneModel {
  setting: CardSceneSetting;
  palette: CardScenePalette;
  subject: CardSceneSubject;
  /** Size and horizontal offset of the subject, so two Dragons are not the
   *  same picture at the same scale. */
  subjectScale: number;
  subjectShift: number;
  horizon: CardSceneProp[];
  motifs: CardSceneMotif[];
  /** Stars in the sky, for the settings that have one. Count only; the markup
   *  places them from the same seed. */
  stars: number;
  /** The hash the whole scene was derived from. Carried so the markup can vary
   *  anything else it needs to without a second hash of its own. */
  seed: number;
}

export interface CardSceneInput {
  /** The string the scene is derived from: the card's art id, which is what
   *  the catalog means by "which painting is this". Cards that SHARE an art id
   *  deliberately share a scene, which is the whole reason art is a separate
   *  field from the card id. */
  key: string;
  tribes?: readonly CardTribe[];
  tags?: readonly CardTag[];
  set?: CardSetId;
  rarity?: CardRarity;
}

// ---------------------------------------------------------------------------
// The deterministic seed
// ---------------------------------------------------------------------------

/** FNV-1a over the key. Cheap, stable across hosts, and good enough to
 *  decorrelate the handful of small decisions below. */
function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A tiny deterministic stream off that hash.
 *
 * Not `Rng` from src/sim: this is presentation, it never touches the
 * simulation, and pulling the sim's generator in here would put a card's
 * PICTURE on the same draw order as the game's outcomes. It is still seeded
 * and reproducible, which is the property the art actually needs.
 */
function stream(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

/** One hex channel triple. */
function parseHex(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** `a` moved `t` of the way towards `b`. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/**
 * The HOUR the scene is set at, as a shift applied to the setting's sky.
 *
 * A design identity is ten cards, and without this every one of them was the
 * same sky over the same ground: the set read as one picture repeated, which
 * is most of the way back to the coloured rectangles this replaced. Shifting
 * the sky per card (towards night, or towards the setting's own accent for a
 * low sun) gives ten cards in one identity ten recognisably different skies
 * while keeping them unmistakably the same place.
 *
 * Applied to the SKY only. The ground, the subject and the accent stay put,
 * because those are what say which set a card belongs to.
 */
function shiftSky(palette: CardScenePalette, t: number): CardScenePalette {
  // t in [0,1): 0 is deep night, 0.5 the setting's own hour, 1 a low bright sun.
  const night = '#05060a';
  const sky =
    t < 0.5
      ? {
          skyTop: mix(palette.skyTop, night, (0.5 - t) * 0.9),
          skyBottom: mix(palette.skyBottom, night, (0.5 - t) * 0.7),
        }
      : {
          skyTop: mix(palette.skyTop, palette.accent, (t - 0.5) * 0.45),
          skyBottom: mix(palette.skyBottom, palette.accent, (t - 0.5) * 0.75),
        };
  return { ...palette, ...sky };
}

// ---------------------------------------------------------------------------
// Setting
// ---------------------------------------------------------------------------

/** Which design identity stands where. The engine branches on none of this;
 *  it is the art reading the content's own grouping. */
const SETTING_BY_SET: Partial<Record<CardSetId, CardSceneSetting>> = {
  ashen_flight: 'ember',
  emberwatch_compact: 'ember',
  cryptfire_covenant: 'under',
  boneflame_host: 'grave',
  greenwake_circle: 'forest',
  briarpack: 'forest',
  tableborn_circle: 'hall',
  fenward_hunters: 'moor',
  gravebound_court: 'grave',
  crownless_legends: 'grave',
  mirefen_tide: 'mire',
  tunnel_crown: 'under',
  sableweb_brood: 'under',
  relicguard_order: 'vault',
  ironward_assembly: 'vault',
  stormheart_conclave: 'storm',
  mirrorveil_chorus: 'storm',
  roadknife_guild: 'road',
  questbound_caravan: 'road',
  eastbrook_company: 'road',
  basics: 'hall',
};

/** The tag fallback, for a card whose set says nothing (a future identity, or
 *  the unauthored basics). Ordered: the first tag that matches wins. */
const SETTING_BY_TAG: Partial<Record<CardTag, CardSceneSetting>> = {
  Fire: 'ember',
  Nature: 'forest',
  Mirefen: 'mire',
  Dungeon: 'vault',
  Eastbrook: 'road',
};

const PALETTES: Record<CardSceneSetting, CardScenePalette> = {
  ember: {
    skyTop: '#3a1408',
    skyBottom: '#8c3a12',
    ground: '#2a1008',
    groundEdge: '#4a1e0c',
    subject: '#1a0a05',
    subjectRim: '#ffb066',
    horizon: '#50200e',
    accent: '#ffa53c',
  },
  forest: {
    skyTop: '#12301f',
    skyBottom: '#3f7245',
    ground: '#14260f',
    groundEdge: '#2c4a1f',
    subject: '#0b1a0d',
    subjectRim: '#9fd88a',
    horizon: '#1d3a1c',
    accent: '#b6e36a',
  },
  moor: {
    skyTop: '#1b2233',
    skyBottom: '#5a5f52',
    ground: '#20261c',
    groundEdge: '#39412c',
    subject: '#0d1210',
    subjectRim: '#cbd3a4',
    horizon: '#2a3128',
    accent: '#d8d08a',
  },
  grave: {
    skyTop: '#10171a',
    skyBottom: '#2c4038',
    ground: '#141b18',
    groundEdge: '#25322b',
    subject: '#070c0a',
    subjectRim: '#8fd8b4',
    horizon: '#1d2723',
    accent: '#7bf0b8',
  },
  mire: {
    skyTop: '#101f24',
    skyBottom: '#2f5a52',
    ground: '#132320',
    groundEdge: '#1f3b34',
    subject: '#061211',
    subjectRim: '#7fd7c4',
    horizon: '#1a3029',
    accent: '#6fe0c0',
  },
  under: {
    skyTop: '#0b0910',
    skyBottom: '#241a30',
    ground: '#150f1c',
    groundEdge: '#2a1f38',
    subject: '#070510',
    subjectRim: '#b892f0',
    horizon: '#1e1528',
    accent: '#c78cff',
  },
  vault: {
    skyTop: '#121722',
    skyBottom: '#31405c',
    ground: '#171d28',
    groundEdge: '#2a3550',
    subject: '#080b12',
    subjectRim: '#a8c4ee',
    horizon: '#202a3c',
    accent: '#9ec2ff',
  },
  storm: {
    skyTop: '#141a2c',
    skyBottom: '#3d4a72',
    ground: '#161a26',
    groundEdge: '#28304a',
    subject: '#080a12',
    subjectRim: '#b9c8ff',
    horizon: '#1f2740',
    accent: '#8fb4ff',
  },
  road: {
    skyTop: '#1d2233',
    skyBottom: '#6b5a3e',
    ground: '#2a2318',
    groundEdge: '#463a26',
    subject: '#100c07',
    subjectRim: '#f0cf94',
    horizon: '#33291b',
    accent: '#f2c46a',
  },
  hall: {
    skyTop: '#1a1622',
    skyBottom: '#463a52',
    ground: '#221c2c',
    groundEdge: '#382e44',
    subject: '#0d0a12',
    subjectRim: '#e2c8f0',
    horizon: '#2b2436',
    accent: '#e0b7ff',
  },
};

/** The props that stand on each setting's horizon. */
const HORIZON_BY_SETTING: Record<CardSceneSetting, readonly CardSceneHorizonKind[]> = {
  ember: ['stone', 'post'],
  forest: ['pine'],
  moor: ['stone', 'post'],
  grave: ['headstone', 'arch'],
  mire: ['reed'],
  under: ['stalagmite'],
  vault: ['pillar', 'arch'],
  storm: ['peak'],
  road: ['post', 'pine'],
  hall: ['pillar'],
};

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

const SUBJECT_BY_TRIBE: Record<CardTribe, CardSceneSubject> = {
  Dragon: 'dragon',
  Beast: 'wolf',
  Human: 'human',
  Undead: 'skeleton',
  Demon: 'demon',
  Spider: 'spider',
  Mudfin: 'mudfin',
  Burrower: 'burrower',
  Construct: 'golem',
  Elemental: 'elemental',
  Spirit: 'spirit',
  Bandit: 'bandit',
};

// ---------------------------------------------------------------------------
// Motifs, read off the card's own words
// ---------------------------------------------------------------------------

/**
 * Word to motif.
 *
 * This is the part that makes the art about the CARD rather than about its
 * category: the ids are authored English compounds
 * (`boneflame_host_pyre_night`, `sableweb_brood_silk_road`), so the words in
 * them are the closest thing the content has to a description of the scene,
 * and they cost nothing to read. A word that is not here simply contributes
 * nothing, which is why an unrecognised card still gets its setting and its
 * subject and never renders empty.
 */
const MOTIF_BY_WORD: Record<string, CardSceneMotifKind> = {
  // Fire
  fire: 'flame',
  flame: 'flame',
  ember: 'flame',
  emberwatch: 'flame',
  pyre: 'flame',
  roast: 'flame',
  ash: 'flame',
  ashen: 'flame',
  smoke: 'flame',
  spark: 'flame',
  boneflame: 'flame',
  cryptfire: 'flame',
  // Sky
  moon: 'moon',
  moonrun: 'moon',
  night: 'moon',
  sun: 'sun',
  dawn: 'sun',
  sky: 'star',
  star: 'star',
  mirror: 'star',
  mirrorveil: 'star',
  soul: 'star',
  spirits: 'star',
  ghosts: 'star',
  // Weather
  storm: 'bolt',
  stormheart: 'bolt',
  stormlings: 'bolt',
  thunder: 'bolt',
  tempest: 'bolt',
  static: 'bolt',
  rain: 'rain',
  tide: 'rain',
  puddle: 'rain',
  bog: 'rain',
  mud: 'rain',
  mire: 'rain',
  mirefen: 'rain',
  reed: 'rain',
  // Creatures and their leavings
  web: 'web',
  silk: 'web',
  spider: 'web',
  spiders: 'web',
  sableweb: 'web',
  net: 'web',
  bone: 'bone',
  skeletons: 'bone',
  grave: 'bone',
  gravebound: 'bone',
  crypt: 'bone',
  // Money and the table
  toll: 'coin',
  bet: 'coin',
  score: 'coin',
  poker: 'coin',
  game: 'coin',
  gamblers: 'coin',
  roll: 'coin',
  // War
  blade: 'blade',
  knife: 'blade',
  roadknife: 'blade',
  war: 'blade',
  siege: 'blade',
  raid: 'blade',
  hunt: 'blade',
  hunters: 'blade',
  // Defence
  shield: 'shield',
  wall: 'shield',
  wardens: 'shield',
  guild: 'shield',
  vigil: 'shield',
  stand: 'shield',
  sentinels: 'shield',
  relicguard: 'shield',
  ironward: 'shield',
  lockdown: 'shield',
  lock: 'shield',
  // Rule
  crown: 'crown',
  crownless: 'crown',
  throne: 'crown',
  queen: 'crown',
  court: 'crown',
  legends: 'crown',
  order: 'crown',
  // Word and record
  song: 'scroll',
  chorus: 'scroll',
  tune: 'scroll',
  oath: 'scroll',
  rite: 'scroll',
  name: 'scroll',
  map: 'scroll',
  plot: 'scroll',
  vote: 'scroll',
  quest: 'scroll',
  questbound: 'scroll',
  // Light
  watch: 'lantern',
  lookout: 'lantern',
  overlook: 'lantern',
  scout: 'lantern',
  patrol: 'lantern',
  // Green things
  root: 'leaf',
  sprout: 'leaf',
  orchard: 'leaf',
  briarpack: 'leaf',
  treants: 'leaf',
  greenwake: 'leaf',
  wild: 'leaf',
  // The table's other meaning
  feast: 'cup',
  meal: 'cup',
  supper: 'cup',
  lunch: 'cup',
  snack: 'cup',
  tea: 'cup',
  ball: 'cup',
  party: 'cup',
  dance: 'cup',
  tableborn: 'cup',
};

/** How many motifs a scene is allowed. Three is where a small panel stops
 *  reading as a picture and starts reading as a pile of stickers. */
const MAX_MOTIFS = 3;

/**
 * The motifs this card's own words call for, in the order the words appear, at
 * most one of each kind.
 *
 * Order matters and is deliberately the id's own: the later words in these
 * compounds are the specific ones (`..._pyre_night` over `boneflame_host_`),
 * but the earlier ones name the identity, and taking them in order with the
 * cap applied at the end keeps a card that says nothing specific from
 * rendering bare.
 */
export function sceneMotifKinds(key: string): CardSceneMotifKind[] {
  const seen = new Set<CardSceneMotifKind>();
  const kinds: CardSceneMotifKind[] = [];
  for (const word of key.split(/[^a-z0-9]+/i)) {
    const kind = MOTIF_BY_WORD[word.toLowerCase()];
    if (!kind || seen.has(kind)) continue;
    seen.add(kind);
    kinds.push(kind);
  }
  return kinds.slice(0, MAX_MOTIFS);
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

/** Where the setting puts its stars, if any. */
const STARRY: ReadonlySet<CardSceneSetting> = new Set(['grave', 'storm', 'hall', 'moor', 'under']);

/**
 * Builds one card's scene.
 *
 * Total: every input produces a drawable scene. A card with no tribe gets a
 * landscape with no figure in it rather than an empty panel, and a card whose
 * words match nothing gets its setting and subject with a bare sky. That
 * totality is the point of the whole module: the fallback art is what two
 * hundred cards actually render as, so "no art" must never be a case.
 */
export function buildCardScene(input: CardSceneInput): CardSceneModel {
  const seed = hashKey(input.key);
  const rand = stream(seed);

  const setting = resolveSetting(input);
  const palette = shiftSky(PALETTES[setting], rand());
  const subject = input.tribes?.length ? SUBJECT_BY_TRIBE[input.tribes[0]] : 'none';

  // The horizon: two or three props from this setting's own vocabulary,
  // spread across the panel and never centred, because the middle is where the
  // subject stands.
  const kinds = HORIZON_BY_SETTING[setting];
  const propCount = 2 + Math.floor(rand() * 2);
  const horizon: CardSceneProp[] = [];
  for (let i = 0; i < propCount; i++) {
    const slot = (i + 0.5) / propCount;
    // Pushed away from centre: `slot` walks the panel, and the term below
    // widens the gap around x=50 where the figure is.
    const x = 6 + slot * 88 + (slot < 0.5 ? -6 : 6) * rand();
    horizon.push({
      kind: kinds[Math.floor(rand() * kinds.length)],
      x: Math.max(4, Math.min(96, x)),
      scale: 0.72 + rand() * 0.56,
    });
  }

  // The motifs sit in the upper half, out of the subject's way, alternating
  // sides so two of them never stack.
  const motifs = sceneMotifKinds(input.key).map((kind, i) => ({
    kind,
    x: i % 2 === 0 ? 14 + rand() * 14 : 68 + rand() * 14,
    y: 12 + i * 13 + rand() * 6,
    scale: 1.05 + rand() * 0.45,
  }));

  return {
    setting,
    palette,
    subject,
    // Sized to fill the panel: the silhouette IS the card at the hand size
    // (about 40px wide), and at the original scale it sat as a small mark in
    // the middle of a lot of sky. The spread is wide on purpose, so two cards
    // with the same subject are not the same composition.
    // A legendary stands larger: the one place rarity touches the picture, and
    // it is a nudge rather than a badge.
    subjectScale: (1.25 + rand() * 0.4) * (input.rarity === 'legendary' ? 1.12 : 1),
    subjectShift: (rand() - 0.5) * 16,
    horizon,
    motifs,
    stars: STARRY.has(setting) ? 5 + Math.floor(rand() * 7) : 0,
    seed,
  };
}

function resolveSetting(input: CardSceneInput): CardSceneSetting {
  const bySet = input.set ? SETTING_BY_SET[input.set] : undefined;
  if (bySet) return bySet;
  for (const tag of input.tags ?? []) {
    const byTag = SETTING_BY_TAG[tag];
    if (byTag) return byTag;
  }
  return 'hall';
}
