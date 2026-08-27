// The Card Duel rules language: every shape a card, a match, or the resolver
// speaks in. Types only, no logic, so this file is data-as-code and correctly
// large (docs/design/card-duel-rules-language.md is the authoring spec,
// docs/prd/card-duel-v2.md the implementation plan).
//
// The grammar every card effect follows:
//   WHEN trigger IF conditions TARGET selector DO effect FOR duration
//
// Nothing here imports anything: it is a pure leaf under src/sim/, so the
// browser, the server, and the headless env all agree on it by construction.

// ---------------------------------------------------------------------------
// Card identity
// ---------------------------------------------------------------------------

/** Catalog id of a card DEFINITION. Permanent, never reused: saved decks
 *  reference it, and a retired id is ignored on load rather than throwing. */
export type CardId = string;

/** Per-match handle for one physical card in a match. NOT the card id: a hand
 *  can hold two different cards of the same value, and (across matches) the
 *  same card id twice, so identity for playing, revealing, and targeting is
 *  the instance, never the definition. */
export type HandInstanceId = number;

/** Immutable base power. The deck shape (two cards per value) is built on it. */
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const CARD_VALUES: readonly CardValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Major mechanical affiliations. Tribe RELATIONSHIPS are never hard-coded in
 *  the engine: cards create them (a Human Stablemaster buffing Beasts). */
export type CardTribe =
  | 'Beast'
  | 'Human'
  | 'Undead'
  | 'Demon'
  | 'Spider'
  | 'Mudfin'
  | 'Burrower'
  | 'Construct'
  | 'Elemental'
  | 'Spirit'
  | 'Dragon'
  | 'Bandit';

export const CARD_TRIBES: readonly CardTribe[] = [
  'Beast',
  'Human',
  'Undead',
  'Demon',
  'Spider',
  'Mudfin',
  'Burrower',
  'Construct',
  'Elemental',
  'Spirit',
  'Dragon',
  'Bandit',
];

/** Finer-grained descriptors, so a future card can reference a narrow concept
 *  without minting a new primary tribe. */
export type CardTag =
  | 'Wolf'
  | 'Boss'
  | 'RareMob'
  | 'Eastbrook'
  | 'Mirefen'
  | 'Quest'
  | 'Nature'
  | 'Fire'
  | 'CardMaster'
  | 'Profession'
  | 'Dungeon';

/** Design identity: the ten-card, value 1 to 10 package a card belongs to.
 *  Purely descriptive to the engine (nothing here branches on it), but it is
 *  real content metadata: it is what the deck builder filters by and what makes
 *  a 200-card catalog navigable. Content authors it; `src/sim/content/cards/`
 *  holds the modules, one per member. */
export type CardSetId =
  /** The unauthored plain-number fallbacks (basic_catalog.ts). Not a design
   *  identity and never offered in the deck builder; it exists so every card in
   *  the engine can answer which set it came from without an optional field. */
  | 'basics'
  | 'ashen_flight'
  | 'boneflame_host'
  | 'briarpack'
  | 'crownless_legends'
  | 'cryptfire_covenant'
  | 'eastbrook_company'
  | 'emberwatch_compact'
  | 'fenward_hunters'
  | 'gravebound_court'
  | 'greenwake_circle'
  | 'ironward_assembly'
  | 'mirefen_tide'
  | 'mirrorveil_chorus'
  | 'questbound_caravan'
  | 'relicguard_order'
  | 'roadknife_guild'
  | 'sableweb_brood'
  | 'stormheart_conclave'
  | 'tableborn_circle'
  | 'tunnel_crown';

/** The twenty DESIGN identities, in id order. `basics` is deliberately absent:
 *  this is the list the deck builder filters by and the wiki will page through,
 *  and the fallback cards are neither authored nor collectible. */
export const CARD_SETS: readonly CardSetId[] = [
  'ashen_flight',
  'boneflame_host',
  'briarpack',
  'crownless_legends',
  'cryptfire_covenant',
  'eastbrook_company',
  'emberwatch_compact',
  'fenward_hunters',
  'gravebound_court',
  'greenwake_circle',
  'ironward_assembly',
  'mirefen_tide',
  'mirrorveil_chorus',
  'questbound_caravan',
  'relicguard_order',
  'roadknife_guild',
  'sableweb_brood',
  'stormheart_conclave',
  'tableborn_circle',
  'tunnel_crown',
];

