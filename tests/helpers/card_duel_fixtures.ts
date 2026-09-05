// Shared ClaudeStone test fixtures. A live match holds CardInstances, not plain
// numbers, so a suite that wants to force "side A holds a 9" mints an instance
// rather than poking a number into the hand. Kept here (not copied per suite)
// because the engine, orchestrator, audio, and snapshot suites all drive
// matches this way.

import {
  buildBoard,
  type CardBoard,
  type CardCatalog,
  type CardDefinition,
  type CardEffect,
  type CardHandState,
  type CardInstance,
  type CardMatchState,
  type CardSeat,
  type CardValue,
  createMatchState,
} from '../../src/sim/minigames/card_duel';
import type { CardEvalContext } from '../../src/sim/minigames/card_duel/expressions';
import type { DuelBeatCue } from '../../src/ui/cards/duel_beats_core';
import { DUEL_CUE_METHOD, type DuelCueAudio } from '../../src/ui/cards/duel_cue_audio';

let nextFixtureIid = 900000;

/** One card instance of the given face value, with a unique instance id.
 *  Deterministic per call ORDER, which is all a test needs; production ids
 *  come from the seat stride in deck.ts. */
export function cardOfValue(value: number, cardId = `fixture_${value}`): CardInstance {
  nextFixtureIid += 1;
  return { iid: nextFixtureIid, cardId, value: value as CardValue };
}

/** The face values of a hand, for the value-shaped assertions a suite makes
 *  about what a side is holding. */
export function handValues(cards: readonly CardInstance[]): number[] {
  return cards.map((c) => c.value);
}

/** A whole zone (hand, deck, or discard) built from plain face values. */
export function cardsOfValues(values: readonly number[]): CardInstance[] {
  return values.map((v) => cardOfValue(v));
}

/** A card DEFINITION with sane defaults, so a test states only what it cares
 *  about ("a value-3 Beast whose effect is +1"). */
export function defineCard(
  id: string,
  over: Partial<Omit<CardDefinition, 'id'>> = {},
): CardDefinition {
  return {
    id,
    nameId: `${id}_name`,
    textId: `${id}_text`,
    art: id,
    // A fixture belongs to no design identity; the engine never branches on
    // this, so the basics' set id is the honest label for a card that is not
    // authored content.
    set: 'basics',
    value: 3,
    tribes: [],
    tags: [],
    rarity: 'common',
    effects: [],
    ...over,
  };
}

/** A catalog over a fixed list of definitions. */
export function makeCatalog(defs: readonly CardDefinition[]): CardCatalog {
  const byId = new Map(defs.map((d) => [d.id, d]));
  return { get: (id) => byId.get(id) };
}

/** An instance of a defined card. */
export function instanceOf(def: CardDefinition, iid?: number): CardInstance {
  if (iid === undefined) {
    nextFixtureIid += 1;
    return { iid: nextFixtureIid, cardId: def.id, value: def.value };
  }
  return { iid, cardId: def.id, value: def.value };
}

export function emptyHand(): CardHandState {
  return { deck: [], hand: [], discard: [] };
}

/** A match with both seats holding the given cards in hand. */
export function makeMatch(handA: CardInstance[] = [], handB: CardInstance[] = []): CardMatchState {
  return createMatchState(
    { deck: [], hand: handA, discard: [] },
    { deck: [], hand: handB, discard: [] },
  );
}

/** Locks both seats' cards in for the round, the state resolveCardRound
 *  expects. Playing normally moves the card to discard, which this mirrors. */
export function lockIn(
  state: CardMatchState,
  a: CardInstance | null,
  b: CardInstance | null,
): void {
  for (const [seat, card] of [
    ['a', a],
    ['b', b],
  ] as const) {
    const side = seat === 'a' ? state.a : state.b;
    side.playedThisRound = card;
    if (!card) continue;
    const idx = side.cards.hand.findIndex((c) => c.iid === card.iid);
    if (idx !== -1) side.cards.discard.push(side.cards.hand.splice(idx, 1)[0]);
  }
}

/** An evaluation context for the leaf evaluators (expressions, conditions,
 *  selectors), which take one rather than a whole resolution. */
export function evalContext(
  state: CardMatchState,
  catalog: CardCatalog,
  seat: CardSeat = 'a',
  board?: CardBoard,
): CardEvalContext {
  const live = board ?? buildBoard(state, catalog);
  return {
    state,
    board: live,
    catalog,
    seat,
    thisCard: (seat === 'a' ? state.a : state.b).playedThisRound,
  };
}

/** One `beforeCompare` effect, the shape most test cards want. */
export function effect(over: Partial<CardEffect> & Pick<CardEffect, 'effect'>): CardEffect {
  return { trigger: 'beforeCompare', ...over };
}

/** A counting rng stub: deterministic, and it reports how many draws it took
 *  so a test can pin that a code path drew nothing at all. */
export function countingRng(values: readonly number[] = [0]): {
  next(): number;
  draws: number;
} {
  let i = 0;
  return {
    draws: 0,
    next() {
      this.draws++;
      const v = values[i % values.length];
      i++;
      return v;
    },
  };
}

/**
 * A recording ClaudeStone audio surface: every cue, one method each, pushing
 * its own cue name onto a shared list.
 *
 * BUILT FROM `DUEL_CUE_METHOD` rather than hand-written, and that is the whole
 * point of it living here. Each suite used to spell its own five-method object
 * literal, so a cue added to the vocabulary broke three suites into a compile
 * error whose obvious fix (paste the new methods in) is also the fix that lets
 * a stub go on silently under-reporting: a method a stub does not have is a
 * sound a test cannot notice is missing. Derived from the map, a new cue
 * appears in every recorder at once, and `cues` reads back in the exact
 * vocabulary `DuelBeatCue` speaks.
 */
export function recordingCueAudio(): { cues: DuelBeatCue[]; audio: DuelCueAudio } {
  const cues: DuelBeatCue[] = [];
  const audio = {} as Record<string, () => void>;
  for (const [cue, method] of Object.entries(DUEL_CUE_METHOD)) {
    audio[method] = () => cues.push(cue as DuelBeatCue);
  }
  return { cues, audio: audio as unknown as DuelCueAudio };
}
