import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EFFECT_PRIORITY, NON_COMMUTATIVE_EFFECTS } from '../src/sim/minigames/card_duel/resolve';
import { expectScansOnlyThroughSharedWalkers } from './helpers/scan_guard_self_audit';
import { tsFilesUnder } from './helpers/ts_files_under';

// Structural guards over the Card Duel engine. These are the two properties no
// behavior test can prove on its own:
//
//  1. Rng is drawn in deck.ts and selectors.ts ONLY. A hidden draw anywhere
//     else silently shifts the shared sim stream and invalidates
//     tests/parity/golden/card_duel.json without failing a single card test.
//  2. Every sanctioned primitive holds a resolution priority. A new primitive
//     with no priority sorts as `undefined` and would resolve in an arbitrary
//     place, which is exactly the order-dependence the engine promises not to
//     have.

const ENGINE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'sim',
  'minigames',
  'card_duel',
);

/** The modules allowed to consume the injected rng. */
const RNG_SITES = ['deck.ts', 'selectors.ts'];

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('card_duel engine guards', () => {
  it('draws rng in the two declared sites and nowhere else', () => {
    const files = tsFilesUnder(ENGINE_DIR);
    // Vacuity floor: the engine is a multi-module folder, so a scan that found
    // one or two files has lost most of it and would pass trivially.
    expect(files.length).toBeGreaterThanOrEqual(8);
    const drawing: string[] = [];
    for (const { file, full } of files) {
      const code = stripComments(readFileSync(full, 'utf8'));
      if (/\brng\.next\s*\(/.test(code) || /\bnext\s*\(\s*\)\s*\*/.test(code)) drawing.push(file);
    }
    expect(drawing.sort()).toEqual([...RNG_SITES].sort());
  });

  it('never reaches for a wall clock or Math.random', () => {
    // src/sim/tests/architecture.test.ts covers the whole sim tree, but this
    // engine also runs in the standalone slice and the bot, so the property is
    // pinned next to the folder that must hold it.
    for (const { file, full } of tsFilesUnder(ENGINE_DIR)) {
      const code = stripComments(readFileSync(full, 'utf8'));
      for (const banned of ['Math.random', 'Date.now', 'performance.now']) {
        expect(code.includes(banned), `${file} uses ${banned}`).toBe(false);
      }
    }
  });

  it('every effect primitive in the types union has a resolution priority', () => {
    const typesSource = readFileSync(path.join(ENGINE_DIR, 'types.ts'), 'utf8');
    const union = typesSource.slice(
      typesSource.indexOf('export type CardEffectDefinition'),
      typesSource.indexOf('export type CardEffectType'),
    );
    expect(union.length).toBeGreaterThan(200);
    const declared = [...union.matchAll(/readonly type: '([a-zA-Z]+)'/g)].map((m) => m[1]).sort();
    expect(declared.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(EFFECT_PRIORITY).sort()).toEqual(declared);
  });

  it('every non-commutative primitive is a real primitive with its own priority', () => {
    const priorities = new Map<number, string>();
    for (const type of NON_COMMUTATIVE_EFFECTS) {
      expect(EFFECT_PRIORITY[type], `${type} has no priority`).toBeTypeOf('number');
      const clash = priorities.get(EFFECT_PRIORITY[type]);
      expect(clash, `${type} shares a priority with ${clash}`).toBeUndefined();
      priorities.set(EFFECT_PRIORITY[type], type);
    }
  });

  it('scans the engine through the shared walker', () => {
    expectScansOnlyThroughSharedWalkers(import.meta.url, ['ts_files_under']);
  });
});
