import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, cardById, cardsOfValue } from '../src/sim/content/cards';
import { BASIC_CARD_DEFINITIONS } from '../src/sim/minigames/card_duel/basic_catalog';
import { COPIES_PER_VALUE } from '../src/sim/minigames/card_duel/deck';
import { EFFECT_PRIORITY } from '../src/sim/minigames/card_duel/resolve';
import { resolveCardText, staticCardContext } from '../src/sim/minigames/card_duel/text';
import { CARD_TRIBES, CARD_VALUES } from '../src/sim/minigames/card_duel/types';
import { cardsStrings } from '../src/ui/i18n.catalog/cards';

const names = cardsStrings.name as Record<string, string>;
const texts = cardsStrings.text as Record<string, string>;
const tribeNames = cardsStrings.tribe as Record<string, string>;
const counterNames = cardsStrings.counter as Record<string, string>;

/** Every counter key any shipped card can put on a side. Walks the effect
 *  trees rather than a hand-kept list, so a new counter is caught the day it
 *  is authored. */
function authoredCounters(): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.counter === 'string') found.add(record.counter);
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) for (const item of value) walk(item);
      else walk(value);
    }
  };
  for (const def of CARDS) walk(def);
  return [...found].sort();
}

/** Every {placeholder} an English sentence reads. */
function placeholders(sentence: string): string[] {
  return [...sentence.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]).sort();
}

