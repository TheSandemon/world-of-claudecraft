// The round pipeline: reveal, resolve, compare, react, refill. This is where
// determinism is won or lost, so three rules are enforced here rather than
// asked of card authors:
//
//  1. Effects are collected into an explicit array and sorted by a TOTAL key
//     (priority, card id, effect index, seat) that does not depend on the order
//     they were collected in. Resolving both seats forward or reversed produces
//     the same sequence, which is what makes "no competitive outcome depends on
//     a seat" true rather than aspirational.
//  2. Priorities live HERE, once per primitive, never on a card. A card using
//     `silence` inherits the right priority automatically, and the catalog test
//     fails at authoring time if two non-commutative primitives ever share one.
//  3. There is a hard per-round step ceiling. One process serves a whole realm,
//     so an unbounded trigger cycle between two cards is an outage, not a card
//     bug: on overflow the round stops resolving and is decided on current
//     values.

import { conditionsHold } from './conditions';
import { type CardRefillResult, refillHand } from './deck';
import { applyEffect } from './effects';
import type { CardEvalContext } from './expressions';
import {
  applyRoundResult,
  boardSide,
  buildBoard,
  type CardBoard,
  type CardCatalog,
  type CardMatchState,
  limitKey,
  otherSeat,
  recordHistory,
  sideOf,
} from './match_state';
import { consumeTriggered, expireModifiers, pendingModifiersFor } from './modifiers';
import { resolveTargets } from './selectors';
import type {
  CardDefinition,
  CardEffect,
  CardEffectType,
  CardInstance,
  CardRoundResult,
  CardSeat,
  CardTrigger,
} from './types';

/** The per-round resolution ceiling. Reached only by a cycle (a card that
 *  draws a card that draws a card ...), never by ordinary play: a round with
 *  two cards and a full effect list costs a couple of dozen steps. */
export const MAX_RESOLUTION_STEPS = 256;

/**
 * Resolution priority per primitive: LOWER resolves first. The values are
 * spaced so a future primitive can slot between two without renumbering.
 *
 * The commutative primitives deliberately share bucket 100: applying them in
 * any order gives the same answer, so a card using one never has to think
 * about order at all.
 */
export const EFFECT_PRIORITY: Readonly<Record<CardEffectType, number>> = {
  // Non-commutative, each on its own rung.
  silence: 10,
  removeTribe: 20,
  addTribe: 25,
  setValue: 30,
  swapValues: 35,
  // Commutative bucket.
  modifyValue: 100,
  addCounter: 100,
  removeCounter: 100,
  setCounter: 100,
  draw: 100,
  discard: 100,
  returnToHand: 100,
  reveal: 100,
  shuffleDiscardIntoDeck: 100,
  // Clamps, then the comparison rules, last so they see final values.
  minimumValue: 200,
  maximumValue: 210,
  winTies: 300,
  reverseComparison: 310,
};

/** The primitives whose result DEPENDS on when they run relative to another
 *  effect. Each must hold a priority no other member shares; the catalog test
 *  pins exactly that. */
export const NON_COMMUTATIVE_EFFECTS: readonly CardEffectType[] = [
  'silence',
  'removeTribe',
  'addTribe',
  'setValue',
  'swapValues',
  'minimumValue',
  'maximumValue',
  'winTies',
  'reverseComparison',
];

interface QueuedEffect {
  seat: CardSeat;
  card: CardInstance;
  def: CardDefinition;
  effect: CardEffect;
  index: number;
}

/** The total order effects resolve in. Independent of collection order by
 *  construction: no two entries can compare equal (a card id plus an effect
 *  index plus a seat is unique). */
function compareQueued(x: QueuedEffect, y: QueuedEffect): number {
  const px = EFFECT_PRIORITY[x.effect.effect.type];
  const py = EFFECT_PRIORITY[y.effect.effect.type];
  if (px !== py) return px - py;
  if (x.def.id !== y.def.id) return x.def.id < y.def.id ? -1 : 1;
  if (x.index !== y.index) return x.index - y.index;
  return x.seat === y.seat ? 0 : x.seat === 'a' ? -1 : 1;
}

/** What one resolved round produced. */
export interface CardRoundResolution {
  winner: CardSeat | null;
  aValue: number;
  bValue: number;
  aResult: CardRoundResult;
  bResult: CardRoundResult;
  /** Effects applied, for the ceiling test and the standalone slice's
   *  step-through view. */
  steps: number;
  /** True when the ceiling stopped resolution early. */
  overflow: boolean;
  refillA: CardRefillResult;
  refillB: CardRefillResult;
}

export interface CardResolveOptions {
  /** Dev-channel diagnostic sink for an overflow. English, never player text:
   *  src/sim/ stays language-agnostic. */
  onOverflow?: (message: string) => void;
  /** Skip the post-round refill (the standalone slice steps it separately). */
  skipRefill?: boolean;
}

