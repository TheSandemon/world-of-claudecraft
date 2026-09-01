// @vitest-environment happy-dom
//
// The Card Master's gossip dialog must not open over an unread match summary.
//
// The defect: the Card Master stands exactly where a duel is played, and his
// gossip dialog paints OVER the duel window. So the interact press (or the
// left-click that "talks too", src/game/interactions.ts) that landed on him as
// a match ended replaced the summary with a menu before the player had read a
// word of it. The one thing a finished match owes the player is its result,
// and that was the one thing the ending could not show.
//
// `CardDuelWindow.holdsUnreadSummary` is the gate, and `Hud.openQuestDialog` is
// the single funnel every NPC-gossip route goes through (both
// src/game/interactions.ts arms and src/game/nearby_interaction.ts), so gating
// there covers the click path and the keypress path at once. That wiring is
// pinned from source at the bottom of this file: a getter nothing consults is
// the shape this bug comes back in.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { CardDuelWindow } from '../src/ui/card_duel_window';
import type { CardMinigameInfo } from '../src/world_api';

const here = path.dirname(fileURLToPath(import.meta.url));
const HUD = readFileSync(path.join(here, '..', 'src', 'ui', 'hud.ts'), 'utf8');

const noDecks = { names: [], active: '', activeCards: [] };

/** The projection AFTER a match has ended: the server keeps no finished match,
 *  so `match` is already null by the time the summary is shown. */
function endedInfo(): CardMinigameInfo {
  return { queued: false, available: true, decks: noDecks, match: null };
}

function makeWindow() {
  const root = document.createElement('div');
  document.body.append(root);
  root.style.display = 'block';
  const world = {
    cardMinigameInfo: endedInfo(),
    joinCardDuelQueue() {},
    leaveCardDuelQueue() {},
    forfeitCardDuel() {},
    playCardInDuel() {},
    startCardDuelAgainstOpponent() {},
  };
  const win = new CardDuelWindow({
    root: () => root,
    world: () => world as never,
    openDeckBuilder() {},
    closeOthers() {},
    captureFocus: () => null,
    restoreFocus() {},
  });
  return { win, root };
}

/** A finished match, as the match-end event delivers it. */
const ending = {
  won: true,
  rounds: 3,
  myHp: 40,
  theirHp: 0,
  maxHp: 100,
  damageDealt: 100,
  damageTaken: 60,
  opponentName: 'Pell',
  opponentId: 'pell',
};

describe('the gossip gate on an unread duel summary', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('is closed before a match ends', () => {
    const { win } = makeWindow();
    win.render();
    expect(win.holdsUnreadSummary).toBe(false);
  });

  it('holds while the summary owns the open window', () => {
    const { win } = makeWindow();
    win.render();
    // No theater is playing (the window was never handed a resolved round), so
    // the summary takes the window immediately rather than queueing.
    win.showMatchEnd(ending);
    expect(win.holdsUnreadSummary).toBe(true);
  });

  it('releases the moment the player dismisses the summary', () => {
    const { win, root } = makeWindow();
    win.render();
    win.showMatchEnd(ending);
    const close = root.querySelector('[data-sumclose]') as HTMLElement | null;
    expect(close).not.toBeNull();
    close?.click();
    expect(win.holdsUnreadSummary).toBe(false);
  });

  it('releases when the player closes the whole window', () => {
    const { win } = makeWindow();
    win.render();
    win.showMatchEnd(ending);
    win.close();
    // A window the player has closed is not covering anything, even though the
    // summary is retained so a reopen still shows the result.
    expect(win.holdsUnreadSummary).toBe(false);
  });

  it('releases on a rematch against the same opponent', () => {
    const { win, root } = makeWindow();
    win.render();
    win.showMatchEnd(ending);
    const rematch = root.querySelector('[data-rematch]') as HTMLElement | null;
    expect(rematch).not.toBeNull();
    rematch?.click();
    expect(win.holdsUnreadSummary).toBe(false);
  });

  it('is what Hud.openQuestDialog consults before opening the gossip', () => {
    // Source pin rather than a Hud instantiation: the coordinator needs a whole
    // world, a renderer and a document to construct, and the property under
    // test is one guard. The teeth are that the guard names BOTH sides.
    const body =
      HUD.match(/openQuestDialog\(npcId: number\): void \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    expect(body).not.toBe('');
    expect(body).toContain('holdsUnreadSummary');
    expect(body).toContain('this.questDialog.open(npcId)');
    // The guard must be a REFUSAL, not a bare call beside it.
    expect(body).toMatch(/if\s*\(\s*!\s*this\.cardWindows\.cardDuel\.holdsUnreadSummary\s*\)/);
  });
});
