import { describe, expect, it } from 'vitest';
import {
  compare,
  conditionsHold,
  evaluateCondition,
} from '../src/sim/minigames/card_duel/conditions';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import { recordHistory } from '../src/sim/minigames/card_duel/match_state';
import type { CardConditionTree } from '../src/sim/minigames/card_duel/types';
import {
  defineCard,
  evalContext,
  instanceOf,
  lockIn,
  makeCatalog,
  makeMatch,
} from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'], tags: ['Wolf'] });
const ranger = defineCard('ranger', { value: 5, tribes: ['Human'], tags: ['Eastbrook'] });
const catalog = makeCatalog([wolf, ranger]);

/** A live round with A holding the wolf and B the ranger. */
function roundCtx(seat: 'a' | 'b' = 'a') {
  const state = makeMatch([instanceOf(wolf)], [instanceOf(ranger)]);
  lockIn(state, state.a.cards.hand[0] ?? null, state.b.cards.hand[0] ?? null);
  return { state, ctx: evalContext(state, catalog, seat) };
}

describe('card_duel conditions', () => {
  it('compare covers every operator', () => {
    expect(compare('eq', 3, 3)).toBe(true);
    expect(compare('ne', 3, 3)).toBe(false);
    expect(compare('lt', 2, 3)).toBe(true);
    expect(compare('lte', 3, 3)).toBe(true);
    expect(compare('gt', 4, 3)).toBe(true);
    expect(compare('gte', 2, 3)).toBe(false);
  });

  it('an absent condition tree always holds', () => {
    const { ctx } = roundCtx();
    expect(conditionsHold(undefined, ctx)).toBe(true);
  });

  it('ALL / ANY / NOT compose, and the empty cases follow the usual algebra', () => {
    const { ctx } = roundCtx();
    const yes: CardConditionTree = { type: 'hasTribe', card: 'thisCard', tribe: 'Beast' };
    const no: CardConditionTree = { type: 'hasTribe', card: 'thisCard', tribe: 'Undead' };
    expect(evaluateCondition({ type: 'all', of: [yes, yes] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'all', of: [yes, no] }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'any', of: [yes, no] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'any', of: [no, no] }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'not', of: no }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'all', of: [] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'any', of: [] }, ctx)).toBe(false);
  });

  it('reads tribes and tags off the card the reference names', () => {
    const { ctx } = roundCtx();
    expect(evaluateCondition({ type: 'hasTribe', card: 'thisCard', tribe: 'Beast' }, ctx)).toBe(
      true,
    );
    expect(evaluateCondition({ type: 'hasTribe', card: 'opponentCard', tribe: 'Human' }, ctx)).toBe(
      true,
    );
    expect(evaluateCondition({ type: 'hasTribe', card: 'opponentCard', tribe: 'Beast' }, ctx)).toBe(
      false,
    );
    expect(evaluateCondition({ type: 'hasTag', card: 'opponentCard', tag: 'Eastbrook' }, ctx)).toBe(
      true,
    );
  });

  it('hasTribe reads the LIVE tribe list, so an addTribe this round counts', () => {
    const { ctx } = roundCtx();
    expect(evaluateCondition({ type: 'hasTribe', card: 'opponentCard', tribe: 'Beast' }, ctx)).toBe(
      false,
    );
    ctx.board.b.tribes.push('Beast');
    expect(evaluateCondition({ type: 'hasTribe', card: 'opponentCard', tribe: 'Beast' }, ctx)).toBe(
      true,
    );
  });

  it('the Forest Wolf shape: previous card had a tribe', () => {
    const state = makeMatch([instanceOf(wolf)], []);
    const previous = instanceOf(wolf);
    recordHistory(state, 'a', previous, 3, wolf.tribes, 'win');
    state.a.previousCard = previous;
    state.round = 2;
    lockIn(state, state.a.cards.hand[0], null);
    const ctx = evalContext(state, catalog, 'a');
    expect(
      evaluateCondition({ type: 'hasTribe', card: 'myPreviousCard', tribe: 'Beast' }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition({ type: 'hasTribe', card: 'myPreviousCard', tribe: 'Human' }, ctx),
    ).toBe(false);
  });

  it('valueCompare reads base and effective separately', () => {
    const { ctx } = roundCtx();
    ctx.board.a.effectiveValue = 9;
    expect(
      evaluateCondition(
        { type: 'valueCompare', card: 'thisCard', value: 'base', op: 'eq', amount: constant(3) },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          type: 'valueCompare',
          card: 'thisCard',
          value: 'effective',
          op: 'gte',
          amount: constant(9),
        },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'valueCompare', card: 'thisCard', value: 'base', op: 'gte', amount: constant(9) },
        ctx,
      ),
    ).toBe(false);
  });

  it('the Old Greyjaw shape: scoreCompare with no amount reads score against the opponent', () => {
    const { state, ctx } = roundCtx();
    state.a.roundWins = 0;
    state.b.roundWins = 1;
    expect(evaluateCondition({ type: 'scoreCompare', op: 'lt' }, ctx)).toBe(true);
    state.a.roundWins = 2;
    expect(evaluateCondition({ type: 'scoreCompare', op: 'lt' }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'scoreCompare', op: 'gt' }, ctx)).toBe(true);
    // With an amount it compares against that number instead.
    expect(evaluateCondition({ type: 'scoreCompare', op: 'eq', amount: constant(2) }, ctx)).toBe(
      true,
    );
  });

  it('previousResult and consecutive read the streak the seat actually owns', () => {
    const { state, ctx } = roundCtx();
    state.a.previousResult = 'lose';
    state.a.consecutiveLosses = 2;
    state.b.previousResult = 'win';
    state.b.consecutiveWins = 2;
    expect(evaluateCondition({ type: 'previousResult', owner: 'self', result: 'lose' }, ctx)).toBe(
      true,
    );
    expect(
      evaluateCondition({ type: 'previousResult', owner: 'opponent', result: 'win' }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'consecutive', owner: 'self', result: 'lose', op: 'gte', amount: constant(2) },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'consecutive', owner: 'self', result: 'win', op: 'gte', amount: constant(1) },
        ctx,
      ),
    ).toBe(false);
  });

  it('roundCompare, historyCompare, and counterCompare read match state', () => {
    const { state, ctx } = roundCtx();
    state.round = 3;
    state.a.counters.Pack = 4;
    recordHistory(state, 'a', instanceOf(wolf), 3, wolf.tribes, 'win');
    recordHistory(state, 'a', instanceOf(wolf), 3, wolf.tribes, 'lose');
    expect(evaluateCondition({ type: 'roundCompare', op: 'gte', amount: constant(3) }, ctx)).toBe(
      true,
    );
    expect(
      evaluateCondition(
        {
          type: 'historyCompare',
          filter: { owner: 'self', tribe: 'Beast' },
          op: 'gte',
          amount: constant(2),
        },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          type: 'historyCompare',
          filter: { owner: 'self', tribe: 'Beast', result: 'win' },
          op: 'gte',
          amount: constant(2),
        },
        ctx,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'counterCompare', owner: 'self', counter: 'Pack', op: 'gte', amount: constant(4) },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          type: 'counterCompare',
          owner: 'opponent',
          counter: 'Pack',
          op: 'gte',
          amount: constant(1),
        },
        ctx,
      ),
    ).toBe(false);
  });

  it('the same tree read from seat B is about B, never about seat A', () => {
    const { state } = roundCtx();
    state.a.counters.Pack = 5;
    const fromB = evalContext(state, catalog, 'b');
    const mine: CardConditionTree = {
      type: 'counterCompare',
      owner: 'self',
      counter: 'Pack',
      op: 'gte',
      amount: constant(5),
    };
    expect(evaluateCondition(mine, fromB)).toBe(false);
    expect(evaluateCondition({ ...mine, owner: 'opponent' } as CardConditionTree, fromB)).toBe(
      true,
    );
  });
});
