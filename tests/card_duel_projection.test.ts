// The hand projection: what a card in hand is really worth, and the guarantee
// that asking the question changes nothing.
//
// This is the number every bot policy now chooses on, so the interesting cases
// are the ones where the printed value lies: a conditional that is live, a
// conditional that is not, a parked modifier, a clamp, and a spent effect limit.

import { describe, expect, it } from 'vitest';
import {
  addModifier,
  type CardCatalog,
  createMatchState,
  limitKey,
  projectCardValue,
  projectedValueOf,
  projectHand,
} from '../src/sim/minigames/card_duel';
import { constant } from '../src/sim/minigames/card_duel/expressions';
import { cardOfValue, defineCard } from './helpers/card_duel_fixtures';

/** A catalog over a handful of hand-built definitions. */
function catalogOf(...defs: ReturnType<typeof defineCard>[]): CardCatalog {
  const map = new Map(defs.map((def) => [def.id, def]));
  return { get: (id) => map.get(id) };
}

const PLAIN = defineCard('plain', { value: 4 });

/** A value-2 card that is really a 23 once you have banked a Pack: the exact
 *  shape that made a printed-value policy misplay its own hand. */
const PACK_PAYOFF = defineCard('pack_payoff', {
  value: 2,
  effects: [
    {
      trigger: 'beforeCompare',
      conditions: {
        type: 'counterCompare',
        owner: 'self',
        counter: 'Pack',
        op: 'gte',
        amount: constant(1),
      },
      effect: { type: 'modifyValue', amount: constant(21) },
      duration: 'thisComparison',
    },
  ],
});

/** Scales off a counter rather than gating on one, so it also proves the
 *  projection PRICES expressions instead of reading them as zero. */
const PACK_SCALER = defineCard('pack_scaler', {
  value: 3,
  effects: [
    {
      trigger: 'beforeCompare',
      effect: {
        type: 'modifyValue',
        amount: {
          type: 'multiply',
          terms: [constant(3), { type: 'counter', owner: 'self', counter: 'Pack' }],
        },
      },
      duration: 'thisComparison',
    },
  ],
});

function matchWith(handIds: readonly string[], values: readonly number[]) {
  const empty = () => ({ deck: [], hand: [], discard: [] });
  const state = createMatchState(empty(), empty());
  state.a.cards.hand = handIds.map((id, i) => cardOfValue(values[i], id));
  return state;
}

describe('card duel hand projection', () => {
  it('reports the printed value for a card with nothing to add', () => {
    const state = matchWith(['plain'], [4]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(PLAIN))).toBe(4);
  });

  it('counts a conditional bonus whose condition is already true', () => {
    const state = matchWith(['pack_payoff'], [2]);
    state.a.counters.Pack = 1;
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(PACK_PAYOFF))).toBe(23);
  });

  it('does NOT count a conditional bonus whose condition is false', () => {
    const state = matchWith(['pack_payoff'], [2]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(PACK_PAYOFF))).toBe(2);
  });

  it('prices a scaling expression against the live state, not as zero', () => {
    const state = matchWith(['pack_scaler'], [3]);
    state.a.counters.Pack = 4;
    // 3 printed + 3 per Pack * 4 Pack.
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(PACK_SCALER))).toBe(15);
  });

  it('includes a modifier parked on the card by an earlier round', () => {
    const state = matchWith(['plain'], [4]);
    const card = state.a.cards.hand[0];
    addModifier(state, {
      id: 1,
      seat: 'a',
      iid: card.iid,
      source: 'somewhere',
      effect: { type: 'modifyValue', amount: constant(6) },
      duration: 'untilTriggered',
      stackMode: 'unique',
      createdRound: 1,
      consumed: false,
    });
    expect(projectCardValue(state, 'a', card, catalogOf(PLAIN))).toBe(10);
  });

  it('applies a cap after the addition it clamps, as the resolver would', () => {
    const capped = defineCard('capped', {
      value: 2,
      effects: [
        {
          trigger: 'beforeCompare',
          effect: { type: 'modifyValue', amount: constant(21) },
          duration: 'thisComparison',
        },
        {
          trigger: 'beforeCompare',
          effect: { type: 'maximumValue', amount: constant(9) },
          duration: 'thisComparison',
        },
      ],
    });
    const state = matchWith(['capped'], [2]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(capped))).toBe(9);
  });

  it('ignores an effect whose once-per-match allowance is already spent', () => {
    const once = defineCard('once', {
      value: 5,
      effects: [
        {
          trigger: 'beforeCompare',
          effect: { type: 'modifyValue', amount: constant(10) },
          duration: 'thisComparison',
          limits: { oncePerMatch: true },
        },
      ],
    });
    const state = matchWith(['once'], [5]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(once))).toBe(15);
    state.triggerCounts[limitKey('a', 'once', 0)] = 1;
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(once))).toBe(5);
  });

  it('cannot read the opponent card, because there is not one yet', () => {
    // The projection is the honest answer to "what is this worth on its own".
    // A bonus that depends on what the opponent reveals is genuinely unknown at
    // selection time, and counting it would make a bot better informed than the
    // human sitting opposite it.
    const reader = defineCard('reader', {
      value: 5,
      effects: [
        {
          trigger: 'beforeCompare',
          conditions: {
            type: 'valueCompare',
            card: 'opponentCard',
            value: 'base',
            op: 'gte',
            amount: constant(1),
          },
          effect: { type: 'modifyValue', amount: constant(10) },
          duration: 'thisComparison',
        },
      ],
    });
    const state = matchWith(['reader'], [5]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(reader))).toBe(5);
  });

  it('leaves the match exactly as it found it', () => {
    const state = matchWith(['pack_scaler', 'pack_payoff'], [3, 2]);
    state.a.counters.Pack = 2;
    const before = JSON.stringify(state);
    projectHand(state, 'a', catalogOf(PACK_SCALER, PACK_PAYOFF));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keys the whole hand by instance id', () => {
    const state = matchWith(['pack_scaler', 'plain'], [3, 4]);
    state.a.counters.Pack = 1;
    const projected = projectHand(state, 'a', catalogOf(PACK_SCALER, PLAIN));
    expect(projected[state.a.cards.hand[0].iid]).toBe(6);
    expect(projected[state.a.cards.hand[1].iid]).toBe(4);
  });

  it('falls back to the printed value with no projection at all', () => {
    const card = cardOfValue(7, 'plain');
    expect(projectedValueOf(undefined, card)).toBe(7);
    expect(projectedValueOf({}, card)).toBe(7);
    expect(projectedValueOf({ [card.iid]: 19 }, card)).toBe(19);
  });

  it('falls back to the printed value for a card the catalog does not know', () => {
    const state = matchWith(['not_in_catalog'], [6]);
    expect(projectCardValue(state, 'a', state.a.cards.hand[0], catalogOf(PLAIN))).toBe(6);
  });
});
