// The card sets barrel: every design identity, concatenated in one fixed order.
//
// Order here is presentational only. The catalog barrel
// (src/sim/content/cards/index.ts) re-sorts by card id, so no consumer can come
// to depend on the order this file happens to list the identities in.

import type { CardDefinition } from '../../../minigames/card_duel/types';
import { ASHEN_FLIGHT_CARDS } from './ashen_flight';
import { BONEFLAME_HOST_CARDS } from './boneflame_host';
import { BRIARPACK_CARDS } from './briarpack';
import { CROWNLESS_LEGENDS_CARDS } from './crownless_legends';
import { CRYPTFIRE_COVENANT_CARDS } from './cryptfire_covenant';
import { EASTBROOK_COMPANY_CARDS } from './eastbrook_company';
import { EMBERWATCH_COMPACT_CARDS } from './emberwatch_compact';
import { FENWARD_HUNTERS_CARDS } from './fenward_hunters';
import { GRAVEBOUND_COURT_CARDS } from './gravebound_court';
import { GREENWAKE_CIRCLE_CARDS } from './greenwake_circle';
import { IRONWARD_ASSEMBLY_CARDS } from './ironward_assembly';
import { MIREFEN_TIDE_CARDS } from './mirefen_tide';
import { MIRRORVEIL_CHORUS_CARDS } from './mirrorveil_chorus';
import { QUESTBOUND_CARAVAN_CARDS } from './questbound_caravan';
import { RELICGUARD_ORDER_CARDS } from './relicguard_order';
import { ROADKNIFE_GUILD_CARDS } from './roadknife_guild';
import { SABLEWEB_BROOD_CARDS } from './sableweb_brood';
import { STORMHEART_CONCLAVE_CARDS } from './stormheart_conclave';
import { TABLEBORN_CIRCLE_CARDS } from './tableborn_circle';
import { TUNNEL_CROWN_CARDS } from './tunnel_crown';

/** Every authored card, identity by identity. */
export const ALL_SET_CARDS: readonly CardDefinition[] = [
  ...ASHEN_FLIGHT_CARDS,
  ...BONEFLAME_HOST_CARDS,
  ...BRIARPACK_CARDS,
  ...CROWNLESS_LEGENDS_CARDS,
  ...CRYPTFIRE_COVENANT_CARDS,
  ...EASTBROOK_COMPANY_CARDS,
  ...EMBERWATCH_COMPACT_CARDS,
  ...FENWARD_HUNTERS_CARDS,
  ...GRAVEBOUND_COURT_CARDS,
  ...GREENWAKE_CIRCLE_CARDS,
  ...IRONWARD_ASSEMBLY_CARDS,
  ...MIREFEN_TIDE_CARDS,
  ...MIRRORVEIL_CHORUS_CARDS,
  ...QUESTBOUND_CARAVAN_CARDS,
  ...RELICGUARD_ORDER_CARDS,
  ...ROADKNIFE_GUILD_CARDS,
  ...SABLEWEB_BROOD_CARDS,
  ...STORMHEART_CONCLAVE_CARDS,
  ...TABLEBORN_CIRCLE_CARDS,
  ...TUNNEL_CROWN_CARDS,
];

export { ASHEN_FLIGHT_CARDS } from './ashen_flight';
export { BONEFLAME_HOST_CARDS } from './boneflame_host';
export { BRIARPACK_CARDS } from './briarpack';
export { CROWNLESS_LEGENDS_CARDS } from './crownless_legends';
export { CRYPTFIRE_COVENANT_CARDS } from './cryptfire_covenant';
export { EASTBROOK_COMPANY_CARDS } from './eastbrook_company';
export { EMBERWATCH_COMPACT_CARDS } from './emberwatch_compact';
export { FENWARD_HUNTERS_CARDS } from './fenward_hunters';
export { GRAVEBOUND_COURT_CARDS } from './gravebound_court';
export { GREENWAKE_CIRCLE_CARDS } from './greenwake_circle';
export { IRONWARD_ASSEMBLY_CARDS } from './ironward_assembly';
export { MIREFEN_TIDE_CARDS } from './mirefen_tide';
export { MIRRORVEIL_CHORUS_CARDS } from './mirrorveil_chorus';
export { QUESTBOUND_CARAVAN_CARDS } from './questbound_caravan';
export { RELICGUARD_ORDER_CARDS } from './relicguard_order';
export { ROADKNIFE_GUILD_CARDS } from './roadknife_guild';
export { SABLEWEB_BROOD_CARDS } from './sableweb_brood';
export { STORMHEART_CONCLAVE_CARDS } from './stormheart_conclave';
export { TABLEBORN_CIRCLE_CARDS } from './tableborn_circle';
export { TUNNEL_CROWN_CARDS } from './tunnel_crown';
