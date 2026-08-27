// The deck every player owns before they build one, and the fallback a match
// falls back to when a saved deck no longer validates.
//
// Authored, not derived. With three cards per value a mechanical "take the two
// lowest ids" rule produced something reasonable by accident; with twenty per
// value it produces twenty unrelated cards that teach a new player nothing. So
// this names a real deck: Briarpack plus Eastbrook Company, two identities that
// were designed to be played together (Eastbrook's Human handlers prepare the
// next Beast, and every Briarpack card is one). It is a complete package rather
// than a sampler, so a first match demonstrates a strategy instead of a pile.
//
// Two identities is exactly twenty cards and exactly two at every value, which
// is the deck rule satisfied by construction rather than by counting. The
// catalog barrel re-validates the shape anyway and degrades to the derived list
// if this one ever stops being legal; tests/card_catalog.test.ts pins that it
// does not.

import type { CardId } from '../../minigames/card_duel/types';

export const STARTER_DECK_IDS: readonly CardId[] = [
  // Briarpack: the Pack counter engine, low cards feeding the high ones.
  'briarpack_wolfs_nap',
  'briarpack_wolves_hunt',
  'briarpack_wolves_howl',
  'briarpack_wolves_ambush',
  'briarpack_wolves_trail',
  'briarpack_wolves_moonrun',
  'briarpack_wolves_feast',
  'briarpack_wolves_siege',
  'briarpack_wolves_overlook',
  'briarpack_wolves_wild_night',
  // Eastbrook Company: Human handlers that park a buff on the next Beast.
  'eastbrook_company_rangers_patrol',
  'eastbrook_company_rangers_lost_map',
  'eastbrook_company_rangers_dog_walk',
  'eastbrook_company_rangers_campfire',
  'eastbrook_company_rangers_beast_hunt',
  'eastbrook_company_rangers_stable_shift',
  'eastbrook_company_rangers_roll_call',
  'eastbrook_company_rangers_rescue',
  'eastbrook_company_rangers_last_watch',
  'eastbrook_company_rangers_victory_march',
];