/** Same names as item quality (src/sim/types.ts `ItemDef['quality']`) minus
 *  'poor', so the card frame reuses the shipped quality color tokens rather
 *  than introducing new color literals (src/styles/CLAUDE.md owns that rule). */
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// ---------------------------------------------------------------------------
// The effect grammar
// ---------------------------------------------------------------------------

/** Which side an owner-scoped condition, selector, or query reads. Always
 *  relative to the card's OWNER, never to a fixed seat, so a card reads the
 *  same whichever seat plays it. */
export type CardOwner = 'self' | 'opponent';

/** WHEN an effect checks. Deliberately finite (brief section 21): a new
 *  trigger is only added when a mechanic cannot be expressed with these. */
export type CardTrigger =
  | 'onDraw'
  | 'onReveal'
  | 'beforeCompare'
  | 'onWin'
  | 'onLose'
  | 'onTie'
  | 'onDiscard'
  | 'onRoundStart'
  | 'onRoundEnd';

export const CARD_TRIGGERS: readonly CardTrigger[] = [
  'onDraw',
  'onReveal',
  'beforeCompare',
  'onWin',
  'onLose',
  'onTie',
  'onDiscard',
  'onRoundStart',
  'onRoundEnd',
];

/** Comparison operator shared by every numeric condition. */
export type CardCompareOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';

/** Which card a value-reading condition or expression is about. */
export type CardRef =
  | 'thisCard'
  | 'myCard'
  | 'opponentCard'
  | 'myPreviousCard'
  | 'opponentPreviousCard';

/** Base vs effective value are different mechanics and stay distinct: a card
 *  copying a base value ignores every modifier on it, one copying the
 *  effective value inherits them. */
export type CardValueKind = 'base' | 'effective';

/** Result of a resolved round, from the reading side's point of view. */
export type CardRoundResult = 'win' | 'lose' | 'tie';

/** Filters for a history query. Every field is optional and they AND together;
 *  an empty filter counts every card played this match by either side. */
export interface CardHistoryFilter {
  owner?: CardOwner;
  tribe?: CardTribe;
  tag?: CardTag;
  value?: CardValue;
  cardId?: CardId;
  result?: CardRoundResult;
  /** Inclusive 1-based round bounds. */
  fromRound?: number;
  toRound?: number;
}

/** Numeric expressions, so an effect amount can scale off match state instead
 *  of being a fixed constant. Recursive by design (floor(count / 2)). */
export type CardNumericExpr =
  | { readonly type: 'constant'; readonly value: number }
  | { readonly type: 'historyCount'; readonly filter: CardHistoryFilter }
  | { readonly type: 'counter'; readonly owner: CardOwner; readonly counter: string }
  | { readonly type: 'zoneCount'; readonly owner: CardOwner; readonly zone: CardZone }
  | { readonly type: 'roundNumber' }
  | { readonly type: 'score'; readonly owner: CardOwner }
  | {
      readonly type: 'cardValue';
      readonly card: CardRef;
      readonly value: CardValueKind;
    }
  | { readonly type: 'uniqueTribesPlayed'; readonly owner: CardOwner }
  | { readonly type: 'add'; readonly terms: readonly CardNumericExpr[] }
  | { readonly type: 'subtract'; readonly left: CardNumericExpr; readonly right: CardNumericExpr }
  | { readonly type: 'multiply'; readonly terms: readonly CardNumericExpr[] }
  | { readonly type: 'divide'; readonly left: CardNumericExpr; readonly right: CardNumericExpr }
  | { readonly type: 'min'; readonly terms: readonly CardNumericExpr[] }
  | { readonly type: 'max'; readonly terms: readonly CardNumericExpr[] }
  | { readonly type: 'floor'; readonly of: CardNumericExpr }
  | { readonly type: 'ceil'; readonly of: CardNumericExpr }
  | { readonly type: 'negate'; readonly of: CardNumericExpr };

/** IF an effect may resolve. Composes with ALL / ANY / NOT, which is what
 *  keeps expressiveness high without new leaf kinds. */
