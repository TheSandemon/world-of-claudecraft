import { describe, expect, it } from 'vitest';
import type {
  CardDuration,
  CardEffectDefinition,
  CardStackMode,
} from '../src/sim/minigames/card_duel';
import {
  applyEffect,
  type CardResolutionSink,
  resolveAmounts,
} from '../src/sim/minigames/card_duel/effects';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import type { CardResolvedTarget } from '../src/sim/minigames/card_duel/selectors';
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

const wolf = defineCard('wolf', { value: 3, tribes: ['Beast'] });
const ranger = defineCard('ranger', { value: 5, tribes: ['Human'] });
const ghoul = defineCard('ghoul', { value: 2, tribes: ['Undead'] });
const catalog = makeCatalog([wolf, ranger, ghoul]);

/** A resolution sink that just records what the effect queued. */
function recordingSink(): CardResolutionSink & { queued: string[] } {
  return {
    queued: [],
    queueCardTrigger(seat, card, trigger) {
      this.queued.push(`${seat}:${card.cardId}:${trigger}`);
    },
  };
}

function board(seatACard = wolf, seatBCard = ranger) {
  const state = makeMatch([instanceOf(seatACard)], [instanceOf(seatBCard)]);
  lockIn(state, state.a.cards.hand[0], state.b.cards.hand[0]);
  return state;
}

function apply(
  state: ReturnType<typeof board>,
  effect: CardEffectDefinition,
  targets: CardResolvedTarget[],
  over: {
    duration?: CardDuration;
    stackMode?: CardStackMode;
    seat?: 'a' | 'b';
    rng?: { next(): number };
  } = {},
) {
  const ctx = evalContext(state, catalog, over.seat ?? 'a');
  const sink = recordingSink();
  applyEffect(
    effect,
    over.duration ?? 'thisComparison',
    over.stackMode ?? 'stack',
    targets,
    ctx,
    over.rng ?? new Rng(5),
    sink,
  );
  return { ctx, sink };
}

