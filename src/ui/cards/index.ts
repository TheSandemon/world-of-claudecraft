// The card face component: one pure core, one thin painter, three sizes.
//
// Everything that renders a Card Duel card (the duel window's hand, the reveal
// stage, and the deck builder's collection cells) goes through this pair, so a
// card looks and reads the same wherever it appears. See ./CLAUDE.md.

export * from './card_face_markup';
export * from './card_face_view';
export * from './card_round_feedback';
