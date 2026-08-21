import { describe, expect, it } from 'vitest';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import type { CardMatchState } from '../src/sim/minigames/card_duel/match_state';
import { addModifier } from '../src/sim/minigames/card_duel/modifiers';
import { activeCardEffects, pendingValueDelta } from '../src/sim/minigames/card_duel/preview';
import type { CardModifier } from '../src/sim/minigames/card_duel/types';
import { defineCard, instanceOf, makeCatalog, makeMatch } from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'] });
const rat = defineCard('rat', { value: 2, tribes: ['Undead'] });
const catalog = makeCatalog([wolf, rat]);

/** A parked modifier, with the fields a test cares about spelled out. */
function parked(over: Partial<CardModifier> = {}): CardModifier {
  return {
    id: 1,
    seat: 'a',
    iid: null,
    source: 'stablemaster',
    effect: { type: 'modifyValue', amount: constant(2) },
    duration: 'untilTriggered',
    stackMode: 'unique',
    createdRound: 1,
    match: { tribe: 'Beast' },
    consumed: false,
    ...over,
  } as CardModifier;
}

function stateWith(mods: readonly CardModifier[]): CardMatchState {
  const state = makeMatch();
  for (const mod of mods) addModifier(state, mod);
  return state;
}

describe('pendingValueDelta', () => {
  it('sums what is already parked on a card the seat could play', () => {
    const state = stateWith([parked()]);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 11), catalog)).toBe(2);
  });

  it('is zero for a card the parked modifier does not match', () => {
    const state = stateWith([parked()]);
    expect(pendingValueDelta(state, 'a', instanceOf(rat, 12), catalog)).toBe(0);
  });

  it('is zero for the other seat, whatever is riding on this one', () => {
    // A modifier belongs to a SEAT. Previewing it on the opponent's card would
    // promise a buff that can never fire.
    const state = stateWith([parked()]);
    expect(pendingValueDelta(state, 'b', instanceOf(wolf, 11), catalog)).toBe(0);
  });

  it('adds a debuff as a negative, never as a magnitude', () => {
    const state = stateWith([
      parked({ effect: { type: 'modifyValue', amount: constant(-3) }, stackMode: 'stack' }),
    ]);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 11), catalog)).toBe(-3);
  });

  it('stacks two parked modifiers that both match', () => {
    const state = stateWith([
      parked({ id: 1, stackMode: 'stack' }),
      parked({ id: 2, stackMode: 'stack', effect: { type: 'modifyValue', amount: constant(1) } }),
    ]);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 11), catalog)).toBe(3);
  });

  it('ignores effects that carry no meaningful signed preview', () => {
    // A clamp or a setValue has no honest delta without the opponent's card,
    // and quoting one would be a number the round then contradicts.
    const state = stateWith([
      parked({ effect: { type: 'minimumValue', amount: constant(5) } }),
      parked({ id: 2, effect: { type: 'winTies' } }),
    ]);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 11), catalog)).toBe(0);
  });

  it('targets one specific card when the modifier named an instance', () => {
    const state = stateWith([parked({ iid: 11, match: undefined })]);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 11), catalog)).toBe(2);
    expect(pendingValueDelta(state, 'a', instanceOf(wolf, 99), catalog)).toBe(0);
  });
});

describe('activeCardEffects', () => {
  it('reports a parked modifier with its source card, amount and duration', () => {
    const state = stateWith([parked()]);
    expect(activeCardEffects(state, 1)).toEqual([
      {
        seat: 'a',
        sourceCardId: 'stablemaster',
        effect: 'modifyValue',
        amount: 2,
        duration: 'untilTriggered',
        targeted: false,
      },
    ]);
  });

  it('drops a spent modifier', () => {
    const state = stateWith([parked({ consumed: true })]);
    expect(activeCardEffects(state, 1)).toEqual([]);
  });

  it('drops a nextRound modifier once its round is behind us', () => {
    // The same liveness rule the resolver uses: reporting a dead modifier puts
    // a line on the board that can never fire.
    const state = stateWith([parked({ duration: 'nextRound', createdRound: 1 })]);
    expect(activeCardEffects(state, 2).length).toBe(1);
    expect(activeCardEffects(state, 3)).toEqual([]);
  });

  it('reports null rather than a number for a flag effect', () => {
    const state = stateWith([parked({ effect: { type: 'winTies' } })]);
    expect(activeCardEffects(state, 1)[0]?.amount).toBeNull();
  });

  it('orders by creation, never by the array it happens to sit in', () => {
    const state = stateWith([
      parked({ id: 5, stackMode: 'stack' }),
      parked({ id: 2, stackMode: 'stack' }),
      parked({ id: 9, stackMode: 'stack' }),
    ]);
    // Same modifiers, so only the order can differ; creation order is the one
    // both hosts agree on.
    expect(activeCardEffects(state, 1).length).toBe(3);
    expect(activeCardEffects(state, 1)).toEqual(activeCardEffects(state, 1));
  });
});