describe('card_duel effects', () => {
  it('prices every expression at application time, so a parked modifier cannot re-price later', () => {
    const state = board();
    state.a.counters.Pack = 4;
    const ctx = evalContext(state, catalog, 'a');
    const priced = resolveAmounts(
      { type: 'modifyValue', amount: { type: 'counter', owner: 'self', counter: 'Pack' } },
      ctx,
    );
    expect(priced).toEqual({ type: 'modifyValue', amount: { type: 'constant', value: 4 } });
    state.a.counters.Pack = 99;
    expect(priced).toEqual({ type: 'modifyValue', amount: { type: 'constant', value: 4 } });
  });

  it('modifyValue and setValue edit the board, base value untouched', () => {
    const state = board();
    const { ctx } = apply(state, { type: 'modifyValue', amount: constant(2) }, [
      { kind: 'board', seat: 'a' },
    ]);
    expect(ctx.board.a.effectiveValue).toBe(5);
    expect(ctx.board.a.baseValue).toBe(3);

    const other = board();
    const set = apply(other, { type: 'setValue', amount: constant(9) }, [
      { kind: 'board', seat: 'b' },
    ]);
    expect(set.ctx.board.b.effectiveValue).toBe(9);
    expect(set.ctx.board.b.baseValue).toBe(5);
  });

  it('minimumValue and maximumValue record clamps rather than overwriting the value', () => {
    const state = board();
    const { ctx } = apply(state, { type: 'minimumValue', amount: constant(6) }, [
      { kind: 'board', seat: 'a' },
    ]);
    expect(ctx.board.a.floorValue).toBe(6);
    expect(ctx.board.a.effectiveValue).toBe(3);
  });

  it('swapValues exchanges both effective values whatever the declared target', () => {
    const state = board();
    const ctx = evalContext(state, catalog, 'a');
    ctx.board.a.effectiveValue = 3;
    ctx.board.b.effectiveValue = 7;
    applyEffect(
      { type: 'swapValues' },
      'thisComparison',
      'stack',
      [{ kind: 'board', seat: 'a' }],
      ctx,
      new Rng(1),
      recordingSink(),
    );
    expect(ctx.board.a.effectiveValue).toBe(7);
    expect(ctx.board.b.effectiveValue).toBe(3);
  });

  it('tribe edits add and remove on the live board list', () => {
    const state = board();
    const added = apply(state, { type: 'addTribe', tribe: 'Undead' }, [
      { kind: 'board', seat: 'a' },
    ]);
    expect(added.ctx.board.a.tribes).toEqual(['Beast', 'Undead']);
    // Adding a tribe twice does not duplicate it.
    applyEffect(
      { type: 'addTribe', tribe: 'Undead' },
      'thisComparison',
      'stack',
      [{ kind: 'board', seat: 'a' }],
      added.ctx,
      new Rng(1),
      recordingSink(),
    );
    expect(added.ctx.board.a.tribes).toEqual(['Beast', 'Undead']);
    applyEffect(
      { type: 'removeTribe', tribe: 'Beast' },
      'thisComparison',
      'stack',
      [{ kind: 'board', seat: 'a' }],
      added.ctx,
      new Rng(1),
      recordingSink(),
    );
    expect(added.ctx.board.a.tribes).toEqual(['Undead']);
  });

  it('silence, winTies, and reverseComparison set the flags the comparison reads', () => {
    const state = board();
    const { ctx } = apply(state, { type: 'silence' }, [{ kind: 'board', seat: 'b' }]);
    expect(ctx.board.b.silenced).toBe(true);
    expect(ctx.board.a.silenced).toBe(false);
    applyEffect(
      { type: 'winTies' },
      'thisComparison',
      'stack',
      [{ kind: 'board', seat: 'a' }],
      ctx,
      new Rng(1),
      recordingSink(),
    );
    expect(ctx.board.a.winTies).toBe(true);
  });

  it('counters add, subtract, and set, and never go negative', () => {
    const state = board();
    apply(state, { type: 'addCounter', counter: 'Pack', amount: constant(2) }, [
      { kind: 'player', seat: 'a' },
    ]);
    expect(state.a.counters.Pack).toBe(2);
    apply(state, { type: 'removeCounter', counter: 'Pack', amount: constant(5) }, [
      { kind: 'player', seat: 'a' },
    ]);
    // Clamped at zero: a debt here would be silently repaid by the next
    // addCounter and the card text would stop matching the board.
    expect(state.a.counters.Pack).toBe(0);
    apply(state, { type: 'setCounter', counter: 'Venom', amount: constant(3) }, [
      { kind: 'player', seat: 'b' },
    ]);
    expect(state.b.counters.Venom).toBe(3);
  });

  it('draw pulls into the hand and fires onDraw for each card that actually arrived', () => {
    const state = board();
    state.a.cards.deck = [instanceOf(ghoul), instanceOf(ghoul)];
    const { sink } = apply(state, { type: 'draw', amount: constant(2) }, [
      { kind: 'player', seat: 'a' },
    ]);
    expect(state.a.cards.hand.length).toBe(2);
    expect(sink.queued).toEqual(['a:ghoul:onDraw', 'a:ghoul:onDraw']);
  });

  it('draw on an empty pool is a no-op, not an infinite loop or a phantom trigger', () => {
    const state = board();
    state.a.cards.deck = [];
    state.a.cards.discard = [];
    state.a.cards.hand = [];
    const rng = countingRng();
    const { sink } = apply(
      state,
      { type: 'draw', amount: constant(3) },
      [{ kind: 'player', seat: 'a' }],
      { rng },
    );
    expect(state.a.cards.hand).toEqual([]);
    expect(sink.queued).toEqual([]);
    expect(rng.draws).toBe(0);
  });

  it('reveal records only the named card, and a hand reveal records all of them', () => {
    const state = board();
    const spy = instanceOf(ghoul, 51);
    const other = instanceOf(ranger, 52);
    state.b.cards.hand = [spy, other];
    apply(state, { type: 'reveal' }, [{ kind: 'zoneCard', seat: 'b', zone: 'hand', card: spy }]);
    expect(state.b.revealedToOpponent).toEqual([51]);
    apply(state, { type: 'reveal' }, [{ kind: 'player', seat: 'b' }]);
    expect(state.b.revealedToOpponent).toEqual([51, 52]);
  });

  it('discard moves a hand card to the discard pile and fires onDiscard', () => {
    const state = board();
    const doomed = instanceOf(ghoul, 61);
    state.b.cards.hand = [doomed];
    const { sink } = apply(state, { type: 'discard' }, [
      { kind: 'zoneCard', seat: 'b', zone: 'hand', card: doomed },
    ]);
    expect(state.b.cards.hand).toEqual([]);
    expect(state.b.cards.discard.map((c) => c.iid)).toContain(61);
    expect(sink.queued).toEqual(['b:ghoul:onDiscard']);
  });

  it('returnToHand pulls a card back out of the discard pile', () => {
    const state = board();
    const buried = instanceOf(ghoul, 71);
    state.a.cards.discard = [buried];
    apply(state, { type: 'returnToHand' }, [
      { kind: 'zoneCard', seat: 'a', zone: 'discard', card: buried },
    ]);
    expect(state.a.cards.discard).toEqual([]);
    expect(state.a.cards.hand.map((c) => c.iid)).toContain(71);
  });

  it('shuffleDiscardIntoDeck empties the discard into the deck, preserving the pool', () => {
    const state = board();
    state.a.cards.deck = [instanceOf(wolf), instanceOf(wolf)];
    state.a.cards.discard = [instanceOf(ghoul), instanceOf(ghoul), instanceOf(ghoul)];
    apply(state, { type: 'shuffleDiscardIntoDeck', owner: 'self' }, [
      { kind: 'player', seat: 'a' },
    ]);
    expect(state.a.cards.discard).toEqual([]);
    expect(state.a.cards.deck.length).toBe(5);
  });

  it('a nextCard target parks a modifier instead of touching the board', () => {
    const state = board();
    const { ctx } = apply(
      state,
      { type: 'modifyValue', amount: constant(3) },
      [{ kind: 'nextCard', seat: 'a', match: { tribe: 'Undead' } }],
      { duration: 'untilTriggered' },
    );
    expect(ctx.board.a.effectiveValue).toBe(3);
    expect(state.modifiers.length).toBe(1);
    expect(state.modifiers[0]).toMatchObject({
      seat: 'a',
      iid: null,
      duration: 'untilTriggered',
      match: { tribe: 'Undead' },
    });
  });

  it('an effect aimed at a card in hand parks a modifier keyed to that instance', () => {
    const state = board();
    const inHand = instanceOf(wolf, 81);
    state.a.cards.hand = [inHand];
    apply(state, { type: 'modifyValue', amount: constant(1) }, [
      { kind: 'zoneCard', seat: 'a', zone: 'hand', card: inHand },
    ]);
    expect(state.modifiers[0]).toMatchObject({ seat: 'a', iid: 81 });
  });

  it('untilMatchEnd applies now AND parks; nextRound only parks', () => {
    const now = board();
    const applied = apply(
      now,
      { type: 'modifyValue', amount: constant(2) },
      [{ kind: 'board', seat: 'a' }],
      { duration: 'untilMatchEnd' },
    );
    expect(applied.ctx.board.a.effectiveValue).toBe(5);
    expect(now.modifiers.length).toBe(1);

    const later = board();
    const parked = apply(
      later,
      { type: 'modifyValue', amount: constant(2) },
      [{ kind: 'board', seat: 'a' }],
      { duration: 'nextRound' },
    );
    expect(parked.ctx.board.a.effectiveValue).toBe(3);
    expect(later.modifiers.length).toBe(1);
  });
});
