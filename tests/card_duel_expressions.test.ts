import { describe, expect, it } from 'vitest';
import { constant, evaluateAmount, evaluateExpr } from '../src/sim/minigames/card_duel/expressions';
import { recordHistory } from '../src/sim/minigames/card_duel/match_state';
import type { CardNumericExpr } from '../src/sim/minigames/card_duel/types';
import {
  cardOfValue,
  defineCard,
  evalContext,
  instanceOf,
  lockIn,
  makeCatalog,
  makeMatch,
} from './helpers/card_duel_fixtures';

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'], tags: ['Wolf'] });
const alpha = defineCard('alpha', { value: 6, tribes: ['Beast'] });
const ranger = defineCard('ranger', { value: 5, tribes: ['Human'] });
const catalog = makeCatalog([wolf, alpha, ranger]);

function ctxWithPlays(
  plays: readonly { seat: 'a' | 'b'; def: typeof wolf; result: 'win' | 'lose' | 'tie' }[],
) {
  const state = makeMatch();
  for (const play of plays) {
    const card = instanceOf(play.def);
    recordHistory(state, play.seat, card, card.value, play.def.tribes, play.result);
    state.round++;
  }
  return { state, ctx: evalContext(state, catalog, 'a') };
}

describe('card_duel expressions', () => {
  it('evaluates arithmetic over constants', () => {
    const { ctx } = ctxWithPlays([]);
    const expr: CardNumericExpr = {
      type: 'add',
      terms: [constant(2), { type: 'multiply', terms: [constant(3), constant(4)] }],
    };
    expect(evaluateExpr(expr, ctx)).toBe(14);
    expect(evaluateExpr({ type: 'subtract', left: constant(2), right: constant(9) }, ctx)).toBe(-7);
    expect(evaluateExpr({ type: 'negate', of: constant(4) }, ctx)).toBe(-4);
    expect(evaluateExpr({ type: 'min', terms: [constant(5), constant(2)] }, ctx)).toBe(2);
    expect(evaluateExpr({ type: 'max', terms: [constant(5), constant(2)] }, ctx)).toBe(5);
  });

  it('divides exactly so an authored floor or ceil means what it says', () => {
    const { ctx } = ctxWithPlays([]);
    const half = { type: 'divide', left: constant(7), right: constant(2) } as const;
    expect(evaluateExpr(half, ctx)).toBe(3.5);
    expect(evaluateExpr({ type: 'floor', of: half }, ctx)).toBe(3);
    expect(evaluateExpr({ type: 'ceil', of: half }, ctx)).toBe(4);
    // Negative quotients are where truncation and floor disagree: the floor
    // must round DOWN, which a truncating divide would have got wrong.
    const negative = { type: 'divide', left: constant(-7), right: constant(2) } as const;
    expect(evaluateExpr({ type: 'floor', of: negative }, ctx)).toBe(-4);
  });

  it('a zero divisor answers 0 rather than poisoning the round with Infinity', () => {
    const { ctx } = ctxWithPlays([]);
    expect(evaluateExpr({ type: 'divide', left: constant(5), right: constant(0) }, ctx)).toBe(0);
  });

  it('evaluateAmount truncates at the boundary, so no fractional modifier reaches a comparison', () => {
    const { ctx } = ctxWithPlays([]);
    const expr: CardNumericExpr = { type: 'divide', left: constant(7), right: constant(2) };
    expect(evaluateAmount(expr, ctx)).toBe(3);
  });

  it('counts history by owner, tribe, tag, and result', () => {
    const { state, ctx } = ctxWithPlays([
      { seat: 'a', def: wolf, result: 'win' },
      { seat: 'a', def: alpha, result: 'lose' },
      { seat: 'b', def: wolf, result: 'lose' },
      { seat: 'a', def: ranger, result: 'win' },
    ]);
    expect(state.history.length).toBe(4);
    expect(evaluateExpr({ type: 'historyCount', filter: {} }, ctx)).toBe(4);
    expect(evaluateExpr({ type: 'historyCount', filter: { owner: 'self' } }, ctx)).toBe(3);
    expect(evaluateExpr({ type: 'historyCount', filter: { owner: 'opponent' } }, ctx)).toBe(1);
    expect(
      evaluateExpr({ type: 'historyCount', filter: { owner: 'self', tribe: 'Beast' } }, ctx),
    ).toBe(2);
    expect(
      evaluateExpr({ type: 'historyCount', filter: { owner: 'self', result: 'win' } }, ctx),
    ).toBe(2);
    // The tag arm walks the catalog (tags are definition data), so it must
    // agree with the tribe arm rather than counting everything.
    expect(
      evaluateExpr({ type: 'historyCount', filter: { owner: 'self', tag: 'Wolf' } }, ctx),
    ).toBe(1);
  });

  it('the Pack Alpha shape scales off history: +1 for every two Beasts played', () => {
    const { ctx } = ctxWithPlays([
      { seat: 'a', def: wolf, result: 'win' },
      { seat: 'a', def: alpha, result: 'win' },
      { seat: 'a', def: wolf, result: 'win' },
    ]);
    const amount: CardNumericExpr = {
      type: 'floor',
      of: {
        type: 'divide',
        left: { type: 'historyCount', filter: { owner: 'self', tribe: 'Beast' } },
        right: constant(2),
      },
    };
    expect(evaluateAmount(amount, ctx)).toBe(1);
  });

  it('counts unique tribes played, not cards', () => {
    const { ctx } = ctxWithPlays([
      { seat: 'a', def: wolf, result: 'win' },
      { seat: 'a', def: alpha, result: 'win' },
      { seat: 'a', def: ranger, result: 'win' },
    ]);
    expect(evaluateExpr({ type: 'uniqueTribesPlayed', owner: 'self' }, ctx)).toBe(2);
  });

  it('reads live board values: base ignores modifiers, effective includes them', () => {
    const state = makeMatch([instanceOf(wolf)], [instanceOf(ranger)]);
    lockIn(state, state.a.cards.hand[0], state.b.cards.hand[0]);
    const ctx = evalContext(state, catalog, 'a');
    ctx.board.a.effectiveValue += 4;
    expect(evaluateExpr({ type: 'cardValue', card: 'thisCard', value: 'base' }, ctx)).toBe(3);
    expect(evaluateExpr({ type: 'cardValue', card: 'thisCard', value: 'effective' }, ctx)).toBe(7);
    expect(evaluateExpr({ type: 'cardValue', card: 'opponentCard', value: 'base' }, ctx)).toBe(5);
  });

  it('reads a previous card through history, not through the live board', () => {
    const state = makeMatch();
    const played = instanceOf(wolf);
    recordHistory(state, 'a', played, 8, wolf.tribes, 'win');
    state.a.previousCard = played;
    state.round = 2;
    const ctx = evalContext(state, catalog, 'a');
    expect(evaluateExpr({ type: 'cardValue', card: 'myPreviousCard', value: 'base' }, ctx)).toBe(3);
    // The previous card's EFFECTIVE value is the one the round was decided on
    // (8 after its modifiers), not its printed 3.
    expect(
      evaluateExpr({ type: 'cardValue', card: 'myPreviousCard', value: 'effective' }, ctx),
    ).toBe(8);
  });

  it('reads counters, zone counts, score, and round number', () => {
    const state = makeMatch([cardOfValue(2), cardOfValue(4)], [cardOfValue(9)]);
    state.a.counters.Pack = 3;
    state.b.counters.Venom = 2;
    state.a.roundWins = 1;
    state.round = 4;
    const ctx = evalContext(state, catalog, 'a');
    expect(evaluateExpr({ type: 'counter', owner: 'self', counter: 'Pack' }, ctx)).toBe(3);
    expect(evaluateExpr({ type: 'counter', owner: 'opponent', counter: 'Venom' }, ctx)).toBe(2);
    // An unset counter reads zero rather than undefined.
    expect(evaluateExpr({ type: 'counter', owner: 'self', counter: 'Venom' }, ctx)).toBe(0);
    expect(evaluateExpr({ type: 'zoneCount', owner: 'self', zone: 'hand' }, ctx)).toBe(2);
    expect(evaluateExpr({ type: 'zoneCount', owner: 'opponent', zone: 'hand' }, ctx)).toBe(1);
    expect(evaluateExpr({ type: 'score', owner: 'self' }, ctx)).toBe(1);
    expect(evaluateExpr({ type: 'score', owner: 'opponent' }, ctx)).toBe(0);
    expect(evaluateExpr({ type: 'roundNumber' }, ctx)).toBe(4);
  });

  it('owner is relative to the reading seat, so one card text reads the same from either seat', () => {
    const state = makeMatch();
    state.a.counters.Pack = 5;
    state.b.counters.Pack = 1;
    const fromA = evalContext(state, catalog, 'a');
    const fromB = evalContext(state, catalog, 'b');
    const mine: CardNumericExpr = { type: 'counter', owner: 'self', counter: 'Pack' };
    expect(evaluateExpr(mine, fromA)).toBe(5);
    expect(evaluateExpr(mine, fromB)).toBe(1);
  });
});