describe('card catalog', () => {
  it('every card id is unique and stable', () => {
    const ids = CARDS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Id order is sorted, so any walk of the catalog is deterministic across
    // hosts rather than depending on module authoring order.
    expect([...ids].sort()).toEqual(ids);
  });

  it('offers at least COPIES_PER_VALUE distinct cards at every value', () => {
    // The deck rule is two cards per value with no repeats, so a value with
    // fewer than two authored cards makes a legal deck unbuildable.
    for (const value of CARD_VALUES) {
      const pool = cardsOfValue(value);
      expect(pool.length, `value ${value} has ${pool.length} cards`).toBeGreaterThanOrEqual(
        COPIES_PER_VALUE,
      );
    }
  });

  it('every card names a real tribe and a sane rarity', () => {
    for (const def of CARDS) {
      for (const tribe of def.tribes) expect(CARD_TRIBES).toContain(tribe);
      expect(new Set(def.tribes).size).toBe(def.tribes.length);
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(def.rarity);
      expect(CARD_VALUES).toContain(def.value);
    }
  });

  it('every card has an English name and rules sentence in the catalog', () => {
    for (const def of CARDS) {
      expect(names[def.nameId], `${def.id} has no cards.name.${def.nameId}`).toBeTypeOf('string');
      expect(texts[def.textId], `${def.id} has no cards.text.${def.textId}`).toBeTypeOf('string');
      expect(names[def.nameId].length).toBeGreaterThan(0);
      expect(texts[def.textId].length).toBeGreaterThan(0);
    }
  });

  it('the catalog carries no orphan name or text entry', () => {
    const nameIds = new Set(CARDS.map((def) => def.nameId));
    const textIds = new Set(CARDS.map((def) => def.textId));
    for (const key of Object.keys(names)) expect(nameIds.has(key), `orphan name ${key}`).toBe(true);
    for (const key of Object.keys(texts)) expect(textIds.has(key), `orphan text ${key}`).toBe(true);
  });

  it('every counter a card can place has a localized name, and none is orphaned', () => {
    // The duel table shows counters as tokens, so an unnamed counter is a
    // token with no label rather than a silently missing line of text.
    const authored = authoredCounters();
    expect(authored.length).toBeGreaterThan(0);
    for (const counter of authored) {
      expect(counterNames[counter], `counter ${counter} has no name`).toBeTypeOf('string');
    }
    expect(Object.keys(counterNames).sort()).toEqual(authored);
  });

  it('every tribe has a localized name', () => {
    for (const tribe of CARD_TRIBES) expect(tribeNames[tribe]).toBeTypeOf('string');
    expect(Object.keys(tribeNames).sort()).toEqual([...CARD_TRIBES].sort());
  });

  it('every {placeholder} in a rules sentence is a value the card can actually supply', () => {
    const ctx = staticCardContext(CARD_CATALOG);
    for (const def of CARDS) {
      const wanted = placeholders(texts[def.textId]);
      const supplied = Object.keys(resolveCardText(def, ctx).values).sort();
      for (const name of wanted) {
        expect(
          supplied,
          `${def.id}: text reads {${name}} but its effects supply [${supplied.join(', ')}]`,
        ).toContain(name);
      }
    }
  });

  it('resolves a scaling card text to its live number, not its formula', () => {
    // "Gets +{rate} for each Pack you have, currently +{amount}": the RATE is
    // printed on the card and the AMOUNT is live, so a player never has to do
    // the multiplication themselves.
    const howl = cardById('briarpack_wolves_howl');
    expect(howl).toBeDefined();
    const ctx = staticCardContext(CARD_CATALOG);
    expect(texts.briarpack_wolves_howl).toContain('{rate}');
    expect(texts.briarpack_wolves_howl).toContain('{amount}');
    expect(resolveCardText(howl!, ctx).values.rate).toBe(3);
    // Before any Pack is banked the bonus really is zero, and the tooltip
    // contract says show the value that would apply.
    expect(resolveCardText(howl!, ctx).values.amount).toBe(0);
  });

  it('states a reduction as a positive number, so the sentence owns the sign', () => {
    const windRace = cardById('stormheart_conclave_stormlings_wind_race');
    expect(windRace).toBeDefined();
    expect(texts.stormheart_conclave_stormlings_wind_race).toContain('-{amount}');
    expect(resolveCardText(windRace!, staticCardContext(CARD_CATALOG)).values.amount).toBe(10);
  });

  it('prints no bare number in a rules sentence: every number is a live value', () => {
    // A hardcoded number in the English is a number that cannot follow the
    // effect when it is tuned, and a number a translator has to retype. The
    // only digits a sentence may carry are inside a {placeholder}.
    for (const def of CARDS) {
      const withoutPlaceholders = texts[def.textId].replace(/\{[^}]*\}/g, '');
      expect(
        /[0-9]/.test(withoutPlaceholders),
        `${def.id}: "${texts[def.textId]}" hardcodes a number`,
      ).toBe(false);
    }
  });

  it('every authored effect uses a primitive the resolver has a priority for', () => {
    for (const def of CARDS) {
      for (const effect of def.effects) {
        expect(
          EFFECT_PRIORITY[effect.effect.type],
          `${def.id} uses ${effect.effect.type} with no resolution priority`,
        ).toBeTypeOf('number');
      }
    }
  });

  it('a card that parks a buff on a future card declares a duration that outlives the round', () => {
    for (const def of CARDS) {
      for (const effect of def.effects) {
        if (effect.target?.type !== 'nextCard') continue;
        expect(
          effect.duration,
          `${def.id} parks on a next card without saying how long it lasts`,
        ).toBeDefined();
      }
    }
  });

  it('the basics sit behind the authored catalog and never shadow a real card', () => {
    for (const basic of BASIC_CARD_DEFINITIONS) {
      expect(CARD_CATALOG.get(basic.id)?.id).toBe(basic.id);
      expect(CARDS.some((def) => def.id === basic.id)).toBe(false);
    }
    for (const def of CARDS) expect(CARD_CATALOG.get(def.id)).toBe(def);
  });

  it('resolves an unknown (retired) card id to undefined rather than throwing', () => {
    expect(CARD_CATALOG.get('a_card_that_was_retired')).toBeUndefined();
    expect(cardById('a_card_that_was_retired')).toBeUndefined();
  });
});
