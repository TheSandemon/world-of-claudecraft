// The ClaudeStone command arms: the queue, the play, the forfeit, the named
// regulars, and the deck builder.
//
// A sibling of the dispatch rather than more of it: server/game.ts is a named
// monolith under the extraction ratchet, so a family of new commands lands as
// its own module and the switch keeps one line per token. The SHAPE checks live
// here; every authority check stays in the sim, which owns the rules.

import type { Sim } from '../src/sim/sim';

/** The wire message, as loosely as the dispatch has it. */
type CardDuelCommandMessage = {
  cmd?: string;
  iid?: unknown;
  opponentId?: unknown;
  name?: unknown;
  cardIds?: unknown;
};

/**
 * Handles one ClaudeStone command. Returns whether the message was one, so the
 * dispatch can stay a single arm over the whole family.
 *
 * Every branch shape-checks its payload and then hands off: the sim refuses an
 * unknown opponent, an illegal deck, or a name past the cap, because the client
 * is a renderer and never an authority.
 */
export function handleCardDuelCommand(sim: Sim, msg: CardDuelCommandMessage, pid: number): boolean {
  switch (msg.cmd) {
    case 'card_queue_join':
      sim.joinCardDuelQueue(pid);
      return true;
    case 'card_queue_leave':
      sim.leaveCardDuelQueue(pid);
      return true;
    case 'play_card':
      // A hand INSTANCE id, not a face value. The integer guard is the shape
      // check; the sim owns the authority check, refusing an id the sender's
      // own hand does not hold rather than resolving it to some card.
      if (typeof msg.iid === 'number' && Number.isInteger(msg.iid)) {
        sim.playCardInDuel(msg.iid, pid);
      }
      return true;
    case 'card_forfeit':
      sim.forfeitCardDuel(pid);
      return true;
    case 'card_play_opponent':
      if (typeof msg.opponentId === 'string') sim.startCardDuelAgainstOpponent(msg.opponentId, pid);
      return true;
    case 'card_deck_save':
      if (
        typeof msg.name === 'string' &&
        Array.isArray(msg.cardIds) &&
        msg.cardIds.every((id: unknown) => typeof id === 'string')
      ) {
        sim.saveCardDeck(msg.name, msg.cardIds as string[], pid);
      }
      return true;
    case 'card_deck_select':
      if (typeof msg.name === 'string') sim.selectCardDeck(msg.name, pid);
      return true;
    case 'card_deck_delete':
      if (typeof msg.name === 'string') sim.deleteCardDeck(msg.name, pid);
      return true;
    default:
      return false;
  }
}
