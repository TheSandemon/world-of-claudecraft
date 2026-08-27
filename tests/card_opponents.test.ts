import { describe, expect, it } from 'vitest';
import {
  buildOpponentDeck,
  CARD_CATALOG,
  CARD_OPPONENTS,
  CARDS,
  cardById,
  cardOpponentById,
  cardsOfSet,
} from '../src/sim/content/cards';
import { validateDeck } from '../src/sim/minigames/card_duel';
import { CARD_BOT_TIERS } from '../src/sim/minigames/card_duel/bot';
import type { CardSetId } from '../src/sim/minigames/card_duel/types';
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

  it('each regular is built from WHOLE design identities, never a sampler', () => {
    // A regular exists to teach an archetype, so its deck has to be one a player
    // could recognise and rebuild: two complete identities, twenty cards, two at
    // every value. Taking half of one would demonstrate nothing.
    for (const opponent of CARD_OPPONENTS) {
      const sets = new Set(opponent.favours.map((id) => cardById(id)?.set));
      expect(sets.size, `${opponent.id} draws on ${sets.size} identities`).toBe(2);
      expect(opponent.favours.length, `${opponent.id} favours list`).toBe(20);
      for (const set of sets) {
        expect(set, `${opponent.id} favours a card outside the authored sets`).toBeDefined();
        expect(
          cardsOfSet(set as CardSetId).every((def) => opponent.favours.includes(def.id)),
          `${opponent.id} takes only part of ${set}`,
        ).toBe(true);
      }
    }
  });

  it('no identity is used twice, so the four regulars teach four things', () => {
    const seen = new Set<string>();
    for (const opponent of CARD_OPPONENTS) {
      for (const id of opponent.favours) {
        const set = cardById(id)?.set;
        if (set) seen.add(set);
      }
    }
    expect(seen.size).toBe(CARD_OPPONENTS.length * 2);
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
    const threes = CARDS.filter((def) => def.value === 3)
      .slice(0, 3)
      .map((def) => def.id);
    expect(threes.length).toBe(3);
    expect(threes.every((id) => cardById(id)?.value === 3)).toBe(true);
    expect(validateDeck(buildOpponentDeck(threes), CARD_CATALOG)).toEqual({ ok: true });
  });

  it('ignores a favours entry naming a card that no longer exists', () => {
    const deck = buildOpponentDeck(['a_card_that_was_retired', 'briarpack_wolves_howl']);
    expect(validateDeck(deck, CARD_CATALOG)).toEqual({ ok: true });
    expect(deck.some((entry) => entry.cardId === 'briarpack_wolves_howl')).toBe(true);
  });
});
