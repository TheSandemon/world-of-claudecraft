// The Card Duel presentation layer: the card face, the duel table, and the
// round theater that plays a resolved round out at a human pace.
//
// Everything that renders a Card Duel card or table (the duel window's hand,
// the stage, the deck builder's collection cells, and the standalone /cards
// playtest slice) goes through these modules, so a card and a table look and
// read the same wherever they appear. See ./CLAUDE.md.

export * from './card_face_markup';
export * from './card_face_view';
export * from './card_flight';
export * from './card_flight_core';
export * from './card_inspect';
export * from './card_inspect_view';
export * from './card_round_feedback';
export * from './duel_beats_core';
export * from './duel_card_motion';
export * from './duel_outro_core';
export * from './duel_summary_view';
export * from './duel_table_markup';
export * from './duel_table_view';
export * from './duel_theater';
export * from './duel_theater_host';
