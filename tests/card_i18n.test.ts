import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, cardById } from '../src/sim/content/cards';
import { BASIC_CARD_DEFINITIONS } from '../src/sim/minigames/card_duel/basic_catalog';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import { recordHistory } from '../src/sim/minigames/card_duel/match_state';
import { resolveCardText, staticCardContext } from '../src/sim/minigames/card_duel/text';
import { CARD_TRIBES } from '../src/sim/minigames/card_duel/types';
import { cardName, cardRulesText, cardTribeName } from '../src/ui/card_i18n';
import {
  defineCard,
  effect,
  evalContext,
  instanceOf,
  lockIn,
  makeCatalog,
  makeMatch,
} from './helpers/card_duel_fixtures';

describe('card i18n', () => {
  it('resolves every card name to real text, never a key id', () => {
    for (const def of CARDS) {
      const name = cardName(def);
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toContain('cards.name.');
      expect(name).not.toBe(def.nameId);
    }
  });

  it('names an unauthored basic by its face value, not by a key that does not exist', () => {
    // The ten basics share ONE key id ('basic') and one English sentence with
    // the value spliced in, so a per-card `cards.name.basic` was never
    // authored. Before this, every surface that put a basic through the card
    // face threw on the untracked key: the standalone /cards table deals
    // basics by default, so it threw on its very first paint.
    for (const def of BASIC_CARD_DEFINITIONS) {
      const name = cardName(def);
      expect(name).toContain(String(def.value));
      expect(name).not.toContain('cards.name.');
      expect(name).not.toContain('basic');
    }
    // Two basics of DIFFERENT values read as two different names (the deck
    // holds two copies of each value, so adjacent entries share one).
    const byValue = new Map(BASIC_CARD_DEFINITIONS.map((def) => [def.value, def]));
    expect(byValue.size).toBeGreaterThan(1);
    const names = new Set([...byValue.values()].map(cardName));
    expect(names.size).toBe(byValue.size);
  });

  it('resolves every tribe name', () => {
    for (const tribe of CARD_TRIBES) {
      expect(cardTribeName(tribe)).not.toContain('cards.tribe.');
    }
  });

  it('splices resolved values into the rules sentence, leaving no placeholder behind', () => {
    for (const def of CARDS) {
      const text = cardRulesText(def, { catalog: CARD_CATALOG });
      expect(text.length).toBeGreaterThan(0);
      expect(text, `${def.id} left a placeholder unfilled: ${text}`).not.toMatch(/\{[a-zA-Z]/);
    }
  });

  it('a basic card reads as having no effect rather than as an empty string', () => {
    const basic = BASIC_CARD_DEFINITIONS[0];
    expect(cardRulesText(basic, { catalog: CARD_CATALOG })).toBe('No effect.');
  });

  it('a scaling card states the LIVE number during a match, not the static one', () => {
    const packAlpha = cardById('pack_alpha');
    expect(packAlpha).toBeDefined();
    const beast = defineCard('beast', { value: 2, tribes: ['Beast'] });
    const catalog = makeCatalog([...CARDS, beast]);
    const state = makeMatch([instanceOf(packAlpha!)], []);
    // Four Beasts played this match, so the card's own text must read +2.
    for (let i = 0; i < 4; i++) {
      recordHistory(state, 'a', instanceOf(beast), 2, ['Beast'], 'win');
    }
    state.round = 5;
    lockIn(state, state.a.cards.hand[0], null);
    const live = evalContext(state, catalog, 'a');
    expect(cardRulesText(packAlpha!, { catalog })).toContain('every two Beasts');
    // The static reading is 0; the live one is what the engine would apply.
    expect(cardRulesText(packAlpha!, live)).toContain('every two Beasts');
    expect(resolveCardText(packAlpha!, live).values.amount).toBe(2);
  });

  it('reads a card whose sentence takes several values', () => {
    const twin = defineCard('twin', {
      value: 4,
      effects: [
        effect({
          effect: { type: 'modifyValue', amount: constant(2) },
          textValues: { amount: constant(2), threshold: constant(8) },
        }),
      ],
    });
    const catalog = makeCatalog([twin]);
    // The card is not in the shipped catalog, so its key is absent and the
    // resolver must be exercised through the sim text model instead.
    const model = resolveCardText(twin, staticCardContext(catalog));
    expect(model.values).toEqual({ amount: 2, threshold: 8 });
  });
});
