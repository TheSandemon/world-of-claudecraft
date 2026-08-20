import { describe, expect, it } from 'vitest';
import {
  buildOpponentDeck,
  CARD_CATALOG,
  CARD_OPPONENTS,
  cardById,
  cardOpponentById,
} from '../src/sim/content/cards';
import { validateDeck } from '../src/sim/minigames/card_duel';
import { CARD_BOT_TIERS } from '../src/sim/minigames/card_duel/bot';
import { cardsStrings } from '../src/ui/i18n.catalog/cards';

const names = cardsStrings.opponent as Record<
  string,
  { name: string; title: string; greeting: string }
>;

describe('card duel regulars', () => {
  it('every regular holds a legal deck, the same rule players are held to', () => {
    for (const opponent of CARD_OPPONENTS) {
      const deck = buildOpponentDeck(opponent.favours);
      const verdict = validateDeck(deck, CARD_CATALOG);
      expect(verdict, `${opponent.id}: ${verdict.reason} ${verdict.detail}`).toEqual({ ok: true });
    }
  });

  it('a themed list actually reaches the deck it asked for', () => {
    const ossa = cardOpponentById('gravedigger_ossa');
    expect(ossa).toBeDefined();
    const ids = new Set(buildOpponentDeck(ossa!.favours).map((entry) => entry.cardId));
    for (const wanted of ossa!.favours) expect(ids.has(wanted), `${wanted} missing`).toBe(true);
  });

  it('each regular showcases one archetype, so facing them teaches it', () => {
    const tribeOf = (id: string) => cardById(id)?.tribes ?? [];
    expect(
      cardOpponentById('dockhand_pell')!.favours.every((id) => tribeOf(id).includes('Mudfin')),
    ).toBe(true);
    expect(
      cardOpponentById('huntsman_bregg')!.favours.some((id) => tribeOf(id).includes('Beast')),
    ).toBe(true);
  });

  it('names a real difficulty tier', () => {
    for (const opponent of CARD_OPPONENTS) {
      expect(CARD_BOT_TIERS).toContain(opponent.difficulty);
    }
  });

  it('the ladder runs from Novice to Master, with the Card Master at the top', () => {
    const tiers = CARD_OPPONENTS.map((o) => o.difficulty);
    expect(tiers).toContain('novice');
    expect(tiers).toContain('master');
    expect(cardOpponentById('the_card_master')?.difficulty).toBe('master');
  });

  it('every regular has a name, a title, and a greeting in the catalog', () => {
    for (const opponent of CARD_OPPONENTS) {
      const entry = names[opponent.nameId];
      expect(entry, `no cards.opponent.${opponent.nameId}`).toBeDefined();
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.greeting.length).toBeGreaterThan(0);
    }
  });

  it('carries key ids, never English, because the sim stays language-agnostic', () => {
    for (const opponent of CARD_OPPONENTS) {
      for (const id of [opponent.nameId, opponent.titleId, opponent.greetingId]) {
        expect(id).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });

  it('ids are unique', () => {
    const ids = CARD_OPPONENTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a favours list that asks for too much of one value still yields a legal deck', () => {
    // Three value-3 cards cannot all fit in two slots: the builder takes what
    // it can and fills the rest, rather than shipping an unplayable regular.
    const threes = ['forest_wolf', 'bramble_sprite', 'bone_picker'];
    expect(threes.every((id) => cardById(id)?.value === 3)).toBe(true);
    expect(validateDeck(buildOpponentDeck(threes), CARD_CATALOG)).toEqual({ ok: true });
  });

  it('ignores a favours entry naming a card that no longer exists', () => {
    const deck = buildOpponentDeck(['a_card_that_was_retired', 'forest_wolf']);
    expect(validateDeck(deck, CARD_CATALOG)).toEqual({ ok: true });
    expect(deck.some((entry) => entry.cardId === 'forest_wolf')).toBe(true);
  });
});