/** Applies the clamps a card's minimumValue / maximumValue effects declared. */
export function clampedValue(board: CardBoard, seat: CardSeat): number {
  const side = boardSide(board, seat);
  let v = side.effectiveValue;
  if (side.floorValue !== null) v = Math.max(v, side.floorValue);
  if (side.ceilValue !== null) v = Math.min(v, side.ceilValue);
  return v;
}

/** Decides the round from the two final values and the comparison flags.
 *  Symmetric by construction: swapping the seats swaps the answer. */
export function decideWinner(board: CardBoard, aValue: number, bValue: number): CardSeat | null {
  // Two reversals cancel: the rule is "is the comparison reversed", not "did
  // anyone ask for it", so a mirror match of the same card plays normally.
  const reversed = board.a.reverseComparison !== board.b.reverseComparison;
  if (aValue === bValue) {
    if (board.a.winTies && !board.b.winTies) return 'a';
    if (board.b.winTies && !board.a.winTies) return 'b';
    return null;
  }
  const aHigher = aValue > bValue;
  const aWins = reversed ? !aHigher : aHigher;
  return aWins ? 'a' : 'b';
}

class Resolution {
  steps = 0;
  overflow = false;
  private readonly pending: QueuedEffect[] = [];

  constructor(
    readonly state: CardMatchState,
    readonly board: CardBoard,
    readonly catalog: CardCatalog,
    readonly rng: { next(): number },
    readonly opts: CardResolveOptions,
  ) {}

  private ctxFor(entry: QueuedEffect): CardEvalContext {
    return {
      state: this.state,
      board: this.board,
      catalog: this.catalog,
      seat: entry.seat,
      thisCard: entry.card,
    };
  }

  /** Effects a card declares for one trigger, as queue entries. */
  private entriesFor(seat: CardSeat, card: CardInstance, trigger: CardTrigger): QueuedEffect[] {
    const def = this.catalog.get(card.cardId);
    if (!def) return [];
    const out: QueuedEffect[] = [];
    def.effects.forEach((effect, index) => {
      if (effect.trigger === trigger) out.push({ seat, card, def, effect, index });
    });
    return out;
  }

  /** A card whose lifecycle trigger fired mid-resolution (drawn, discarded).
   *  Queued rather than applied inline: this is the only way a cycle can form,
   *  so it must pass through the ceiling. */
  queueCardTrigger(seat: CardSeat, card: CardInstance, trigger: CardTrigger): void {
    this.pending.push(...this.entriesFor(seat, card, trigger));
  }

  /** Effect limits: the authored caps on how often one effect may fire. */
  private limitsAllow(entry: QueuedEffect): boolean {
    const limits = entry.effect.limits;
    if (!limits) return true;
    const key = limitKey(entry.seat, entry.def.id, entry.index);
    const fired = this.state.triggerCounts[key] ?? 0;
    const lastRound = this.state.lastTriggerRound[key];
    if (limits.oncePerMatch && fired >= 1) return false;
    if (limits.maxTriggers !== undefined && fired >= limits.maxTriggers) return false;
    if (limits.oncePerRound && lastRound === this.state.round) return false;
    if (
      limits.cooldownRounds !== undefined &&
      lastRound !== undefined &&
      this.state.round - lastRound < limits.cooldownRounds
    ) {
      return false;
    }
    return true;
  }

  private noteFired(entry: QueuedEffect): void {
    if (!entry.effect.limits) return;
    const key = limitKey(entry.seat, entry.def.id, entry.index);
    this.state.triggerCounts[key] = (this.state.triggerCounts[key] ?? 0) + 1;
    this.state.lastTriggerRound[key] = this.state.round;
  }

  private applyOne(entry: QueuedEffect): void {
    // A silenced card's own effects stop resolving for the round. The silence
    // itself resolved earlier (priority 10), which is what makes this work
    // without a second pass.
    if (boardSide(this.board, entry.seat).silenced && this.board[entry.seat].card) return;
    const ctx = this.ctxFor(entry);
    if (!conditionsHold(entry.effect.conditions, ctx)) return;
    if (!this.limitsAllow(entry)) return;
    this.noteFired(entry);
    applyEffect(
      entry.effect.effect,
      entry.effect.duration ?? 'thisComparison',
      entry.effect.stackMode ?? 'stack',
      resolveTargets(entry.effect.target, ctx, this.rng),
      ctx,
      this.rng,
      this,
    );
  }

  /** Drains whatever earlier work queued (a drawn card's onDraw effects),
   *  under the same ceiling. */
  drainPending(): void {
    this.drain([]);
  }

