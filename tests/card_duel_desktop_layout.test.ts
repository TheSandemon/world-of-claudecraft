// The Card Duel DESKTOP table (the "card duel desktop table" section of
// src/styles/cards.css).
//
// The table above that section is a phone table, and on a desktop viewport it was
// a 380px column in the middle of a monitor. The wide layout gives it a board, a
// rail and a hand a player can read, and the properties pinned here are the ones
// whose loss is SILENT: a viewport-keyed reflow that lies about a resized window,
// a bound that lets the WINDOW scroll (which drags the sticky health bars out of
// view with it), a fan written as a pattern that stops matching when the hand
// grows, and any wide rule that hides something a player acts on.
//
// Everything is asserted against the SECTION SLICE, never the whole sheet: a
// selector that exists somewhere else in cards.css must not credit this block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HAND_SIZE } from '../src/sim/minigames/card_duel/deck';

const here = path.dirname(fileURLToPath(import.meta.url));
const CARDS_CSS = readFileSync(path.join(here, '..', 'src', 'styles', 'cards.css'), 'utf8');

const BANNER = /\/\*\s*-{10,}\s*([^*]+?)\s*-{10,}\s*\*\//g;

/** The text of one ten-dash section, up to the next banner (or end of sheet). */
function section(name: string): string {
  BANNER.lastIndex = 0;
  const bounds: { name: string; start: number; end: number }[] = [];
  for (const m of CARDS_CSS.matchAll(BANNER)) {
    bounds.push({ name: m[1].trim(), start: m.index, end: CARDS_CSS.length });
  }
  for (let i = 0; i < bounds.length - 1; i++) bounds[i].end = bounds[i + 1].start;
  const hit = bounds.find((b) => b.name === name);
  return hit ? CARDS_CSS.slice(hit.start, hit.end) : '';
}

const DESKTOP = section('card duel desktop table');
// The touch layout is the OTHER place the two slots sit side by side (its query
// covers a landscape phone via max-height), so the seat sides are pinned there
// too: fixing one and leaving the other is the shape this bug would come back in.
const TOUCH = section('card duel touch layout');

