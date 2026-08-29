// i18n source catalog - the ClaudeStone surface: card names, rules text, tribes,
// counters, and the Card Master's regulars. English values only; the locale translations live in src/ui/i18n.locales/<lang>.ts
// (the runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `cards` namespace. Like guide.ts
// and editor.ts this module carries NO per-locale blocks (no `as const`), so a
// new string is an English-only add that compiles.

export const cardsStrings = {
  // The unauthored fallback cards: ten plain numbers with no rules text.
  basicName: 'Plain {value}',
  noRulesText: 'No effect.',

  // Card names. Keyed by CardDefinition.nameId (src/sim/content/cards/), which
  // is a key id and never English: the sim stays language-agnostic. The leading
  // number is part of the name, not a placeholder: a value-N card shows N
  // creatures, which is what makes the catalog readable at a glance.
  name: {
    briarpack_wolfs_nap: "1 Wolf's Nap",
    briarpack_wolves_hunt: "2 Wolves' Hunt",
    briarpack_wolves_howl: "3 Wolves' Howl",
    briarpack_wolves_ambush: "4 Wolves' Ambush",
    briarpack_wolves_trail: "5 Wolves' Trail",
    briarpack_wolves_moonrun: "6 Wolves' Moonrun",
    briarpack_wolves_feast: "7 Wolves' Feast",
    briarpack_wolves_siege: "8 Wolves' Siege",
    briarpack_wolves_overlook: "9 Wolves' Overlook",
    briarpack_wolves_wild_night: "10 Wolves' Wild Night",
    gravebound_court_ghosts_wake: "1 Ghost's Wake",
    gravebound_court_ghosts_vigil: "2 Ghosts' Vigil",
    gravebound_court_ghosts_supper: "3 Ghosts' Supper",
    gravebound_court_ghosts_grave_shift: "4 Ghosts' Grave Shift",
    gravebound_court_ghosts_bell_toll: "5 Ghosts' Bell Toll",
    gravebound_court_ghosts_procession: "6 Ghosts' Procession",
    gravebound_court_ghosts_crypt_ball: "7 Ghosts' Crypt Ball",
    gravebound_court_ghosts_court: "8 Ghosts' Court",
    gravebound_court_ghosts_coronation: "9 Ghosts' Coronation",
    gravebound_court_ghosts_reunion: "10 Ghosts' Reunion",
    sableweb_brood_spiders_web: "1 Spider's Web",
    sableweb_brood_spiders_wait: "2 Spiders' Wait",
    sableweb_brood_spiders_snack: "3 Spiders' Snack",
    sableweb_brood_spiders_silk_trap: "4 Spiders' Silk Trap",
    sableweb_brood_spiders_shed: "5 Spiders' Shed",
    sableweb_brood_spiders_egg_hunt: "6 Spiders' Egg Hunt",
    sableweb_brood_spiders_tea_party: "7 Spiders' Tea Party",
    sableweb_brood_spiders_night_watch: "8 Spiders' Night Watch",
    sableweb_brood_spiders_feast: "9 Spiders' Feast",
    sableweb_brood_spiders_brood_rite: "10 Spiders' Brood Rite",
    ashen_flight_dragons_spark: "1 Dragon's Spark",
    ashen_flight_dragons_smoke_break: "2 Dragons' Smoke Break",
    ashen_flight_dragons_roost: "3 Dragons' Roost",
    ashen_flight_dragons_first_raid: "4 Dragons' First Raid",
    ashen_flight_dragons_ashfall: "5 Dragons' Ashfall",
    ashen_flight_dragons_fire_drill: "6 Dragons' Fire Drill",
    ashen_flight_dragons_sky_hunt: "7 Dragons' Sky Hunt",
    ashen_flight_dragons_bridge_roast: "8 Dragons' Bridge Roast",
    ashen_flight_dragons_sun_feast: "9 Dragons' Sun Feast",
    ashen_flight_dragons_long_nap: "10 Dragons' Long Nap",
    eastbrook_company_rangers_patrol: "1 Ranger's Patrol",
    eastbrook_company_rangers_lost_map: "2 Rangers' Lost Map",
    eastbrook_company_rangers_dog_walk: "3 Rangers' Dog Walk",
    eastbrook_company_rangers_campfire: "4 Rangers' Campfire",
    eastbrook_company_rangers_beast_hunt: "5 Rangers' Beast Hunt",
    eastbrook_company_rangers_stable_shift: "6 Rangers' Stable Shift",
    eastbrook_company_rangers_roll_call: "7 Rangers' Roll Call",
    eastbrook_company_rangers_rescue: "8 Rangers' Rescue",
    eastbrook_company_rangers_last_watch: "9 Rangers' Last Watch",
    eastbrook_company_rangers_victory_march: "10 Rangers' Victory March",
    ironward_assembly_golems_boot: "1 Golem's Boot",
    ironward_assembly_golems_test_run: "2 Golems' Test Run",
    ironward_assembly_golems_watch: "3 Golems' Watch",
    ironward_assembly_golems_tune_up: "4 Golems' Tune-Up",
    ironward_assembly_golems_forge_day: "5 Golems' Forge Day",
    ironward_assembly_golems_shield_wall: "6 Golems' Shield Wall",
    ironward_assembly_golems_march: "7 Golems' March",
    ironward_assembly_golems_lockdown: "8 Golems' Lockdown",
    ironward_assembly_golems_last_stand: "9 Golems' Last Stand",
    ironward_assembly_golems_awakening: "10 Golems' Awakening",
    mirefen_tide_mudfins_puddle: "1 Mudfin's Puddle",
    mirefen_tide_mudfins_fish_fry: "2 Mudfins' Fish Fry",
    mirefen_tide_mudfins_net_cast: "3 Mudfins' Net Cast",
    mirefen_tide_mudfins_bog_race: "4 Mudfins' Bog Race",
    mirefen_tide_mudfins_reed_raid: "5 Mudfins' Reed Raid",
    mirefen_tide_mudfins_tide_call: "6 Mudfins' Tide Call",
    mirefen_tide_mudfins_grub_feast: "7 Mudfins' Grub Feast",
    mirefen_tide_mudfins_mud_ball: "8 Mudfins' Mud Ball",
    mirefen_tide_mudfins_moon_croak: "9 Mudfins' Moon Croak",
    mirefen_tide_mudfins_flood: "10 Mudfins' Flood",
    tunnel_crown_burrowers_dig: "1 Burrower's Dig",
    tunnel_crown_burrowers_shift: "2 Burrowers' Shift",
    tunnel_crown_burrowers_cave_in: "3 Burrowers' Cave-In",
    tunnel_crown_burrowers_gem_rush: "4 Burrowers' Gem Rush",
    tunnel_crown_burrowers_lunch_break: "5 Burrowers' Lunch Break",
    tunnel_crown_burrowers_deep_march: "6 Burrowers' Deep March",
    tunnel_crown_burrowers_rockfall: "7 Burrowers' Rockfall",
    tunnel_crown_burrowers_throne_run: "8 Burrowers' Throne Run",
    tunnel_crown_burrowers_last_tunnel: "9 Burrowers' Last Tunnel",
    tunnel_crown_burrowers_uprising: "10 Burrowers' Uprising",
    stormheart_conclave_stormlings_static: "1 Stormling's Static",
    stormheart_conclave_stormlings_rain_dance: "2 Stormlings' Rain Dance",
    stormheart_conclave_stormlings_wind_race: "3 Stormlings' Wind Race",
    stormheart_conclave_stormlings_storm_call: "4 Stormlings' Storm Call",
    stormheart_conclave_stormlings_cloudbreak: "5 Stormlings' Cloudbreak",
    stormheart_conclave_stormlings_thunder_roll: "6 Stormlings' Thunder Roll",
    stormheart_conclave_stormlings_sky_brawl: "7 Stormlings' Sky Brawl",
    stormheart_conclave_stormlings_blackout: "8 Stormlings' Blackout",
    stormheart_conclave_stormlings_tempest: "9 Stormlings' Tempest",
    stormheart_conclave_stormlings_big_bang: "10 Stormlings' Big Bang",
    roadknife_guild_bandits_heist: "1 Bandit's Heist",
    roadknife_guild_bandits_lookout: "2 Bandits' Lookout",
    roadknife_guild_bandits_road_toll: "3 Bandits' Road Toll",
    roadknife_guild_bandits_knife_game: "4 Bandits' Knife Game",
    roadknife_guild_bandits_bridge_job: "5 Bandits' Bridge Job",
    roadknife_guild_bandits_powder_plot: "6 Bandits' Powder Plot",
    roadknife_guild_bandits_night_raid: "7 Bandits' Night Raid",
    roadknife_guild_bandits_coach_job: "8 Bandits' Coach Job",
    roadknife_guild_bandits_guild_vote: "9 Bandits' Guild Vote",
    roadknife_guild_bandits_last_score: "10 Bandits' Last Score",
    mirrorveil_chorus_spirits_glance: "1 Spirit's Glance",
    mirrorveil_chorus_spirits_echo: "2 Spirits' Echo",
    mirrorveil_chorus_spirits_double_take: "3 Spirits' Double Take",
    mirrorveil_chorus_spirits_mirror_game: "4 Spirits' Mirror Game",
    mirrorveil_chorus_spirits_glass_dance: "5 Spirits' Glass Dance",
    mirrorveil_chorus_spirits_name_swap: "6 Spirits' Name Swap",
    mirrorveil_chorus_spirits_lost_face: "7 Spirits' Lost Face",
    mirrorveil_chorus_spirits_hall_walk: "8 Spirits' Hall Walk",
    mirrorveil_chorus_spirits_shattering: "9 Spirits' Shattering",
    mirrorveil_chorus_spirits_encore: "10 Spirits' Encore",
    emberwatch_compact_wardens_watch: "1 Warden's Watch",
    emberwatch_compact_wardens_lantern_run: "2 Wardens' Lantern Run",
    emberwatch_compact_wardens_fire_drill: "3 Wardens' Fire Drill",
    emberwatch_compact_wardens_night_shift: "4 Wardens' Night Shift",
    emberwatch_compact_wardens_beacon: "5 Wardens' Beacon",
    emberwatch_compact_wardens_muster: "6 Wardens' Muster",
    emberwatch_compact_wardens_rescue: "7 Wardens' Rescue",
    emberwatch_compact_wardens_last_watch: "8 Wardens' Last Watch",
    emberwatch_compact_wardens_alarm: "9 Wardens' Alarm",
    emberwatch_compact_wardens_final_stand: "10 Wardens' Final Stand",
    cryptfire_covenant_fiends_spark: "1 Fiend's Spark",
    cryptfire_covenant_fiends_grave_raid: "2 Fiends' Grave Raid",
    cryptfire_covenant_fiends_bone_fire: "3 Fiends' Bone Fire",
    cryptfire_covenant_fiends_soul_hunt: "4 Fiends' Soul Hunt",
    cryptfire_covenant_fiends_crypt_feast: "5 Fiends' Crypt Feast",
    cryptfire_covenant_fiends_ash_rite: "6 Fiends' Ash Rite",
    cryptfire_covenant_fiends_hellgate: "7 Fiends' Hellgate",
    cryptfire_covenant_fiends_doom_march: "8 Fiends' Doom March",
    cryptfire_covenant_fiends_graveburn: "9 Fiends' Graveburn",
    cryptfire_covenant_fiends_endtime: "10 Fiends' Endtime",
    tableborn_circle_gamblers_deal: "1 Gambler's Deal",
    tableborn_circle_gamblers_small_bet: "2 Gamblers' Small Bet",
    tableborn_circle_gamblers_card_trick: "3 Gamblers' Card Trick",
    tableborn_circle_gamblers_poker_night: "4 Gamblers' Poker Night",
    tableborn_circle_gamblers_bad_hand: "5 Gamblers' Bad Hand",
    tableborn_circle_gamblers_bluff: "6 Gamblers' Bluff",
    tableborn_circle_gamblers_lucky_draw: "7 Gamblers' Lucky Draw",
    tableborn_circle_gamblers_table_flip: "8 Gamblers' Table Flip",
    tableborn_circle_gamblers_final_bet: "9 Gamblers' Final Bet",
    tableborn_circle_gamblers_grand_game: "10 Gamblers' Grand Game",
    greenwake_circle_treants_sprout: "1 Treant's Sprout",
    greenwake_circle_treants_rain_song: "2 Treants' Rain Song",
    greenwake_circle_treants_root_race: "3 Treants' Root Race",
    greenwake_circle_treants_orchard_walk: "4 Treants' Orchard Walk",
    greenwake_circle_treants_stag_hunt: "5 Treants' Stag Hunt",
    greenwake_circle_treants_bloom: "6 Treants' Bloom",
    greenwake_circle_treants_grove_dance: "7 Treants' Grove Dance",
    greenwake_circle_treants_wild_hunt: "8 Treants' Wild Hunt",
    greenwake_circle_treants_long_sleep: "9 Treants' Long Sleep",
    greenwake_circle_treants_awakening: "10 Treants' Awakening",
    boneflame_host_skeletons_spark: "1 Skeleton's Spark",
    boneflame_host_skeletons_bone_toss: "2 Skeletons' Bone Toss",
    boneflame_host_skeletons_ash_dance: "3 Skeletons' Ash Dance",
    boneflame_host_skeletons_grave_run: "4 Skeletons' Grave Run",
    boneflame_host_skeletons_fire_walk: "5 Skeletons' Fire Walk",
    boneflame_host_skeletons_pyre: "6 Skeletons' Pyre",
    boneflame_host_skeletons_crypt_roast: "7 Skeletons' Crypt Roast",
    boneflame_host_skeletons_last_march: "8 Skeletons' Last March",
    boneflame_host_skeletons_bone_feast: "9 Skeletons' Bone Feast",
    boneflame_host_skeletons_inferno: "10 Skeletons' Inferno",
    fenward_hunters_scout: "1 Hunter's Scout",
    fenward_hunters_net_cast: "2 Hunters' Net Cast",
    fenward_hunters_bog_hunt: "3 Hunters' Bog Hunt",
    fenward_hunters_spider_trap: "4 Hunters' Spider Trap",
    fenward_hunters_trail: "5 Hunters' Trail",
    fenward_hunters_night_hunt: "6 Hunters' Night Hunt",
    fenward_hunters_web_raid: "7 Hunters' Web Raid",
    fenward_hunters_mire_watch: "8 Hunters' Mire Watch",
    fenward_hunters_queen_hunt: "9 Hunters' Queen Hunt",
    fenward_hunters_homecoming: "10 Hunters' Homecoming",
    relicguard_order_sentinels_vigil: "1 Sentinel's Vigil",
    relicguard_order_sentinels_key_turn: "2 Sentinels' Key Turn",
    relicguard_order_sentinels_vault_watch: "3 Sentinels' Vault Watch",
    relicguard_order_sentinels_seal: "4 Sentinels' Seal",
    relicguard_order_sentinels_relic_hunt: "5 Sentinels' Relic Hunt",
    relicguard_order_sentinels_oath: "6 Sentinels' Oath",
    relicguard_order_sentinels_crypt_guard: "7 Sentinels' Crypt Guard",
    relicguard_order_sentinels_gate_lock: "8 Sentinels' Gate Lock",
    relicguard_order_sentinels_last_watch: "9 Sentinels' Last Watch",
    relicguard_order_sentinels_final_oath: "10 Sentinels' Final Oath",
    questbound_caravan_travelers_errand: "1 Traveler's Errand",
    questbound_caravan_travelers_wrong_turn: "2 Travelers' Wrong Turn",
    questbound_caravan_travelers_bridge_stop: "3 Travelers' Bridge Stop",
    questbound_caravan_travelers_camp: "4 Travelers' Camp",
    questbound_caravan_travelers_side_quest: "5 Travelers' Side Quest",
    questbound_caravan_travelers_cart_fix: "6 Travelers' Cart Fix",
    questbound_caravan_travelers_road_meal: "7 Travelers' Road Meal",
    questbound_caravan_travelers_lost_map: "8 Travelers' Lost Map",
    questbound_caravan_travelers_boss_fight: "9 Travelers' Boss Fight",
    questbound_caravan_travelers_homecoming: "10 Travelers' Homecoming",
    crownless_legends_whisper: "1 Legend's Whisper",
    crownless_legends_exile: "2 Legends' Exile",
    crownless_legends_broken_oath: "3 Legends' Broken Oath",
    crownless_legends_empty_hall: "4 Legends' Empty Hall",
    crownless_legends_last_song: "5 Legends' Last Song",
    crownless_legends_ghost_court: "6 Legends' Ghost Court",
    crownless_legends_lost_crown: "7 Legends' Lost Crown",
    crownless_legends_kingless_feast: "8 Legends' Kingless Feast",
    crownless_legends_final_war: "9 Legends' Final War",
    crownless_legends_return: "10 Legends' Return",
  },

  // Rules text. ONE whole sentence per card with placeholders the card's own
  // effect tree supplies, never assembled from clause fragments: a machine-built
  // sentence cannot be translated into a language whose word order differs, and
  // cannot be reviewed against docs/design/tooltip-writing.md. Every number a
  // player reads is a {placeholder} resolved from the effect that produces it,
  // so a sentence can never drift from the mechanic. Pinned against the effect
  // tree by tests/card_catalog.test.ts.
  text: {
    briarpack_wolfs_nap: 'When revealed, gain {amount} Pack. Lower value wins this comparison.',
    briarpack_wolves_hunt: 'Gets +{amount} if you have at least {threshold} Pack.',
    briarpack_wolves_howl: 'Gets +{rate} for each Pack you have, currently +{amount}.',
    briarpack_wolves_ambush:
      'When revealed, gain {amount} Pack. With at least {threshold} Pack it also counts as a Spirit this round.',
    briarpack_wolves_trail: 'Gets +{amount} if you have at least {threshold} Pack.',
    briarpack_wolves_moonrun: 'Gets +{rate} for each Pack you have, currently +{amount}.',
    briarpack_wolves_feast: 'When revealed, gain {amount} Pack.',
    briarpack_wolves_siege: 'Gets +{amount} if you have at least {threshold} Pack.',
    briarpack_wolves_overlook: 'Gets +{rate} for each Pack you have, currently +{amount}.',
    briarpack_wolves_wild_night: 'When revealed, gain {amount} Pack.',
    gravebound_court_ghosts_wake:
      'If this loses, return your highest Undead of value {threshold} or lower from your discard to your hand and draw {drawCount} cards.',
    gravebound_court_ghosts_vigil:
      'If this loses, return your highest Undead of value {threshold} or lower from discard to hand.',
    gravebound_court_ghosts_supper:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    gravebound_court_ghosts_grave_shift:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    gravebound_court_ghosts_bell_toll:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    gravebound_court_ghosts_procession:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    gravebound_court_ghosts_crypt_ball:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    gravebound_court_ghosts_court:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    gravebound_court_ghosts_coronation: 'Whenever this loses, draw {amount} card.',
    gravebound_court_ghosts_reunion: 'If this wins, your next card gets +{amount}.',
    sableweb_brood_spiders_web:
      'When revealed, gain {amount} Web. When revealed, silence the opposing card this round.',
    sableweb_brood_spiders_wait: 'Gets +{amount} if you have at least {threshold} Web.',
    sableweb_brood_spiders_snack: 'Gets +{rate} for each Web you have, currently +{amount}.',
    sableweb_brood_spiders_silk_trap:
      'When revealed, gain {amount} Web. With at least {threshold} Web it also counts as a Spirit this round.',
    sableweb_brood_spiders_shed: 'Gets +{amount} if you have at least {threshold} Web.',
    sableweb_brood_spiders_egg_hunt: 'Gets +{rate} for each Web you have, currently +{amount}.',
    sableweb_brood_spiders_tea_party: 'When revealed, gain {amount} Web.',
    sableweb_brood_spiders_night_watch: 'Gets +{amount} if you have at least {threshold} Web.',
    sableweb_brood_spiders_feast: 'Gets +{rate} for each Web you have, currently +{amount}.',
    sableweb_brood_spiders_brood_rite: 'When revealed, gain {amount} Web.',
    ashen_flight_dragons_spark:
      'When revealed, give the opponent {amount} Dread. The opposing card cannot exceed {cap} this comparison.',
    ashen_flight_dragons_smoke_break:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    ashen_flight_dragons_roost:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    ashen_flight_dragons_first_raid: 'When revealed, give the opponent {amount} Dread.',
    ashen_flight_dragons_ashfall:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    ashen_flight_dragons_fire_drill:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    ashen_flight_dragons_sky_hunt:
      'When revealed, give the opponent {amount} Dread. If this wins, give them {bonus} more Dread.',
    ashen_flight_dragons_bridge_roast:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    ashen_flight_dragons_sun_feast:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    ashen_flight_dragons_long_nap: 'When revealed, give the opponent {amount} Dread.',
    eastbrook_company_rangers_patrol:
      'If this loses, your next Beast gets +{amount} and your highest Beast returns from your discard to your hand.',
    eastbrook_company_rangers_lost_map: 'If this loses, your next Beast gets +{amount}.',
    eastbrook_company_rangers_dog_walk: 'If this loses, your next Beast gets +{amount}.',
    eastbrook_company_rangers_campfire: 'When revealed, your next Beast gets +{amount}.',
    eastbrook_company_rangers_beast_hunt: 'When revealed, your next Beast gets +{amount}.',
    eastbrook_company_rangers_stable_shift: 'When revealed, your next Beast gets +{amount}.',
    eastbrook_company_rangers_roll_call: 'If this wins, your next Beast gets +{amount}.',
    eastbrook_company_rangers_rescue: 'If this wins, your next Beast gets +{amount}.',
    eastbrook_company_rangers_last_watch: 'If this wins, your next Beast gets +{amount}.',
    eastbrook_company_rangers_victory_march: 'If this wins, your next card gets +{amount}.',
    ironward_assembly_golems_boot:
      'When revealed, lower value wins the comparison. When revealed, silence the opposing card this round.',
    ironward_assembly_golems_test_run: 'This card wins tied rounds.',
    ironward_assembly_golems_watch: 'This card cannot be reduced below {amount}.',
    ironward_assembly_golems_tune_up: 'The opponent card cannot exceed {amount} this round.',
    ironward_assembly_golems_forge_day: 'This card becomes the opponent card base value.',
    ironward_assembly_golems_shield_wall:
      'The first time this is revealed, the opponent card has no effect this round.',
    ironward_assembly_golems_march: 'The first time this is played, swap both effective values.',
    ironward_assembly_golems_lockdown: 'This card cannot be reduced below {amount}.',
    ironward_assembly_golems_last_stand: 'The opponent card cannot exceed {amount} this round.',
    ironward_assembly_golems_awakening: 'If this wins, your next card gets +{amount}.',
    mirefen_tide_mudfins_puddle:
      'If this loses, reveal {count} random cards in the opponent hand and the opponent discards {discardCount} random cards.',
    mirefen_tide_mudfins_fish_fry:
      'If this loses, reveal {count} random cards in the opponent hand.',
    mirefen_tide_mudfins_net_cast: 'If this wins, the opponent discards {count} random cards.',
    mirefen_tide_mudfins_bog_race: 'If this wins, the opponent discards {count} random cards.',
    mirefen_tide_mudfins_reed_raid: 'The first time this is revealed, reveal the opponent hand.',
    mirefen_tide_mudfins_tide_call: 'The first time this is revealed, reveal the opponent hand.',
    mirefen_tide_mudfins_grub_feast: 'Gets +{amount} if the opponent card is Human.',
    mirefen_tide_mudfins_mud_ball: 'Gets +{amount} if the opponent card is Human.',
    mirefen_tide_mudfins_moon_croak: 'Whenever this wins, draw {amount} card.',
    mirefen_tide_mudfins_flood: 'When revealed, the opponent discards {count} random cards.',
    tunnel_crown_burrowers_dig:
      'Gets +{amount} if your previous card was Burrower. This card wins ties.',
    tunnel_crown_burrowers_shift: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_cave_in: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_gem_rush:
      'Counts as Burrower this round and gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_lunch_break: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_deep_march: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_rockfall: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_throne_run:
      'Counts as Burrower this round and gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_last_tunnel: 'Gets +{amount} if your previous card was Burrower.',
    tunnel_crown_burrowers_uprising: 'If this wins, your next card gets +{amount}.',
    stormheart_conclave_stormlings_static:
      'The opponent card gets -{amount} if it is a {threshold} or higher, and cannot exceed {cap} this comparison.',
    stormheart_conclave_stormlings_rain_dance:
      'Gets +{amount} if the opponent card is a {threshold} or higher.',
    stormheart_conclave_stormlings_wind_race:
      'The opponent card gets -{amount} if it is a {threshold} or higher.',
    stormheart_conclave_stormlings_storm_call:
      'Gets +{amount} if the opponent card is a {threshold} or higher.',
    stormheart_conclave_stormlings_cloudbreak:
      'The opponent card gets -{amount} if it is a {threshold} or higher.',
    stormheart_conclave_stormlings_thunder_roll:
      'Gets +{amount} if the opponent card is a {threshold} or higher.',
    stormheart_conclave_stormlings_sky_brawl:
      'The opponent card gets -{amount} if it is a {threshold} or higher.',
    stormheart_conclave_stormlings_blackout:
      'Gets +{amount} if the opponent card is a {threshold} or higher.',
    stormheart_conclave_stormlings_tempest:
      'The opponent card gets -{amount} if it is a {threshold} or higher.',
    stormheart_conclave_stormlings_big_bang: 'The opponent card cannot exceed {amount} this round.',
    roadknife_guild_bandits_heist:
      'If this loses, reveal {count} random cards in the opponent hand and the opponent discards {discardCount} random cards.',
    roadknife_guild_bandits_lookout:
      'If this loses, reveal {count} random cards in the opponent hand.',
    roadknife_guild_bandits_road_toll: 'If this wins, the opponent discards {count} random cards.',
    roadknife_guild_bandits_knife_game: 'If this wins, the opponent discards {count} random cards.',
    roadknife_guild_bandits_bridge_job:
      'The first time this is revealed, reveal the opponent hand.',
    roadknife_guild_bandits_powder_plot:
      'The first time this is revealed, reveal the opponent hand.',
    roadknife_guild_bandits_night_raid: 'Gets +{amount} if the opponent card is Human.',
    roadknife_guild_bandits_coach_job: 'Gets +{amount} if the opponent card is Human.',
    roadknife_guild_bandits_guild_vote: 'Whenever this wins, draw {amount} card.',
    roadknife_guild_bandits_last_score:
      'When revealed, the opponent discards {count} random cards.',
    mirrorveil_chorus_spirits_glance:
      'When revealed, lower value wins the comparison. When revealed, silence the opposing card this round.',
    mirrorveil_chorus_spirits_echo: 'This card wins tied rounds.',
    mirrorveil_chorus_spirits_double_take: 'This card cannot be reduced below {amount}.',
    mirrorveil_chorus_spirits_mirror_game: 'The opponent card cannot exceed {amount} this round.',
    mirrorveil_chorus_spirits_glass_dance: 'This card becomes the opponent card base value.',
    mirrorveil_chorus_spirits_name_swap:
      'The first time this is revealed, the opponent card has no effect this round.',
    mirrorveil_chorus_spirits_lost_face:
      'The first time this is played, swap both effective values.',
    mirrorveil_chorus_spirits_hall_walk: 'This card cannot be reduced below {amount}.',
    mirrorveil_chorus_spirits_shattering: 'The opponent card cannot exceed {amount} this round.',
    mirrorveil_chorus_spirits_encore: 'If this wins, your next card gets +{amount}.',
    emberwatch_compact_wardens_watch:
      'Whenever this loses, draw {amount} cards and return your highest Human of value {threshold} or lower from your discard to your hand.',
    emberwatch_compact_wardens_lantern_run: 'Whenever this loses, draw {amount} card.',
    emberwatch_compact_wardens_fire_drill: 'Whenever this loses, draw {amount} card.',
    emberwatch_compact_wardens_night_shift: 'Gets +{amount} while you are behind on rounds.',
    emberwatch_compact_wardens_beacon: 'Gets +{amount} while you are behind on rounds.',
    emberwatch_compact_wardens_muster: 'Gets +{amount} while you are behind on rounds.',
    emberwatch_compact_wardens_rescue: 'Gets +{amount} while you are behind on rounds.',
    emberwatch_compact_wardens_last_watch: 'Gets +{amount} while you are behind on rounds.',
    emberwatch_compact_wardens_alarm: 'Whenever this wins, draw {amount} card.',
    emberwatch_compact_wardens_final_stand: 'If this wins, your next card gets +{amount}.',
    cryptfire_covenant_fiends_spark:
      'When revealed, give the opponent {amount} Dread. The opposing card cannot exceed {cap} this comparison.',
    cryptfire_covenant_fiends_grave_raid:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    cryptfire_covenant_fiends_bone_fire:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    cryptfire_covenant_fiends_soul_hunt: 'When revealed, give the opponent {amount} Dread.',
    cryptfire_covenant_fiends_crypt_feast:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    cryptfire_covenant_fiends_ash_rite:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    cryptfire_covenant_fiends_hellgate:
      'When revealed, give the opponent {amount} Dread. If this wins, give them {bonus} more Dread.',
    cryptfire_covenant_fiends_doom_march:
      'Gets +{rate} for each Dread on the opponent, currently +{amount}.',
    cryptfire_covenant_fiends_graveburn:
      'If the opponent has at least {threshold} Dread, their card gets -{amount}.',
    cryptfire_covenant_fiends_endtime: 'When revealed, give the opponent {amount} Dread.',
    tableborn_circle_gamblers_deal:
      'Gets +{rate} for each Human card you have played this match, currently +{amount}. Lower value wins this comparison.',
    tableborn_circle_gamblers_small_bet:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    tableborn_circle_gamblers_card_trick: 'Gets +{amount} if your previous card lost.',
    tableborn_circle_gamblers_poker_night: 'Gets +{amount} during round {round} or later.',
    tableborn_circle_gamblers_bad_hand:
      'Gets +{amount} after you lose {threshold} rounds in a row.',
    tableborn_circle_gamblers_bluff:
      'Gets +{rate} for each Human card you have played this match, currently +{amount}.',
    tableborn_circle_gamblers_lucky_draw:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    tableborn_circle_gamblers_table_flip: 'Gets +{amount} if your previous card lost.',
    tableborn_circle_gamblers_final_bet: 'Gets +{amount} during round {round} or later.',
    tableborn_circle_gamblers_grand_game:
      'Gets +{amount} after you lose {threshold} rounds in a row.',
    greenwake_circle_treants_sprout:
      'Gets +{rate} for each Elemental card you have played this match, currently +{amount}. It also counts as a Spirit this round.',
    greenwake_circle_treants_rain_song:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    greenwake_circle_treants_root_race: 'Gets +{amount} if your previous card lost.',
    greenwake_circle_treants_orchard_walk: 'Gets +{amount} during round {round} or later.',
    greenwake_circle_treants_stag_hunt:
      'Gets +{amount} after you lose {threshold} rounds in a row.',
    greenwake_circle_treants_bloom:
      'Gets +{rate} for each Elemental card you have played this match, currently +{amount}.',
    greenwake_circle_treants_grove_dance:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    greenwake_circle_treants_wild_hunt: 'Gets +{amount} if your previous card lost.',
    greenwake_circle_treants_long_sleep: 'Gets +{amount} during round {round} or later.',
    greenwake_circle_treants_awakening:
      'Gets +{amount} after you lose {threshold} rounds in a row.',
    boneflame_host_skeletons_spark:
      'If this loses, return your highest Undead of value {threshold} or lower from your discard to your hand and draw {drawCount} cards.',
    boneflame_host_skeletons_bone_toss:
      'If this loses, return your highest Undead of value {threshold} or lower from discard to hand.',
    boneflame_host_skeletons_ash_dance:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    boneflame_host_skeletons_grave_run:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    boneflame_host_skeletons_fire_walk:
      'Gets +{rate} for each Undead you have lost this match, currently +{amount}.',
    boneflame_host_skeletons_pyre:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    boneflame_host_skeletons_crypt_roast:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    boneflame_host_skeletons_last_march:
      'If this wins, return your highest Undead of value {threshold} or lower from discard to hand.',
    boneflame_host_skeletons_bone_feast: 'Whenever this loses, draw {amount} card.',
    boneflame_host_skeletons_inferno: 'If this wins, your next card gets +{amount}.',
    fenward_hunters_scout:
      'The opponent card gets -{amount} if it is a {threshold} or higher. When revealed, silence the opposing card this round.',
    fenward_hunters_net_cast: 'Gets +{amount} if the opponent card is a {threshold} or higher.',
    fenward_hunters_bog_hunt: 'The opponent card gets -{amount} if it is a {threshold} or higher.',
    fenward_hunters_spider_trap: 'Gets +{amount} if the opponent card is Spider.',
    fenward_hunters_trail: 'The opponent card gets -{amount} if it is a {threshold} or higher.',
    fenward_hunters_night_hunt: 'Gets +{amount} if the opponent card is a {threshold} or higher.',
    fenward_hunters_web_raid: 'The opponent card gets -{amount} if it is a {threshold} or higher.',
    fenward_hunters_mire_watch: 'Gets +{amount} if the opponent card is Spider.',
    fenward_hunters_queen_hunt:
      'The opponent card gets -{amount} if it is a {threshold} or higher.',
    fenward_hunters_homecoming: 'The opponent card cannot exceed {amount} this round.',
    relicguard_order_sentinels_vigil:
      'When revealed, lower value wins the comparison. When revealed, silence the opposing card this round.',
    relicguard_order_sentinels_key_turn: 'This card wins tied rounds.',
    relicguard_order_sentinels_vault_watch: 'This card cannot be reduced below {amount}.',
    relicguard_order_sentinels_seal: 'The opponent card cannot exceed {amount} this round.',
    relicguard_order_sentinels_relic_hunt: 'This card becomes the opponent card base value.',
    relicguard_order_sentinels_oath:
      'The first time this is revealed, the opponent card has no effect this round.',
    relicguard_order_sentinels_crypt_guard:
      'The first time this is played, swap both effective values.',
    relicguard_order_sentinels_gate_lock: 'This card cannot be reduced below {amount}.',
    relicguard_order_sentinels_last_watch: 'The opponent card cannot exceed {amount} this round.',
    relicguard_order_sentinels_final_oath: 'If this wins, your next card gets +{amount}.',
    questbound_caravan_travelers_errand:
      'Whenever this loses, draw {amount} cards and return your highest card of value {threshold} or lower from your discard to your hand.',
    questbound_caravan_travelers_wrong_turn: 'Whenever this loses, draw {amount} card.',
    questbound_caravan_travelers_bridge_stop: 'Whenever this loses, draw {amount} card.',
    questbound_caravan_travelers_camp: 'Gets +{amount} while you are behind on rounds.',
    questbound_caravan_travelers_side_quest: 'Gets +{amount} while you are behind on rounds.',
    questbound_caravan_travelers_cart_fix: 'Gets +{amount} while you are behind on rounds.',
    questbound_caravan_travelers_road_meal: 'Gets +{amount} while you are behind on rounds.',
    questbound_caravan_travelers_lost_map: 'Gets +{amount} while you are behind on rounds.',
    questbound_caravan_travelers_boss_fight: 'Whenever this wins, draw {amount} card.',
    questbound_caravan_travelers_homecoming: 'If this wins, your next card gets +{amount}.',
    crownless_legends_whisper:
      'Gets +{rate} for each Spirit card you have played this match, currently +{amount}. Lower value wins this comparison.',
    crownless_legends_exile:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    crownless_legends_broken_oath: 'Gets +{amount} if your previous card lost.',
    crownless_legends_empty_hall: 'Gets +{amount} during round {round} or later.',
    crownless_legends_last_song: 'Gets +{amount} after you lose {threshold} rounds in a row.',
    crownless_legends_ghost_court:
      'Gets +{rate} for each Spirit card you have played this match, currently +{amount}.',
    crownless_legends_lost_crown:
      'Gets +{amount} if you have played at least {threshold} different tribes.',
    crownless_legends_kingless_feast: 'Gets +{amount} if your previous card lost.',
    crownless_legends_final_war: 'Gets +{amount} during round {round} or later.',
    crownless_legends_return: 'Gets +{amount} after you lose {threshold} rounds in a row.',
  },
  // The Card Master's regulars (src/sim/content/cards/opponents.ts). Each is a
  // content record, so a new one is a data change plus three strings here.
  opponent: {
    dockhand_pell: {
      name: 'Pell',
      title: 'Dockhand',
      greeting: 'Mind the mud. It bites back down my way.',
    },
    gravedigger_ossa: {
      name: 'Ossa',
      title: 'Gravedigger',
      greeting: 'Nothing I bury stays buried for long.',
    },
    huntsman_bregg: {
      name: 'Bregg',
      title: 'Huntsman',
      greeting: 'One wolf is a nuisance. Six is a hunt.',
    },
    the_card_master: {
      name: 'The Card Master',
      title: 'Keeper of the Table',
      greeting: 'Sit. Everyone gets the same twenty cards. Show me which ones you chose.',
    },
  },

  // Tribe names, shown on the card face and in the deck builder filters.
  tribe: {
    Beast: 'Beast',
    Human: 'Human',
    Undead: 'Undead',
    Demon: 'Demon',
    Spider: 'Spider',
    Mudfin: 'Mudfin',
    Burrower: 'Burrower',
    Construct: 'Construct',
    Elemental: 'Elemental',
    Spirit: 'Spirit',
    Dragon: 'Dragon',
    Bandit: 'Bandit',
  },

  // Counter names (src/sim/minigames/card_duel/), shown as tokens on the duel
  // table. The sim-side key is an id, never text: every counter a shipped card
  // can put on a side needs a name here (pinned by tests/card_catalog.test.ts).
  counter: {
    Pack: 'Pack',
    Web: 'Web',
    Dread: 'Dread',
  },

  card: {
    valueLabel: 'Value {value}',
    effectiveLabel: 'Effective value {value}',
    play: 'Play {name}',
    // The accessible name for a playable card. The hand size has no room for
    // the rules sentence, and a hidden node is out of the accessibility tree,
    // so the sentence rides the button label instead.
    playDetail: 'Play {name}, worth {value}. {rules}',
  },
};