export type CardConditionTree =
  | { readonly type: 'all'; readonly of: readonly CardConditionTree[] }
  | { readonly type: 'any'; readonly of: readonly CardConditionTree[] }
  | { readonly type: 'not'; readonly of: CardConditionTree }
  | { readonly type: 'hasTribe'; readonly card: CardRef; readonly tribe: CardTribe }
  | { readonly type: 'hasTag'; readonly card: CardRef; readonly tag: CardTag }
  | {
      readonly type: 'valueCompare';
      readonly card: CardRef;
      readonly value: CardValueKind;
      readonly op: CardCompareOp;
      readonly amount: CardNumericExpr;
    }
  | { readonly type: 'previousResult'; readonly owner: CardOwner; readonly result: CardRoundResult }
  | {
      readonly type: 'scoreCompare';
      readonly op: CardCompareOp;
      /** Compares the card owner's round wins against the opponent's. */
      readonly amount?: CardNumericExpr;
    }
  | { readonly type: 'roundCompare'; readonly op: CardCompareOp; readonly amount: CardNumericExpr }
  | {
      readonly type: 'historyCompare';
      readonly filter: CardHistoryFilter;
      readonly op: CardCompareOp;
      readonly amount: CardNumericExpr;
    }
  | {
      readonly type: 'counterCompare';
      readonly owner: CardOwner;
      readonly counter: string;
      readonly op: CardCompareOp;
      readonly amount: CardNumericExpr;
    }
  | {
      /** How many DISTINCT tribes a side has played this match. Mirrors the
       *  `uniqueTribesPlayed` expression: the varied-tribes identities gate on
       *  the same number their payoffs scale off, and no history filter can
       *  express "three different tribes". */
      readonly type: 'uniqueTribesCompare';
      readonly owner: CardOwner;
      readonly op: CardCompareOp;
      readonly amount: CardNumericExpr;
    }
  | {
      readonly type: 'consecutive';
      readonly owner: CardOwner;
      readonly result: CardRoundResult;
      readonly op: CardCompareOp;
      readonly amount: CardNumericExpr;
    };

/** A collection of cards an effect can reach. */
export type CardZone = 'hand' | 'deck' | 'discard';

/** How a zone selector narrows to actual cards. `all` is order-independent by
 *  construction; `random` is one of the engine's two declared rng sites
 *  (selectors.ts), the other being the shuffle in deck.ts. */
export type CardZoneSelector = 'first' | 'random' | 'all' | 'highest' | 'lowest';

/** Filters a zone selection to matching cards. Fields AND together. */
export interface CardMatchFilter {
  tribe?: CardTribe;
  tag?: CardTag;
  value?: CardValue;
  cardId?: CardId;
  maxValue?: CardValue;
  minValue?: CardValue;
}

/** TARGET: what the effect applies to. */
export type CardTargetSelector =
  | { readonly type: 'thisCard' }
  | { readonly type: 'myCard' }
  | { readonly type: 'opponentCard' }
  /** A modifier parked on the owner's NEXT played card (optionally the next
   *  one matching a filter). Resolves when that card is revealed, which is why
   *  its natural duration is 'untilTriggered'. */
  | {
      readonly type: 'nextCard';
      readonly owner: CardOwner;
      readonly match?: CardMatchFilter;
    }
  | {
      readonly type: 'zone';
      readonly owner: CardOwner;
      readonly zone: CardZone;
      readonly select: CardZoneSelector;
      readonly count?: number;
      readonly match?: CardMatchFilter;
    }
  /** The player rather than a card (counters, draw, reveal-hand). */
  | { readonly type: 'player'; readonly owner: CardOwner };

/** FOR how long a modifier exists. Explicit duration is what keeps modifier
 *  state debuggable instead of hidden. */
export type CardDuration =
  | 'instant'
  | 'thisComparison'
  | 'thisRound'
  | 'nextRound'
  | 'untilTriggered'
  | 'untilMatchEnd';

/** How repeat applications of the same effect combine. */
export type CardStackMode = 'stack' | 'replace' | 'highest' | 'lowest' | 'unique';

/** Optional caps on a triggered effect. These bound ONE effect's firing; the
 *  cross-card cycle case is bounded separately by the resolver's global step
 *  ceiling (docs/prd/card-duel-v2.md section 2.4). */
export interface CardEffectLimits {
  oncePerRound?: boolean;
  oncePerMatch?: boolean;
  maxTriggers?: number;
  cooldownRounds?: number;
}

/** DO: the V1 sanctioned primitive set (brief section 21). Every one of these
 *  is generic: a card is data over these, never bespoke engine code. */
