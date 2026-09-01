// The two ClaudeStone HUD windows, built together.
//
// A tiny factory rather than two more declarations on the coordinator: hud.ts
// is a named monolith under the extraction ratchet (root CLAUDE.md), and the
// duel window and the deck builder are one family with one dependency bag. Hud
// keeps the orchestration (which window opens, what closes with it); this owns
// only the construction.

import type { IWorld } from '../../world_api';
import { CardDuelWindow } from '../card_duel_window';
import { DeckBuilderWindow } from '../deck_builder_window';

/** The narrow bag the two windows need from the HUD. */
export interface CardWindowsDeps {
  root(selector: string): HTMLElement;
  world(): IWorld;
  closeOthers(selector: string): void;
  /** The HUD's shared focus trap plumbing for a window root. */
  focus(selector: string): {
    captureFocus(): HTMLElement | null;
    restoreFocus(target: HTMLElement | null): void;
  };
}

export interface CardWindows {
  cardDuel: CardDuelWindow;
  deckBuilder: DeckBuilderWindow;
}

export function createCardWindows(deps: CardWindowsDeps): CardWindows {
  const deckBuilder = new DeckBuilderWindow({
    root: () => deps.root('#deck-builder-window'),
    world: deps.world,
    closeOthers: () => deps.closeOthers('#deck-builder-window'),
    ...deps.focus('#deck-builder-window'),
  });
  const cardDuel = new CardDuelWindow({
    root: () => deps.root('#card-duel-window'),
    world: deps.world,
    openDeckBuilder: () => deckBuilder.toggle(),
    closeOthers: () => deps.closeOthers('#card-duel-window'),
    ...deps.focus('#card-duel-window'),
  });
  return { cardDuel, deckBuilder };
}