describe('card duel desktop table', () => {
  it('has a wide section at all, and it is a real slice of the sheet', () => {
    expect(DESKTOP).not.toBe('');
    // Teeth: the slicer must not silently hand back the whole stylesheet.
    expect(DESKTOP.length).toBeLessThan(CARDS_CSS.length);
    expect(DESKTOP).not.toContain('card duel touch layout');
  });

  it('splits the two queries: the viewport decides the SIZE, the container the REFLOW', () => {
    // The duel window carries a resize grip, so a player can drag it back down to
    // a column. A viewport-keyed reflow would go on painting a two-column board
    // inside a 400px box, which is why the reflow is keyed on the body's own
    // measurement instead.
    const media = DESKTOP.match(/@media[^{]*\{/)?.[0] ?? '';
    expect(media).toContain('min-width: 60rem');
    expect(media).toContain('min-height: 45rem');
    expect(media).toContain('pointer: fine');

    // The container is DECLARED inside that media query (so a phone never
    // establishes it) and the reflow is an @container rule against that name.
    const mediaBlock = DESKTOP.slice(DESKTOP.indexOf('@media'), DESKTOP.indexOf('@container'));
    expect(mediaBlock).toContain('container-name: cd-table');
    expect(mediaBlock).toContain('container-type: inline-size');
    expect(mediaBlock).toMatch(/#card-duel-window\s*\{[^}]*width:/);
    expect(DESKTOP).toMatch(/@container cd-table \(min-width: \d+rem\)/);

    // And the window's own width is clamped against the app viewport, never a
    // raw vw: the two disagree under the #ui zoom and device emulation.
    expect(mediaBlock).toContain('--app-vw');
    expect(mediaBlock).toContain('--window-scale');
  });

  it('bounds the BOARD, not the window, and sticks both health bars inside it', () => {
    // The regression this replaced: the board was bounded against the raw
    // viewport with too small a furniture allowance, so the WINDOW overflowed
    // instead. A sticky element only travels inside its own scrollport, so a
    // scrolling window carried the board (and the player's own health bar) off
    // the bottom of the screen while the bars believed they were pinned.
    const bound = DESKTOP.match(/\.dt-board,\s*\n\s*\.dt-side \{[^}]*\}/)?.[0] ?? '';
    expect(bound).toContain('max-height:');
    expect(bound).toContain('--app-vh');
    // Against the WINDOW's own clamp (the same 0.9 factor #card-duel-window uses),
    // so the two cannot drift apart and let the window scroll again.
    expect(bound).toContain('* 0.9');
    expect(bound).toContain('overflow-y: auto');

    expect(DESKTOP).toMatch(
      /\.dt-board > \[data-cd-seats-them\],\s*\n\s*\.dt-board > \[data-cd-seats-mine\] \{[^}]*position: sticky/,
    );
    expect(DESKTOP).toMatch(/\.dt-board > \[data-cd-seats-them\] \{\s*top: 0;/);
    expect(DESKTOP).toMatch(/\.dt-board > \[data-cd-seats-mine\] \{\s*bottom: 0;/);
    // And the hand, the one row a player has to reach, is pinned too.
    expect(DESKTOP).toMatch(
      /\.dt-hand-wrap,\s*\n\s*\.dt-forfeit \{[^}]*position: sticky;[^}]*bottom: 0;/,
    );
  });

  it('lays the board and its rail out as named areas, with the hand across the bottom', () => {
    const grid = DESKTOP.match(/\.dt \{[^}]*\}/)?.[0] ?? '';
    expect(grid).toContain('display: grid');
    expect(grid).toContain('"board side"');
    expect(grid).toContain('"hand  forfeit"');
    for (const area of ['board', 'side', 'hand', 'forfeit']) {
      expect(DESKTOP).toContain(`grid-area: ${area};`);
    }
  });

  it('fans exactly the whole hand, and the engine still deals that many cards', () => {
    // The fan is four EXACT rules rather than a pattern, so it must be re-read
    // if the hand ever grows. This is the pin that makes that true: a hand of
    // five would leave the fifth card unrotated and unstyled, silently.
    expect(HAND_SIZE).toBe(4);
    const fanned = [...DESKTOP.matchAll(/\.dt-hand \.cf:nth-child\((\d+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(fanned.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(fanned.length).toBe(HAND_SIZE);
    // Transform only, so the fan costs no layout and no tier has to shed it.
    for (const m of DESKTOP.matchAll(/\.dt-hand \.cf:nth-child\(\d+\) \{([^}]*)\}/g)) {
      expect(m[1].trim()).toMatch(/^transform: rotate\(-?[\d.]+deg\);$/);
    }
  });

  it('the desktop hand SHOWS the rules sentence rather than hiding anything', () => {
    // The one thing a desktop player gains, and the direction matters: this
    // block may only turn the sentence ON. The accessible name and the inspector
    // carry it everywhere else, at every size, on every device.
    expect(DESKTOP).toMatch(/\.dt-hand \.cf-size-hand \.cf-rules \{\s*display: block;\s*\}/);
  });

  it('seats YOUR card on the left of the board and theirs on the right', () => {
    // Ownership across the two side-by-side slots reads left to right, and the
    // seat the player acts from is the one the eye lands on first. Pinned as
    // the ORDER values rather than the source order, because the slots are
    // written theirs-first in duel_table_markup.ts and it is the flex/grid
    // order that decides which side of the felt each one lands on.
    const mine = Number(DESKTOP.match(/\.dt-slot-mine\s*\{[^}]*order:\s*(\d+)/)?.[1]);
    const theirs = Number(DESKTOP.match(/\.dt-slot-theirs\s*\{[^}]*order:\s*(\d+)/)?.[1]);
    expect(Number.isFinite(mine)).toBe(true);
    expect(Number.isFinite(theirs)).toBe(true);
    expect(mine, 'your own card must sit left of the opponent card').toBeLessThan(theirs);

    // And the clash lunges follow the seats: each card leans INTO the other,
    // so the card on the left strikes right. A swap that moved the slots and
    // left the animations behind would have them lunging apart.
    const lungeMine = DESKTOP.match(
      /\[data-beat="clash"\]\s*\.dt-slot-mine\s*\{[^}]*animation-name:\s*([\w-]+)/,
    )?.[1];
    const lungeTheirs = DESKTOP.match(
      /\[data-beat="clash"\]\s*\.dt-slot-theirs\s*\{[^}]*animation-name:\s*([\w-]+)/,
    )?.[1];
    expect(lungeMine).toBe('dt-lunge-right');
    expect(lungeTheirs).toBe('dt-lunge-left');
  });

  it('seats the same way on the landscape/touch layout, lunges included', () => {
    expect(TOUCH).not.toBe('');
    expect(TOUCH).not.toContain('card duel desktop table');
    const mine = Number(TOUCH.match(/\.dt-slot-mine\s*\{[^}]*order:\s*(\d+)/)?.[1]);
    const theirs = Number(TOUCH.match(/\.dt-slot-theirs\s*\{[^}]*order:\s*(\d+)/)?.[1]);
    expect(Number.isFinite(mine)).toBe(true);
    expect(Number.isFinite(theirs)).toBe(true);
    expect(mine).toBeLessThan(theirs);
    expect(
      TOUCH.match(
        /\[data-beat="clash"\]\s*\.dt-slot-mine\s*\{[^}]*animation-name:\s*([\w-]+)/,
      )?.[1],
    ).toBe('dt-lunge-right');
    expect(
      TOUCH.match(
        /\[data-beat="clash"\]\s*\.dt-slot-theirs\s*\{[^}]*animation-name:\s*([\w-]+)/,
      )?.[1],
    ).toBe('dt-lunge-left');
  });

  it('the narration line is the readable size, not the smallest type on the board', () => {
    // The caption is what a player READS while the round plays out, on the
    // widest surface the table has. It was 13px here, under the 14px the seat
    // names and the rail chips got, which is backwards.
    const beats = DESKTOP.match(/\.dt-beats\s*\{([^}]*)\}/)?.[1] ?? '';
    const size = Number(beats.match(/font-size:\s*(\d+)px/)?.[1]);
    expect(size).toBeGreaterThanOrEqual(16);
    // Room for the wrapped case: a caption that grows a line mid-round would
    // reflow the stage above it and move the cards it is describing.
    const minHeight = Number(beats.match(/min-height:\s*(\d+)px/)?.[1]);
    expect(minHeight).toBeGreaterThanOrEqual(2 * size);
  });

  it('fairness: the wide layout hides nothing a player acts on', () => {
    // Same list the tier guard in card_duel_window_clock.test.ts protects. A
    // layout is not a graphics tier, but it is the other place a readout could
    // quietly leave the screen, and a wide viewport is the one that has room for
    // all of them.
    const actionable = [
      '.dt-clock-num',
      '.dt-plate-value',
      '.dt-plate-base',
      '.dt-chip',
      '.dt-hp-num',
      '.dt-hp',
      '.dt-token',
      '.dt-rounds',
      '.dt-waiting',
      '.dt-effects-row',
      '.dt-fx',
      '.cf-value',
      '.cf-delta',
      '.cf-base',
      '.dt-beats',
      '.dt-damage',
      '.dt-verdict',
    ];
    for (const m of DESKTOP.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = m[1].trim();
      const body = m[2];
      if (!/display:\s*none|visibility:\s*hidden|opacity:\s*0\s*;/.test(body)) continue;
      for (const name of actionable) {
        expect(
          selector.includes(name),
          `the desktop layout hides an actionable readout: ${selector} { ${body.trim()} }`,
        ).toBe(false);
      }
    }
  });
});