  /** Runs one trigger phase over both seats plus anything queued by it. */
  runPhase(trigger: CardTrigger, seats: readonly CardSeat[] = ['a', 'b']): void {
    const batch: QueuedEffect[] = [];
    for (const seat of seats) {
      const card = sideOf(this.state, seat).playedThisRound;
      if (card) batch.push(...this.entriesFor(seat, card, trigger));
    }
    this.drain(batch);
  }

  /** Applies a batch in the total order, then whatever it queued, until the
   *  work runs out or the ceiling stops it. */
  private drain(batch: QueuedEffect[]): void {
    let work = [...batch].sort(compareQueued);
    while (work.length > 0) {
      for (const entry of work) {
        if (this.steps >= MAX_RESOLUTION_STEPS) {
          if (!this.overflow) {
            this.overflow = true;
            this.opts.onOverflow?.(
              `card duel resolution exceeded ${MAX_RESOLUTION_STEPS} steps; resolving on current values`,
            );
          }
          this.pending.length = 0;
          return;
        }
        this.steps++;
        this.applyOne(entry);
      }
      work = this.pending.splice(0, this.pending.length).sort(compareQueued);
    }
  }
}

/**
 * Resolves the round both seats have locked cards for, start to finish, and
 * leaves the match ready for the next one.
 *
 * A seat with no played card is legal (it timed out, or an effect emptied its
 * hand): it simply loses the comparison, which is what "a player with an empty
 * hand at comparison time forfeits the round" means mechanically.
 */
export function resolveCardRound(
  state: CardMatchState,
  catalog: CardCatalog,
  rng: { next(): number },
  opts: CardResolveOptions = {},
): CardRoundResolution {
  const board = buildBoard(state, catalog);
  const run = new Resolution(state, board, catalog, rng, opts);

  // Parked modifiers fire first: they were priced in an earlier round and are
  // part of the card's state before any of this round's effects read it.
  for (const seat of ['a', 'b'] as const) {
    const card = sideOf(state, seat).playedThisRound;
    if (!card) continue;
    const fired = pendingModifiersFor(state, seat, card, catalog);
    for (const mod of fired) {
      applyEffect(
        mod.effect,
        'thisComparison',
        'stack',
        [{ kind: 'board', seat }],
        { state, board, catalog, seat, thisCard: card },
        rng,
        run,
      );
    }
    consumeTriggered(fired);
  }

  run.runPhase('onReveal');
  run.runPhase('beforeCompare');

  const aValue = clampedValue(board, 'a');
  const bValue = clampedValue(board, 'b');
  // A seat that played nothing cannot win the round, whatever the numbers say.
  const aPlayed = state.a.playedThisRound !== null;
  const bPlayed = state.b.playedThisRound !== null;
  let winner: CardSeat | null;
  if (!aPlayed && !bPlayed) winner = null;
  else if (!aPlayed) winner = 'b';
  else if (!bPlayed) winner = 'a';
  else winner = decideWinner(board, aValue, bValue);

  const resultFor = (seat: CardSeat): CardRoundResult =>
    winner === null ? 'tie' : winner === seat ? 'win' : 'lose';

  if (winner !== null) {
    run.runPhase('onWin', [winner]);
    run.runPhase('onLose', [otherSeat(winner)]);
  } else {
    run.runPhase('onTie');
  }

  // History records the values the round was actually decided on, so a later
  // history query reads what happened rather than what was printed.
  for (const seat of ['a', 'b'] as const) {
    const card = sideOf(state, seat).playedThisRound;
    if (!card) continue;
    recordHistory(
      state,
      seat,
      card,
      seat === 'a' ? aValue : bValue,
      boardSide(board, seat).tribes,
      resultFor(seat),
    );
  }

  run.runPhase('onDiscard');
  applyRoundResult(state, winner);

  const refillA: CardRefillResult = opts.skipRefill
    ? { drawn: [], reshuffled: false }
    : refillHand(rng, state.a.cards);
  const refillB: CardRefillResult = opts.skipRefill
    ? { drawn: [], reshuffled: false }
    : refillHand(rng, state.b.cards);
  for (const [seat, refill] of [
    ['a', refillA],
    ['b', refillB],
  ] as const) {
    for (const card of refill.drawn) run.queueCardTrigger(seat, card, 'onDraw');
  }
  run.drainPending();
  run.runPhase('onRoundEnd');

  for (const seat of ['a', 'b'] as const) {
    const side = sideOf(state, seat);
    side.previousCard = side.playedThisRound;
    side.playedThisRound = null;
  }
  expireModifiers(state);
  state.round++;

  return {
    winner,
    aValue,
    bValue,
    aResult: resultFor('a'),
    bResult: resultFor('b'),
    steps: run.steps,
    overflow: run.overflow,
    refillA,
    refillB,
  };
}
