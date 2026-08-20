import { describe, expect, it } from 'vitest';
import type {
  CardDuration,
  CardMatchState,
  CardModifier,
  CardStackMode,
} from '../src/sim/minigames/card_duel';
import {
  addModifier,
  consumeTriggered,
  expireModifiers,
  isParkedDuration,
  nextModifierId,
  pendingModifiersFor,
} from '../src/sim/minigames/card_duel/modifiers';
import { defineCard, instanceOf, makeCatalog, makeMatch } from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'] });
const ghoul = defineCard('ghoul', { value: 2, tribes: ['Undead'] });
const catalog = makeCatalog([wolf, ghoul]);

function park(
  state: CardMatchState,
  over: Partial<CardModifier> & { amount?: number } = {},
): CardModifier | null {
  const { amount = 1, ...rest } = over;
  return addModifier(state, {
    id: nextModifierId(state),
    seat: 'a',
    iid: null,
    source: 'candle',
    effect: { type: 'modifyValue', amount: { type: 'constant', value: amount } },
    duration: 'untilTriggered' as CardDuration,
    stackMode: 'stack' as CardStackMode,
    createdRound: state.round,
    consumed: false,
    ...rest,
  });
}

describe('card_duel modifiers', () => {
  it('only durations that outlive the comparison park', () => {
    expect(isParkedDuration('instant')).toBe(false);
    expect(isParkedDuration('thisComparison')).toBe(false);
    expect(isParkedDuration('thisRound')).toBe(false);
    expect(isParkedDuration('nextRound')).toBe(true);
    expect(isParkedDuration('untilTriggered')).toBe(true);
    expect(isParkedDuration('untilMatchEnd')).toBe(true);
  });

  it('stack adds up, unique refuses a second copy', () => {
    const stacked = makeMatch();
    park(stacked, { stackMode: 'stack', amount: 3 });
    park(stacked, { stackMode: 'stack', amount: 3 });
    expect(stacked.modifiers.length).toBe(2);

    // The brief's own example: "your next Beast gets +3" marked unique must not
    // become +9 when it triggers three times.
    const once = makeMatch();
    park(once, { stackMode: 'unique', amount: 3 });
    expect(park(once, { stackMode: 'unique', amount: 3 })).toBeNull();
    expect(park(once, { stackMode: 'unique', amount: 3 })).toBeNull();
    expect(once.modifiers.length).toBe(1);
  });

  it('replace keeps the newest, highest keeps the strongest, lowest keeps the weakest', () => {
    const replaced = makeMatch();
    park(replaced, { stackMode: 'replace', amount: 1 });
    park(replaced, { stackMode: 'replace', amount: 5 });
    expect(replaced.modifiers.length).toBe(1);
    expect(replaced.modifiers[0].effect).toMatchObject({ amount: { value: 5 } });

    const highest = makeMatch();
    park(highest, { stackMode: 'highest', amount: 4 });
    park(highest, { stackMode: 'highest', amount: 2 });
    expect(highest.modifiers.length).toBe(1);
    expect(highest.modifiers[0].effect).toMatchObject({ amount: { value: 4 } });

    const lowest = makeMatch();
    park(lowest, { stackMode: 'lowest', amount: 4 });
    park(lowest, { stackMode: 'lowest', amount: 2 });
    expect(lowest.modifiers.length).toBe(1);
    expect(lowest.modifiers[0].effect).toMatchObject({ amount: { value: 2 } });
  });

  it('a different SOURCE is a different slot, so two cards both buff you', () => {
    const state = makeMatch();
    park(state, { stackMode: 'unique', source: 'candle', amount: 3 });
    park(state, { stackMode: 'unique', source: 'necromancer', amount: 2 });
    expect(state.modifiers.length).toBe(2);
  });

  it('fires only for a card matching the parked filter', () => {
    const state = makeMatch();
    park(state, { match: { tribe: 'Undead' }, amount: 3 });
    const beast = instanceOf(wolf);
    const undead = instanceOf(ghoul);
    expect(pendingModifiersFor(state, 'a', beast, catalog).length).toBe(0);
    expect(pendingModifiersFor(state, 'a', undead, catalog).length).toBe(1);
    // And never for the other seat's card.
    expect(pendingModifiersFor(state, 'b', undead, catalog).length).toBe(0);
  });

  it('an instance-keyed modifier waits for that exact card, not another of the same id', () => {
    const state = makeMatch();
    const first = instanceOf(wolf, 41);
    const second = instanceOf(wolf, 42);
    park(state, { iid: 42, amount: 2 });
    expect(pendingModifiersFor(state, 'a', first, catalog).length).toBe(0);
    expect(pendingModifiersFor(state, 'a', second, catalog).length).toBe(1);
  });

  it('untilTriggered is spent by the card that used it; untilMatchEnd keeps firing', () => {
    const state = makeMatch();
    park(state, { duration: 'untilTriggered', amount: 3 });
    park(state, { duration: 'untilMatchEnd', source: 'banner', amount: 1 });
    const card = instanceOf(wolf);
    const first = pendingModifiersFor(state, 'a', card, catalog);
    expect(first.length).toBe(2);
    consumeTriggered(first);
    const second = pendingModifiersFor(state, 'a', card, catalog);
    expect(second.length).toBe(1);
    expect(second[0].duration).toBe('untilMatchEnd');
  });

  it('nextRound fires only in the round after it was parked', () => {
    const state = makeMatch();
    state.round = 2;
    park(state, { duration: 'nextRound', amount: 2 });
    const card = instanceOf(wolf);
    expect(pendingModifiersFor(state, 'a', card, catalog).length).toBe(0);
    state.round = 3;
    expect(pendingModifiersFor(state, 'a', card, catalog).length).toBe(1);
    state.round = 4;
    expect(pendingModifiersFor(state, 'a', card, catalog).length).toBe(0);
  });

  it('expiry drops spent and stale modifiers, so the list cannot grow without bound', () => {
    const state = makeMatch();
    state.round = 1;
    park(state, { duration: 'nextRound', amount: 1 });
    park(state, { duration: 'untilTriggered', source: 'candle2', amount: 1 });
    park(state, { duration: 'untilMatchEnd', source: 'banner', amount: 1 });
    state.modifiers[1].consumed = true;
    state.round = 3;
    expireModifiers(state);
    expect(state.modifiers.map((m) => m.duration)).toEqual(['untilMatchEnd']);
  });

  it('fires in creation order, whatever order the list happens to hold', () => {
    const state = makeMatch();
    park(state, { source: 'first', amount: 1 });
    park(state, { source: 'second', amount: 2 });
    state.modifiers.reverse();
    const fired = pendingModifiersFor(state, 'a', instanceOf(wolf), catalog);
    expect(fired.map((m) => m.source)).toEqual(['first', 'second']);
  });
});