export type CardEffectDefinition =
  // Value manipulation
  | { readonly type: 'modifyValue'; readonly amount: CardNumericExpr }
  | { readonly type: 'setValue'; readonly amount: CardNumericExpr }
  | { readonly type: 'minimumValue'; readonly amount: CardNumericExpr }
  | { readonly type: 'maximumValue'; readonly amount: CardNumericExpr }
  | { readonly type: 'swapValues' }
  // Information
  | { readonly type: 'reveal' }
  // Hand / deck / discard manipulation
  | { readonly type: 'draw'; readonly amount: CardNumericExpr }
  | { readonly type: 'discard' }
  | { readonly type: 'returnToHand' }
  | { readonly type: 'shuffleDiscardIntoDeck'; readonly owner: CardOwner }
  // Tribe manipulation
  | { readonly type: 'addTribe'; readonly tribe: CardTribe }
  | { readonly type: 'removeTribe'; readonly tribe: CardTribe }
  // Effect manipulation
  | { readonly type: 'silence' }
  // Outcome manipulation
  | { readonly type: 'winTies' }
  | { readonly type: 'reverseComparison' }
  // Counters
  | { readonly type: 'addCounter'; readonly counter: string; readonly amount: CardNumericExpr }
  | { readonly type: 'removeCounter'; readonly counter: string; readonly amount: CardNumericExpr }
  | { readonly type: 'setCounter'; readonly counter: string; readonly amount: CardNumericExpr };

export type CardEffectType = CardEffectDefinition['type'];

/** One authored effect on a card. */
export interface CardEffect {
  readonly trigger: CardTrigger;
  readonly conditions?: CardConditionTree;
  readonly target?: CardTargetSelector;
  readonly effect: CardEffectDefinition;
  readonly duration?: CardDuration;
  readonly stackMode?: CardStackMode;
  readonly limits?: CardEffectLimits;
  /** Named placeholders this effect can supply to the card's rules-text key
   *  (text.ts resolves them). Keys are placeholder names, values are the
   *  expression whose resolved number fills them. */
  readonly textValues?: Readonly<Record<string, CardNumericExpr>>;
}

/** A card as authored in src/sim/content/cards/. */
export interface CardDefinition {
  readonly id: CardId;
  /** i18n key id for the card's name. Never English text: src/sim/ is
   *  language-agnostic and the client resolves this through card_i18n. */
  readonly nameId: string;
  /** i18n key id for the whole-sentence rules text, with {placeholders} the
   *  effect tree supplies. Never assembled from clause fragments. */
  readonly textId: string;
  /**
   * Art id, NOT a URL and NOT the card id. Resolves to
   * public/ui/cards/<art>.webp through src/ui/card_art.ts. Deliberately
   * separate from `id` so several cards can share one painting without
   * duplicating a 512px source, and an id (never a path) because src/sim/ has
   * zero browser imports and also runs headless where a path means nothing.
   */
  readonly art: string;
  /** The design identity this card belongs to (src/sim/content/cards/sets/). */
  readonly set: CardSetId;
  readonly value: CardValue;
  readonly tribes: readonly CardTribe[];
  readonly tags: readonly CardTag[];
  readonly rarity: CardRarity;
  readonly effects: readonly CardEffect[];
}

// ---------------------------------------------------------------------------
// Live match shapes
// ---------------------------------------------------------------------------

/** Which seat of a match a player holds. Instance ids are minted per seat, so
 *  the two sides can never collide. */
export type CardSeat = 'a' | 'b';

/** One physical card in a live match. The engine moves these between zones;
 *  the definition behind `cardId` is immutable catalog data. */
export interface CardInstance {
  readonly iid: HandInstanceId;
  readonly cardId: CardId;
  readonly value: CardValue;
}

/** A modifier parked by a resolved effect, waiting for the card it rides to
 *  reach the board. Effects whose duration ends this round are applied
 *  immediately and never parked. */
export interface CardModifier {
  /** Creation order, for a stable sort that never depends on array order. */
  readonly id: number;
  /** Whose card it rides. */
  readonly seat: CardSeat;
  /** The specific instance it waits for, or null for "the next card matching
   *  `match`". */
  readonly iid: HandInstanceId | null;
  readonly source: CardId;
  /** Amounts are RESOLVED at parking time (the state that authored the
   *  modifier is the state it was priced against), so this always holds
   *  constants. */
  readonly effect: CardEffectDefinition;
  readonly duration: CardDuration;
  readonly stackMode: CardStackMode;
  /** Round number the modifier was created in, for duration expiry. */
  readonly createdRound: number;
  /** For 'nextCard' modifiers: the filter the receiving card must match. */
  readonly match?: CardMatchFilter;
  /** Set once an 'untilTriggered' modifier has been spent. */
  consumed: boolean;
}

/** One played card, recorded for history queries. */
export interface CardHistoryEntry {
  readonly round: number;
  readonly owner: CardSeat;
  readonly cardId: CardId;
  readonly iid: HandInstanceId;
  readonly value: CardValue;
  readonly effectiveValue: number;
  readonly tribes: readonly CardTribe[];
  readonly result: CardRoundResult;
}
