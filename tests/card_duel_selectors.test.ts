import { describe, expect, it } from 'vitest';
import { cardMatches, resolveTargets } from '../src/sim/minigames/card_duel/selectors';
import { Rng } from '../src/sim/rng';
import {
  countingRng,
  defineCard,
  evalContext,
  instanceOf,
  lockIn,
  makeCatalog,
  makeMatch,
} from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'], tags: ['Wolf'] });
const alpha = defineCard('alpha', { value: 8, tribes: ['Beast'] });
const ranger = defineCard('ranger', { value: 5, tribes: ['Human'] });
const ghoul = defineCard('ghoul', { value: 2, tribes: ['Undead'] });
const catalog = makeCatalog([wolf, alpha, ranger, ghoul]);

function handMatch() {
  const state = makeMatch(
    [instanceOf(wolf, 11), instanceOf(alpha, 12), instanceOf(ranger, 13), instanceOf(ghoul, 14)],
    [instanceOf(ranger, 21)],
  );
  return state;
}

describe('card_duel selectors', () => {
  it('cardMatches ANDs every declared field and never narrows on an absent one', () => {
    const card = instanceOf(wolf);
    expect(cardMatches(card, wolf, undefined)).toBe(true);
    expect(cardMatches(card, wolf, { tribe: 'Beast' })).toBe(true);
    expect(cardMatches(card, wolf, { tribe: 'Undead' })).toBe(false);
    expect(cardMatches(card, wolf, { tag: 'Wolf', tribe: 'Beast' })).toBe(true);
    expect(cardMatches(card, wolf, { tag: 'Boss', tribe: 'Beast' })).toBe(false);
    expect(cardMatches(card, wolf, { maxValue: 3 })).toBe(true);
    expect(cardMatches(card, wolf, { minValue: 4 })).toBe(false);
    expect(cardMatches(card, wolf, { cardId: 'wolf' })).toBe(true);
    expect(cardMatches(card, wolf, { cardId: 'alpha' })).toBe(false);
    // A card whose definition is missing (a retired id) matches only filters
    // that do not need the definition.
    expect(cardMatches(card, undefined, { value: 3 })).toBe(true);
    expect(cardMatches(card, undefined, { tribe: 'Beast' })).toBe(false);
  });

  it('defaults to this card when a card declares no target', () => {
    const state = handMatch();
    lockIn(state, state.a.cards.hand[0], state.b.cards.hand[0]);
    const ctx = evalContext(state, catalog, 'a');
    expect(resolveTargets(undefined, ctx, new Rng(1))).toEqual([{ kind: 'board', seat: 'a' }]);
  });

  it('resolves owner-relative board and player targets from either seat', () => {
    const state = handMatch();
    lockIn(state, state.a.cards.hand[0], state.b.cards.hand[0]);
    const fromA = evalContext(state, catalog, 'a');
    const fromB = evalContext(state, catalog, 'b');
    expect(resolveTargets({ type: 'opponentCard' }, fromA, new Rng(1))).toEqual([
      { kind: 'board', seat: 'b' },
    ]);
    expect(resolveTargets({ type: 'opponentCard' }, fromB, new Rng(1))).toEqual([
      { kind: 'board', seat: 'a' },
    ]);
    expect(resolveTargets({ type: 'player', owner: 'self' }, fromB, new Rng(1))).toEqual([
      { kind: 'player', seat: 'b' },
    ]);
  });

  it('highest and lowest pick by value, breaking ties on instance id, not array order', () => {
    const state = makeMatch([instanceOf(wolf, 30), instanceOf(wolf, 20), instanceOf(alpha, 40)]);
    const ctx = evalContext(state, catalog, 'a');
    const rng = countingRng();
    const highest = resolveTargets(
      { type: 'zone', owner: 'self', zone: 'hand', select: 'highest' },
      ctx,
      rng,
    );
    expect(highest).toEqual([
      { kind: 'zoneCard', seat: 'a', zone: 'hand', card: state.a.cards.hand[2] },
    ]);
    const lowest = resolveTargets(
      { type: 'zone', owner: 'self', zone: 'hand', select: 'lowest' },
      ctx,
      rng,
    );
    // Both wolves are value 3; the lower instance id (20) wins the tie even
    // though it sits second in the hand.
    expect((lowest[0] as { card: { iid: number } }).card.iid).toBe(20);
    // Neither selector may draw: only `random` is an rng site.
    expect(rng.draws).toBe(0);
  });

  it('filters a zone before selecting, and `all` returns every match', () => {
    const state = handMatch();
    const ctx = evalContext(state, catalog, 'a');
    const beasts = resolveTargets(
      { type: 'zone', owner: 'self', zone: 'hand', select: 'all', match: { tribe: 'Beast' } },
      ctx,
      countingRng(),
    );
    expect(beasts.map((t) => (t as { card: { iid: number } }).card.iid)).toEqual([11, 12]);
  });

  it('random draws exactly one number per card picked and never repeats a card', () => {
    const state = handMatch();
    const ctx = evalContext(state, catalog, 'a');
    const rng = countingRng([0.99, 0.0, 0.5]);
    const picked = resolveTargets(
      { type: 'zone', owner: 'self', zone: 'hand', select: 'random', count: 3 },
      ctx,
      rng,
    );
    expect(rng.draws).toBe(3);
    const iids = picked.map((t) => (t as { card: { iid: number } }).card.iid);
    expect(new Set(iids).size).toBe(3);
  });

  it('random over the same seed always picks the same cards', () => {
    const pick = () => {
      const state = handMatch();
      const ctx = evalContext(state, catalog, 'a');
      return resolveTargets(
        { type: 'zone', owner: 'self', zone: 'hand', select: 'random', count: 2 },
        ctx,
        new Rng(77),
      ).map((t) => (t as { card: { iid: number } }).card.iid);
    };
    expect(pick()).toEqual(pick());
  });

  it('a pool smaller than the count yields fewer targets rather than drawing wastefully', () => {
    const state = makeMatch([instanceOf(wolf, 11)]);
    const ctx = evalContext(state, catalog, 'a');
    const rng = countingRng([0.4]);
    const picked = resolveTargets(
      { type: 'zone', owner: 'self', zone: 'hand', select: 'random', count: 4 },
      ctx,
      rng,
    );
    expect(picked.length).toBe(1);
    expect(rng.draws).toBe(1);
  });

  it('nextCard carries its filter through to the parked modifier', () => {
    const state = handMatch();
    const ctx = evalContext(state, catalog, 'a');
    expect(
      resolveTargets(
        { type: 'nextCard', owner: 'self', match: { tribe: 'Undead' } },
        ctx,
        new Rng(1),
      ),
    ).toEqual([{ kind: 'nextCard', seat: 'a', match: { tribe: 'Undead' } }]);
  });
});
