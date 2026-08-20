import { describe, expect, it } from 'vitest';
import { cardById } from '../src/sim/content/cards';
import {
  buildCardFaceModel,
  cardFaceSignature,
  deltaLabel,
  rarityClass,
} from '../src/ui/cards/card_face_view';
import { defineCard } from './helpers/card_duel_fixtures';

const wolf = defineCard('forest_wolf', {
  value: 3,
  tribes: ['Beast'],
  rarity: 'common',
  art: 'forest_wolf',
});

const wire = (over: Partial<{ iid: number; cardId: string; value: number }> = {}) => ({
  iid: 11,
  cardId: 'forest_wolf',
  value: 3,
  ...over,
});

describe('card face view', () => {
  it('maps identity, values, tribes, and rarity off the definition', () => {
    const model = buildCardFaceModel(wire(), wolf);
    expect(model).toMatchObject({
      iid: 11,
      cardId: 'forest_wolf',
      art: 'forest_wolf',
      nameId: 'forest_wolf_name',
      textId: 'forest_wolf_text',
      baseValue: 3,
      effectiveValue: 3,
      delta: 0,
      tribes: ['Beast'],
      rarity: 'common',
      size: 'hand',
      unknown: false,
    });
  });

  it('a card in hand is worth its printed value until an effect moves it', () => {
    expect(buildCardFaceModel(wire(), wolf).effectiveValue).toBe(3);
    const buffed = buildCardFaceModel(wire(), wolf, { effectiveValue: 6 });
    expect(buffed.effectiveValue).toBe(6);
    expect(buffed.delta).toBe(3);
    expect(deltaLabel(buffed)).toBe('+3');
    const hexed = buildCardFaceModel(wire(), wolf, { effectiveValue: 1 });
    expect(hexed.delta).toBe(-2);
    expect(deltaLabel(hexed)).toBe('-2');
    // No modifier, no strip: the label is what the face shows, so an unchanged
    // card must not read as "+0".
    expect(deltaLabel(buildCardFaceModel(wire(), wolf))).toBe('');
  });

  it('renders a retired card id from the instance alone rather than throwing', () => {
    const model = buildCardFaceModel(wire({ cardId: 'a_card_that_was_retired' }), undefined);
    expect(model.unknown).toBe(true);
    expect(model.baseValue).toBe(3);
    expect(model.tribes).toEqual([]);
    // The art id falls back to the card id, which resolves to no file and
    // therefore to the procedural face rather than a broken image.
    expect(model.art).toBe('a_card_that_was_retired');
  });

  it('carries the resolved rules-text values through untouched', () => {
    const model = buildCardFaceModel({ ...wire(), textValues: { amount: 2 } }, wolf);
    expect(model.textValues).toEqual({ amount: 2 });
    // A copy, so a later snapshot cannot mutate a model already painted.
    model.textValues.amount = 99;
    expect(buildCardFaceModel({ ...wire(), textValues: { amount: 2 } }, wolf).textValues).toEqual({
      amount: 2,
    });
  });

  it('the signature moves for every fact a player acts on', () => {
    const base = buildCardFaceModel(wire(), wolf, { playable: true });
    const sig = cardFaceSignature(base);
    expect(cardFaceSignature(buildCardFaceModel(wire(), wolf, { playable: true }))).toBe(sig);
    for (const changed of [
      buildCardFaceModel(wire(), wolf, { playable: false }),
      buildCardFaceModel(wire(), wolf, { playable: true, effectiveValue: 5 }),
      buildCardFaceModel(wire(), wolf, { playable: true, revealed: true }),
      buildCardFaceModel(wire(), wolf, { playable: true, silenced: true }),
      buildCardFaceModel(wire(), wolf, { playable: true, size: 'stage' }),
      buildCardFaceModel(wire({ iid: 12 }), wolf, { playable: true }),
      buildCardFaceModel({ ...wire(), textValues: { amount: 1 } }, wolf, { playable: true }),
    ]) {
      expect(cardFaceSignature(changed)).not.toBe(sig);
    }
  });

  it('rarity maps to a frame class per shipped quality, not a new color vocabulary', () => {
    expect(rarityClass('common')).toBe('cf-rarity-common');
    expect(rarityClass('legendary')).toBe('cf-rarity-legendary');
  });

  it('builds a face for every card in the shipping catalog', () => {
    for (const id of ['forest_wolf', 'pack_alpha', 'grix_tunnelking']) {
      const def = cardById(id);
      expect(def).toBeDefined();
      const model = buildCardFaceModel({ iid: 1, cardId: id, value: def!.value }, def);
      expect(model.unknown).toBe(false);
      expect(model.baseValue).toBe(def!.value);
    }
  });
});
