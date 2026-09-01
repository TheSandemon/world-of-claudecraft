#!/usr/bin/env node
// One-shot importer: scripts/card_catalog/card_catalog_200.csv -> the per-identity
// card content modules under src/sim/content/cards/sets/, plus the English name and
// rules-text block for src/ui/i18n.catalog/cards.ts.
//
// This is NOT a build step and its output is NOT a generated artifact. Cards are
// content: once imported, the TypeScript under src/sim/content/cards/sets/ is the
// source of truth and is hand-tuned there like any other content module. The CSV
// and this script are kept so the original bulk import stays reproducible and
// reviewable, and so a future bulk re-import does not have to be reinvented.
//
// It fails loudly on anything it cannot map to the rules grammar in
// src/sim/minigames/card_duel/types.ts. A guess here would ship a card that reads
// one way and resolves another, which is exactly what the tooltip contract forbids.
//
//   node scripts/import_card_catalog.mjs [--out <dir>] [--i18n <file>]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'scripts/card_catalog/card_catalog_200.csv');

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};
const OUT_DIR = argOf('--out', join(ROOT, 'src/sim/content/cards/sets'));
const I18N_OUT = argOf('--i18n', join(ROOT, 'scripts/card_catalog/cards_i18n_block.txt'));

// ---------------------------------------------------------------------------
// The sanctioned vocabulary, mirrored from types.ts. A value outside these is a
// hard failure, never a pass-through.
// ---------------------------------------------------------------------------
const TRIBES = new Set([
  'Beast',
  'Human',
  'Undead',
  'Demon',
  'Spider',
  'Mudfin',
  'Burrower',
  'Construct',
  'Elemental',
  'Spirit',
  'Dragon',
  'Bandit',
]);
const TAGS = new Set([
  'Wolf',
  'Boss',
  'RareMob',
  'Eastbrook',
  'Mirefen',
  'Quest',
  'Nature',
  'Fire',
  'CardMaster',
  'Profession',
  'Dungeon',
]);
const TRIGGERS = new Set([
  'onDraw',
  'onReveal',
  'beforeCompare',
  'onWin',
  'onLose',
  'onTie',
  'onDiscard',
  'onRoundStart',
  'onRoundEnd',
]);
const DURATIONS = new Set([
  'instant',
  'thisComparison',
  'thisRound',
  'nextRound',
  'untilTriggered',
  'untilMatchEnd',
]);
const STACK_MODES = new Set(['stack', 'replace', 'highest', 'lowest', 'unique']);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const OPS = new Set(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']);
const REFS = new Set([
  'thisCard',
  'myCard',
  'opponentCard',
  'myPreviousCard',
  'opponentPreviousCard',
]);
const OWNERS = new Set(['self', 'opponent']);
const ZONES = new Set(['hand', 'deck', 'discard']);
const SELECTS = new Set(['first', 'random', 'all', 'highest', 'lowest']);
const RESULTS = new Set(['win', 'lose', 'tie']);
/** Primitives whose CSV amount column holds a number rather than a tribe name
 *  or a prose note. */
const NUMERIC_PRIMS = new Set([
  'modifyValue',
  'setValue',
  'minimumValue',
  'maximumValue',
  'draw',
  'addCounter',
  'removeCounter',
  'setCounter',
]);
const COUNTER_PRIMS = new Set(['addCounter', 'removeCounter', 'setCounter']);
const TRIBE_PRIMS = new Set(['addTribe', 'removeTribe']);
/** Primitives that take neither an amount nor a tribe. */
const BARE_PRIMS = new Set([
  'swapValues',
  'reveal',
  'discard',
  'returnToHand',
  'silence',
  'winTies',
  'reverseComparison',
  'shuffleDiscardIntoDeck',
]);

let failures = 0;
function fail(cardId, message) {
  failures++;
  console.error(`  ${cardId}: ${message}`);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ---------------------------------------------------------------------------
// Little parse helpers. Every one of them is total: an unrecognized shape
// returns null and the caller reports it.
// ---------------------------------------------------------------------------

/** Splits `a, b(c, d), e` on TOP-LEVEL commas only. */
function splitArgs(inner) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

/** `name(args)` -> { name, args: [...] }, or null. */
function callOf(text) {
  const m = /^([A-Za-z][A-Za-z0-9]*)\s*\((.*)\)$/s.exec(text.trim());
  return m ? { name: m[1], args: splitArgs(m[2]) } : null;
}

/** `k=v` pairs out of a selector or filter argument list. */
function kvOf(args) {
  const out = {};
  for (const arg of args) {
    const m = /^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$/.exec(arg);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------
function parseExpr(text, cardId) {
  const src = text.trim();
  if (src === '') return null;

  // `K * (expr)`
  const mult = /^(-?\d+)\s*\*\s*\((.*)\)$/s.exec(src);
  if (mult) {
    const inner = parseExpr(mult[2], cardId);
    if (!inner) return null;
    return { type: 'multiply', terms: [{ type: 'constant', value: Number(mult[1]) }, inner] };
  }

  const call = callOf(src);
  if (!call) {
    fail(cardId, `cannot parse expression "${src}"`);
    return null;
  }
  const { name, args } = call;
  switch (name) {
    case 'constant': {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) {
        fail(cardId, `constant(${args[0]}) is not a number`);
        return null;
      }
      return { type: 'constant', value: n };
    }
    case 'counter': {
      if (!OWNERS.has(args[0])) {
        fail(cardId, `counter owner "${args[0]}"`);
        return null;
      }
      return { type: 'counter', owner: args[0], counter: args[1] };
    }
    case 'historyCount': {
      if (!OWNERS.has(args[0])) {
        fail(cardId, `historyCount owner "${args[0]}"`);
        return null;
      }
      const filter = { owner: args[0] };
      for (const [k, v] of Object.entries(kvOf(args.slice(1)))) {
        if (k === 'tribe') {
          if (!TRIBES.has(v)) {
            fail(cardId, `history tribe "${v}"`);
            return null;
          }
          filter.tribe = v;
        } else if (k === 'tag') {
          if (!TAGS.has(v)) {
            fail(cardId, `history tag "${v}"`);
            return null;
          }
          filter.tag = v;
        } else if (k === 'result') {
          if (!RESULTS.has(v)) {
            fail(cardId, `history result "${v}"`);
            return null;
          }
          filter.result = v;
        } else if (k === 'value') filter.value = Number(v);
        else if (k === 'cardId') filter.cardId = v;
        else {
          fail(cardId, `unknown history filter "${k}"`);
          return null;
        }
      }
      return { type: 'historyCount', filter };
    }
    case 'cardValue': {
      if (!REFS.has(args[0])) {
        fail(cardId, `cardValue ref "${args[0]}"`);
        return null;
      }
      if (args[1] !== 'base' && args[1] !== 'effective') {
        fail(cardId, `cardValue kind "${args[1]}"`);
        return null;
      }
      return { type: 'cardValue', card: args[0], value: args[1] };
    }
    case 'uniqueTribesPlayed': {
      if (!OWNERS.has(args[0])) {
        fail(cardId, `uniqueTribesPlayed owner "${args[0]}"`);
        return null;
      }
      return { type: 'uniqueTribesPlayed', owner: args[0] };
    }
    case 'zoneCount': {
      if (!OWNERS.has(args[0]) || !ZONES.has(args[1])) {
        fail(cardId, `zoneCount(${args})`);
        return null;
      }
      return { type: 'zoneCount', owner: args[0], zone: args[1] };
    }
    case 'roundNumber':
      return { type: 'roundNumber' };
    case 'score': {
      if (!OWNERS.has(args[0])) {
        fail(cardId, `score owner "${args[0]}"`);
        return null;
      }
      return { type: 'score', owner: args[0] };
    }
    case 'floor':
    case 'ceil': {
      // `floor(expr / N)` is the only divide form the catalog writes.
      const div = /^(.*)\/\s*(-?\d+)$/s.exec(args.join(', '));
      if (div) {
        const left = parseExpr(div[1], cardId);
        if (!left) return null;
        return {
          type: name,
          of: { type: 'divide', left, right: { type: 'constant', value: Number(div[2]) } },
        };
      }
      const of = parseExpr(args[0], cardId);
      return of ? { type: name, of } : null;
    }
    default:
      fail(cardId, `unknown expression "${name}"`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------
function parseCondition(text, cardId) {
  const src = text.trim();
  if (src === '') return null;
  const call = callOf(src);
  if (!call) {
    fail(cardId, `cannot parse condition "${src}"`);
    return null;
  }
  const { name, args } = call;
  const num = (raw) =>
    parseExpr(/^-?\d+$/.test(raw.trim()) ? `constant(${raw.trim()})` : raw, cardId);
  switch (name) {
    case 'hasTribe': {
      if (!REFS.has(args[0]) || !TRIBES.has(args[1])) {
        fail(cardId, `hasTribe(${args})`);
        return null;
      }
      return { type: 'hasTribe', card: args[0], tribe: args[1] };
    }
    case 'hasTag': {
      if (!REFS.has(args[0]) || !TAGS.has(args[1])) {
        fail(cardId, `hasTag(${args})`);
        return null;
      }
      return { type: 'hasTag', card: args[0], tag: args[1] };
    }
    case 'valueCompare': {
      if (!REFS.has(args[0]) || !OPS.has(args[2])) {
        fail(cardId, `valueCompare(${args})`);
        return null;
      }
      if (args[1] !== 'base' && args[1] !== 'effective') {
        fail(cardId, `valueCompare kind "${args[1]}"`);
        return null;
      }
      const amount = num(args[3]);
      return amount
        ? { type: 'valueCompare', card: args[0], value: args[1], op: args[2], amount }
        : null;
    }
    case 'previousResult': {
      if (!OWNERS.has(args[0]) || !RESULTS.has(args[1])) {
        fail(cardId, `previousResult(${args})`);
        return null;
      }
      return { type: 'previousResult', owner: args[0], result: args[1] };
    }
    case 'scoreCompare': {
      if (!OPS.has(args[0])) {
        fail(cardId, `scoreCompare op "${args[0]}"`);
        return null;
      }
      // No amount means "against the opponent's score", which is the shape the
      // comeback cards want; the workbook spells that "opponent score".
      if (args[1] === undefined || args[1] === 'opponent score')
        return { type: 'scoreCompare', op: args[0] };
      const amount = num(args[1]);
      return amount ? { type: 'scoreCompare', op: args[0], amount } : null;
    }
    case 'roundCompare': {
      if (!OPS.has(args[0])) {
        fail(cardId, `roundCompare op "${args[0]}"`);
        return null;
      }
      const amount = num(args[1]);
      return amount ? { type: 'roundCompare', op: args[0], amount } : null;
    }
    case 'counterCompare': {
      if (!OWNERS.has(args[0]) || !OPS.has(args[2])) {
        fail(cardId, `counterCompare(${args})`);
        return null;
      }
      const amount = num(args[3]);
      return amount
        ? { type: 'counterCompare', owner: args[0], counter: args[1], op: args[2], amount }
        : null;
    }
    case 'consecutive': {
      if (!OWNERS.has(args[0]) || !RESULTS.has(args[1]) || !OPS.has(args[2])) {
        fail(cardId, `consecutive(${args})`);
        return null;
      }
      const amount = num(args[3]);
      return amount
        ? { type: 'consecutive', owner: args[0], result: args[1], op: args[2], amount }
        : null;
    }
    case 'uniqueTribesCompare': {
      if (!OWNERS.has(args[0]) || !OPS.has(args[1])) {
        fail(cardId, `uniqueTribesCompare(${args})`);
        return null;
      }
      const amount = num(args[2]);
      return amount ? { type: 'uniqueTribesCompare', owner: args[0], op: args[1], amount } : null;
    }
    default:
      fail(cardId, `unknown condition "${name}"`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------
function parseMatchFilter(kv, cardId) {
  const out = {};
  for (const [k, v] of Object.entries(kv)) {
    if (k === 'count') continue;
    if (k === 'tribe') {
      if (!TRIBES.has(v)) {
        fail(cardId, `filter tribe "${v}"`);
        return null;
      }
      out.tribe = v;
    } else if (k === 'tag') {
      if (!TAGS.has(v)) {
        fail(cardId, `filter tag "${v}"`);
        return null;
      }
      out.tag = v;
    } else if (k === 'value' || k === 'minValue' || k === 'maxValue') out[k] = Number(v);
    else if (k === 'cardId') out.cardId = v;
    else {
      fail(cardId, `unknown match filter "${k}"`);
      return null;
    }
  }
  return out;
}

function parseTarget(text, cardId) {
  const src = text.trim();
  if (src === '' || src === 'thisCard') return { type: 'thisCard' };
  if (src === 'myCard') return { type: 'myCard' };
  if (src === 'opponentCard') return { type: 'opponentCard' };
  const call = callOf(src);
  if (!call) {
    fail(cardId, `cannot parse target "${src}"`);
    return null;
  }
  const { name, args } = call;
  if (name === 'player') {
    if (!OWNERS.has(args[0])) {
      fail(cardId, `player owner "${args[0]}"`);
      return null;
    }
    return { type: 'player', owner: args[0] };
  }
  if (name === 'nextCard') {
    if (!OWNERS.has(args[0])) {
      fail(cardId, `nextCard owner "${args[0]}"`);
      return null;
    }
    const match = parseMatchFilter(kvOf(args.slice(1)), cardId);
    if (match === null) return null;
    return Object.keys(match).length > 0
      ? { type: 'nextCard', owner: args[0], match }
      : { type: 'nextCard', owner: args[0] };
  }
  if (name === 'zone') {
    const [owner, zone, select] = args;
    if (!OWNERS.has(owner) || !ZONES.has(zone) || !SELECTS.has(select)) {
      fail(cardId, `zone(${args})`);
      return null;
    }
    const kv = kvOf(args.slice(3));
    const match = parseMatchFilter(kv, cardId);
    if (match === null) return null;
    const out = { type: 'zone', owner, zone, select };
    if (kv.count !== undefined) out.count = Number(kv.count);
    if (Object.keys(match).length > 0) out.match = match;
    return out;
  }
  fail(cardId, `unknown target "${name}"`);
  return null;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
function parseEffectDefinition(prim, amountCell, cardId) {
  if (BARE_PRIMS.has(prim)) {
    if (prim === 'shuffleDiscardIntoDeck') return { type: prim, owner: 'self' };
    return { type: prim };
  }
  if (TRIBE_PRIMS.has(prim)) {
    const tribe = amountCell.trim();
    if (!TRIBES.has(tribe)) {
      fail(cardId, `${prim} names "${tribe}", not a tribe`);
      return null;
    }
    return { type: prim, tribe };
  }
  if (COUNTER_PRIMS.has(prim)) {
    const m = /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(.+)$/s.exec(amountCell.trim());
    if (!m) {
      fail(cardId, `${prim} amount "${amountCell}" is not "Counter: expression"`);
      return null;
    }
    const amount = parseExpr(m[2], cardId);
    return amount ? { type: prim, counter: m[1], amount } : null;
  }
  if (NUMERIC_PRIMS.has(prim)) {
    const amount = parseExpr(amountCell, cardId);
    return amount ? { type: prim, amount } : null;
  }
  fail(cardId, `unknown primitive "${prim}"`);
  return null;
}

function parseLimits(cell, cardId) {
  const src = cell.trim();
  if (src === '') return null;
  const out = {};
  for (const part of src.split(/\s*;\s*/)) {
    if (part === 'oncePerRound') out.oncePerRound = true;
    else if (part === 'oncePerMatch') out.oncePerMatch = true;
    else {
      const m = /^(maxTriggers|cooldownRounds)=(\d+)$/.exec(part);
      if (!m) {
        fail(cardId, `unknown trigger limit "${part}"`);
        return null;
      }
      out[m[1]] = Number(m[2]);
    }
  }
  return out;
}

function parseTextValues(cell, cardId) {
  const src = cell.trim();
  if (src === '') return null;
  const out = {};
  for (const part of src.split(/\s*;\s*/)) {
    const m = /^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$/s.exec(part);
    if (!m) {
      fail(cardId, `cannot parse text value "${part}"`);
      return null;
    }
    const expr = parseExpr(m[2], cardId);
    if (!expr) return null;
    out[m[1]] = expr;
  }
  return out;
}

function parseEffect(row, index, cardId) {
  const p = (suffix) => row[`e${index}_${suffix}`] ?? '';
  const trigger = p('trigger');
  if (trigger === '') return null;
  if (!TRIGGERS.has(trigger)) {
    fail(cardId, `unknown trigger "${trigger}"`);
    return null;
  }
  const duration = p('duration');
  if (!DURATIONS.has(duration)) {
    fail(cardId, `unknown duration "${duration}"`);
    return null;
  }
  const stackMode = p('stack');
  if (!STACK_MODES.has(stackMode)) {
    fail(cardId, `unknown stack mode "${stackMode}"`);
    return null;
  }
  const effect = parseEffectDefinition(p('primitive'), p('amount'), cardId);
  const target = parseTarget(p('target'), cardId);
  const conditions = p('conditions') === '' ? null : parseCondition(p('conditions'), cardId);
  const limits = parseLimits(p('limits'), cardId);
  const textValues = parseTextValues(p('text_values'), cardId);
  if (!effect || !target) return null;
  return { trigger, conditions, target, effect, duration, stackMode, limits, textValues };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const list = (items) => `[${items.map(q).join(', ')}]`;

function emitExpr(expr) {
  switch (expr.type) {
    case 'constant':
      return `constant(${expr.value})`;
    case 'counter':
      return `{ type: 'counter', owner: ${q(expr.owner)}, counter: ${q(expr.counter)} }`;
    case 'historyCount':
      return `{ type: 'historyCount', filter: ${emitObject(expr.filter)} }`;
    case 'cardValue':
      return `{ type: 'cardValue', card: ${q(expr.card)}, value: ${q(expr.value)} }`;
    case 'uniqueTribesPlayed':
      return `{ type: 'uniqueTribesPlayed', owner: ${q(expr.owner)} }`;
    case 'zoneCount':
      return `{ type: 'zoneCount', owner: ${q(expr.owner)}, zone: ${q(expr.zone)} }`;
    case 'roundNumber':
      return `{ type: 'roundNumber' }`;
    case 'score':
      return `{ type: 'score', owner: ${q(expr.owner)} }`;
    case 'multiply':
      return `{ type: 'multiply', terms: [${expr.terms.map(emitExpr).join(', ')}] }`;
    case 'divide':
      return `{ type: 'divide', left: ${emitExpr(expr.left)}, right: ${emitExpr(expr.right)} }`;
    case 'floor':
    case 'ceil':
      return `{ type: ${q(expr.type)}, of: ${emitExpr(expr.of)} }`;
    default:
      throw new Error(`no emitter for expression ${expr.type}`);
  }
}

/** Emits a plain data object, routing any nested expression through emitExpr. */
function emitObject(obj) {
  const parts = Object.entries(obj).map(([k, v]) => {
    if (v && typeof v === 'object' && 'type' in v && typeof v.type === 'string') {
      return `${k}: ${emitExpr(v)}`;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return `${k}: ${v}`;
    return `${k}: ${q(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function emitCondition(node) {
  const parts = Object.entries(node).map(([k, v]) => {
    if (k === 'amount') return `amount: ${emitExpr(v)}`;
    return `${k}: ${q(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function emitEffectDefinition(effect) {
  const parts = Object.entries(effect).map(([k, v]) =>
    k === 'amount' ? `amount: ${emitExpr(v)}` : `${k}: ${q(v)}`,
  );
  return `{ ${parts.join(', ')} }`;
}

function emitTarget(target) {
  const parts = Object.entries(target).map(([k, v]) => {
    if (k === 'match') return `match: ${emitObject(v)}`;
    if (typeof v === 'number') return `${k}: ${v}`;
    return `${k}: ${q(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function emitEffect(effect) {
  const lines = [`        trigger: ${q(effect.trigger)},`];
  if (effect.conditions) lines.push(`        conditions: ${emitCondition(effect.conditions)},`);
  if (effect.target.type !== 'thisCard')
    lines.push(`        target: ${emitTarget(effect.target)},`);
  lines.push(`        effect: ${emitEffectDefinition(effect.effect)},`);
  lines.push(`        duration: ${q(effect.duration)},`);
  if (effect.stackMode !== 'stack') lines.push(`        stackMode: ${q(effect.stackMode)},`);
  if (effect.limits) lines.push(`        limits: ${emitObject(effect.limits)},`);
  if (effect.textValues) {
    const inner = Object.keys(effect.textValues)
      .sort()
      .map((name) => `${name}: ${emitExpr(effect.textValues[name])}`)
      .join(', ');
    lines.push(`        textValues: { ${inner} },`);
  }
  return `      {\n${lines.join('\n')}\n      },`;
}

function emitCard(card) {
  return [
    '  card({',
    `    id: ${q(card.id)},`,
    `    nameId: ${q(card.id)},`,
    `    textId: ${q(card.id)},`,
    `    art: ${q(card.id)},`,
    `    set: ${q(card.set)},`,
    `    value: ${card.value},`,
    `    tribes: ${list(card.tribes)},`,
    `    tags: ${list(card.tags)},`,
    `    rarity: ${q(card.rarity)},`,
    '    effects: [',
    ...card.effects.map(emitEffect),
    '    ],',
    '  }),',
  ].join('\n');
}

const CONST_NAME = (setSlug) => `${setSlug.toUpperCase()}_CARDS`;

function emitModule(setSlug, identity, cards) {
  const header = [
    `// ${identity.title}: ${identity.core}`,
    '//',
    '// Data-as-code. Every card here is a declarative record over the sanctioned',
    '// primitives in src/sim/minigames/card_duel/types.ts; nothing in this file is',
    '// engine logic and no card needs any. One module per design identity, each a',
    `// complete value 1 to 10 run, is what makes ${identity.title} readable as a`,
    '// deck rather than as thirty scattered rows.',
    '//',
    '// `nameId` / `textId` are i18n KEY ids, never English: the English lives in',
    '// src/ui/i18n.catalog/cards.ts. `art` is an art id, not a path, and falls back',
    '// to the procedural card face until a painting is committed.',
    '',
    "import type { CardDefinition } from '../../../minigames/card_duel/types';",
    "import { card, constant } from '../card_authoring';",
    '',
    `export const ${CONST_NAME(setSlug)}: readonly CardDefinition[] = [`,
  ].join('\n');
  return `${header}\n${cards.map(emitCard).join('\n')}\n];\n`;
}

// ---------------------------------------------------------------------------
// Identity blurbs: the workbook's own Core Identity column, so a module header
// says what the set is FOR rather than repeating its card list.
// ---------------------------------------------------------------------------
const IDENTITIES = {
  briarpack: {
    title: 'Briarpack',
    core: 'build Pack, then convert Pack into value. Low cards establish the engine, high cards cash it in.',
  },
  gravebound_court: {
    title: 'Gravebound Court',
    core: 'treat losses and the discard as resources, recovering small Undead again and again.',
  },
  sableweb_brood: {
    title: 'Sableweb Brood',
    core: 'accumulate Web and reward patient sequencing, with a few Human-hunting payoffs.',
  },
  ashen_flight: {
    title: 'Ashen Flight',
    core: 'place Dread on the opponent, then use that pressure to amplify later Dragons.',
  },
  eastbrook_company: {
    title: 'Eastbrook Company',
    core: 'Human handlers prepare the next Beast, encouraging mixed Human and Beast decks.',
  },
  ironward_assembly: {
    title: 'Ironward Assembly',
    core: 'control floors, ceilings, ties, and abilities instead of relying on additive bonuses.',
  },
  mirefen_tide: {
    title: 'Mirefen Tide',
    core: 'reveal hands, disrupt choices, and profit from knowing what the opponent can commit.',
  },
  tunnel_crown: {
    title: 'Tunnel Crown',
    core: 'reward uninterrupted Burrower sequencing and establish sturdy value floors.',
  },
  stormheart_conclave: {
    title: 'Stormheart Conclave',
    core: 'punish predictable high values with threshold-based boosts and reductions.',
  },
  roadknife_guild: {
    title: 'Roadknife Guild',
    core: 'trade raw value for hand disruption, selective reveals, and opportunistic draws.',
  },
  mirrorveil_chorus: {
    title: 'Mirrorveil Chorus',
    core: 'copy, exchange, and invert values. Individual cards are unusual rather than linear.',
  },
  emberwatch_compact: {
    title: 'Emberwatch Compact',
    core: 'comeback cards that improve while behind without forming an automatic all-purpose package.',
  },
  cryptfire_covenant: {
    title: 'Cryptfire Covenant',
    core: 'a second Dread package with riskier losses, Undead links, and match-long pressure.',
  },
  tableborn_circle: {
    title: 'Tableborn Circle',
    core: 'reward card counting, round awareness, and deliberate streak management.',
  },
  greenwake_circle: {
    title: 'Greenwake Circle',
    core: 'reward varied tribes and a broad history rather than one narrow tribal line.',
  },
  boneflame_host: {
    title: 'Boneflame Host',
    core: 'recycle cheap threats, with stronger cards paying for recursion through drawbacks.',
  },
  fenward_hunters: {
    title: 'Fenward Hunters',
    core: 'flexible hunters that punish Spider cards and high commitments in the Mirefen matchup.',
  },
  relicguard_order: {
    title: 'Relicguard Order',
    core: 'defensive relic keepers using silence, caps, and tie control with minimal stacking.',
  },
  questbound_caravan: {
    title: 'Questbound Caravan',
    core: 'general-purpose utility centered on draws, recovery, and losing gracefully.',
  },
  crownless_legends: {
    title: 'Crownless Legends',
    core: 'a loose legendary line with one-off history mechanics rather than one tribal engine.',
  },
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const rows = parseCsv(readFileSync(CSV, 'utf8'));
const bySet = new Map();
const names = [];
const texts = [];

for (const row of rows) {
  const cardId = row.id;
  if (!RARITIES.has(row.rarity)) fail(cardId, `unknown rarity "${row.rarity}"`);
  const value = Number(row.value);
  if (!Number.isInteger(value) || value < 1 || value > 10) fail(cardId, `bad value "${row.value}"`);
  const tribes = row.tribes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = row.tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const t of tribes) if (!TRIBES.has(t)) fail(cardId, `unknown tribe "${t}"`);
  for (const t of tags) if (!TAGS.has(t)) fail(cardId, `unknown tag "${t}"`);
  if (!IDENTITIES[row.set]) fail(cardId, `unknown design identity "${row.set}"`);

  const effects = [1, 2].map((i) => parseEffect(row, i, cardId)).filter(Boolean);
  if (effects.length === 0) fail(cardId, 'no effects');

  const card = { id: cardId, set: row.set, value, tribes, tags, rarity: row.rarity, effects };
  if (!bySet.has(row.set)) bySet.set(row.set, []);
  bySet.get(row.set).push(card);
  names.push([cardId, row.name]);
  texts.push([cardId, row.rules_text]);
}

if (failures > 0) {
  console.error(`\n${failures} row(s) could not be mapped to the rules grammar. Nothing written.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const setSlugs = [...bySet.keys()].sort();
for (const slug of setSlugs) {
  const cards = bySet.get(slug).sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : 1));
  writeFileSync(join(OUT_DIR, `${slug}.ts`), emitModule(slug, IDENTITIES[slug], cards), 'utf8');
}

const barrel = [
  '// The card sets barrel: every design identity, concatenated in one fixed order.',
  '//',
  '// Order here is presentational only. The catalog barrel',
  '// (src/sim/content/cards/index.ts) re-sorts by card id, so no consumer can come',
  '// to depend on the order this file happens to list the identities in.',
  '',
  "import type { CardDefinition } from '../../../minigames/card_duel/types';",
  ...setSlugs.map((s) => `import { ${CONST_NAME(s)} } from './${s}';`),
  '',
  '/** Every authored card, identity by identity. */',
  'export const ALL_SET_CARDS: readonly CardDefinition[] = [',
  ...setSlugs.map((s) => `  ...${CONST_NAME(s)},`),
  '];',
  '',
  ...setSlugs.map((s) => `export { ${CONST_NAME(s)} } from './${s}';`),
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'index.ts'), barrel, 'utf8');

const i18nBlock = [
  '  name: {',
  ...names.map(([id, n]) => `    ${id}: ${q(n)},`),
  '  },',
  '',
  '  text: {',
  ...texts.map(([id, t]) => `    ${id}: ${q(t)},`),
  '  },',
  '',
].join('\n');
writeFileSync(I18N_OUT, i18nBlock, 'utf8');

console.log(`imported ${rows.length} cards into ${setSlugs.length} identity modules`);
console.log(`English name/text block written to ${I18N_OUT}`);
