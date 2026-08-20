// Target resolution: the TARGET half of the card grammar. Turns a declarative
// selector into the concrete things an effect applies to.
//
// One of the engine's two declared rng sites (the other is deck.ts): only the
// `random` zone selector draws, and it draws exactly one number per card it
// picks. Nothing else here touches the rng, so the parity golden's draw count
// stays predictable from the card text alone.

import type { CardEvalContext } from './expressions';
import { seatForOwner, sideOf } from './match_state';
import type {
  CardDefinition,
  CardInstance,
  CardMatchFilter,
  CardSeat,
  CardTargetSelector,
  CardZone,
} from './types';

/** What an effect actually acts on, after selection. */
export type CardResolvedTarget =
  /** The card this seat has on the board this round. */
  | { kind: 'board'; seat: CardSeat }
  /** One specific card sitting in a zone. */
  | { kind: 'zoneCard'; seat: CardSeat; zone: CardZone; card: CardInstance }
  /** A modifier parked on the seat's next played card (optionally filtered). */
  | { kind: 'nextCard'; seat: CardSeat; match?: CardMatchFilter }
  /** The player rather than a card: counters, draws, whole-hand reveals. */
  | { kind: 'player'; seat: CardSeat };

/** Does a card satisfy a match filter? Every field ANDs; an absent field never
 *  narrows. Tribe and tag come from the DEFINITION, so a card whose tribes were
 *  edited on the board is still selected by its printed tribes in a zone (it is
 *  not on the board, so it has no live tribe list). */
export function cardMatches(
  card: CardInstance,
  def: CardDefinition | undefined,
  filter: CardMatchFilter | undefined,
): boolean {
  if (!filter) return true;
  if (filter.value !== undefined && card.value !== filter.value) return false;
  if (filter.minValue !== undefined && card.value < filter.minValue) return false;
  if (filter.maxValue !== undefined && card.value > filter.maxValue) return false;
  if (filter.cardId !== undefined && card.cardId !== filter.cardId) return false;
  if (filter.tribe !== undefined && !def?.tribes.includes(filter.tribe)) return false;
  if (filter.tag !== undefined && !def?.tags.includes(filter.tag)) return false;
  return true;
}

function zoneCards(ctx: CardEvalContext, seat: CardSeat, zone: CardZone): CardInstance[] {
  const cards = sideOf(ctx.state, seat).cards;
  if (zone === 'hand') return cards.hand;
  if (zone === 'deck') return cards.deck;
  return cards.discard;
}

/** Highest/lowest ties break on instance id, ascending, so the pick never
 *  depends on where a card happens to sit in its zone array. */
function byValueThenIid(a: CardInstance, b: CardInstance, highest: boolean): number {
  if (a.value !== b.value) return highest ? b.value - a.value : a.value - b.value;
  return a.iid - b.iid;
}

/**
 * Resolves a selector into concrete targets. `rng` is consumed only by the
 * `random` selector; passing a stub for the other selectors is safe and is
 * what the unit tests do.
 */
export function resolveTargets(
  target: CardTargetSelector | undefined,
  ctx: CardEvalContext,
  rng: { next(): number },
): CardResolvedTarget[] {
  // No declared target means the card itself, which is what the overwhelming
  // majority of cards want.
  const sel: CardTargetSelector = target ?? { type: 'thisCard' };
  switch (sel.type) {
    case 'thisCard':
    case 'myCard':
      return [{ kind: 'board', seat: ctx.seat }];
    case 'opponentCard':
      return [{ kind: 'board', seat: ctx.seat === 'a' ? 'b' : 'a' }];
    case 'nextCard':
      return [{ kind: 'nextCard', seat: seatForOwner(ctx.seat, sel.owner), match: sel.match }];
    case 'player':
      return [{ kind: 'player', seat: seatForOwner(ctx.seat, sel.owner) }];
    case 'zone': {
      const seat = seatForOwner(ctx.seat, sel.owner);
      const pool = zoneCards(ctx, seat, sel.zone).filter((c) =>
        cardMatches(c, ctx.catalog.get(c.cardId), sel.match),
      );
      const count = Math.max(1, Math.trunc(sel.count ?? 1));
      const picked: CardInstance[] = [];
      switch (sel.select) {
        case 'all':
          picked.push(...pool);
          break;
        case 'first':
          picked.push(...pool.slice(0, count));
          break;
        case 'highest':
          picked.push(...[...pool].sort((x, y) => byValueThenIid(x, y, true)).slice(0, count));
          break;
        case 'lowest':
          picked.push(...[...pool].sort((x, y) => byValueThenIid(x, y, false)).slice(0, count));
          break;
        case 'random': {
          // One draw per picked card, from a shrinking pool: the same seed
          // always picks the same cards, and a pool smaller than `count`
          // simply yields fewer targets rather than drawing wastefully.
          const remaining = [...pool];
          for (let i = 0; i < count && remaining.length > 0; i++) {
            const idx = Math.floor(rng.next() * remaining.length);
            picked.push(remaining.splice(idx, 1)[0]);
          }
          break;
        }
      }
      return picked.map((card) => ({ kind: 'zoneCard', seat, zone: sel.zone, card }));
    }
  }
}
