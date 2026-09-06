import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import { validateDeck } from '../src/sim/minigames/card_duel';
import { CARD_SETS } from '../src/sim/minigames/card_duel/types';
import {
  buildDeckBuilderView,
  deckBuilderDeckSignature,
  deckBuilderPoolSignature,
  deckBuilderShellSignature,
  deckBuilderSignature,
  draftCardIds,
  toggleDraftCard,
} from '../src/ui/deck_builder_view';

const defaultIds = DEFAULT_DECK_LIST.map((entry) => entry.cardId);

function view(
  draft: readonly string[],
  over: Partial<Parameters<typeof buildDeckBuilderView>[0]> = {},
) {
  return buildDeckBuilderView({
    draft,
    catalog: CARD_CATALOG,
    cards: CARDS,
    savedNames: [],
    activeName: '',
    draftName: 'Wolves',
    ...over,
  });
}

describe('deck builder view', () => {
  it('lays the rule out as ten rows of two slots, so the layout explains it', () => {
    const model = view([]);
    expect(model.rows.length).toBe(10);
    expect(model.rows.map((row) => row.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const row of model.rows) {
      expect(row.slots.length).toBe(2);
      expect(row.slots).toEqual([null, null]);
      expect(row.complete).toBe(false);
    }
    expect(model.filled).toBe(0);
    expect(model.required).toBe(20);
    expect(model.legal).toBe(false);
  });

  it('offers ONE value at a time, and only cards of that value', () => {
    // The window used to hand every row its own pool, so it listed all two
    // hundred cards in the game on one page: a wall to scroll past in order to
    // fill twenty slots. A player fills one value at a time.
    for (const value of [1, 5, 10] as const) {
      const model = view([], { focusValue: value });
      expect(model.focusValue).toBe(value);
      expect(model.pool.length).toBeGreaterThan(0);
      for (const option of model.pool) expect(option.def.value).toBe(value);
    }
    // Teeth: the pool is a slice of the catalog, never the whole of it.
    expect(view([]).pool.length).toBeLessThan(CARDS.length / 4);
  });

  it('opens on the first value still missing a card, so it lands on the work', () => {
    // Values one and two filled: the pool should open on three, not on one.
    const firstTwo = defaultIds.filter((id) => {
      const value = CARD_CATALOG.get(id)?.value;
      return value === 1 || value === 2;
    });
    expect(view(firstTwo).focusValue).toBe(3);
    // A finished deck has no gap, so it falls back to the first value rather
    // than to nothing.
    expect(view(defaultIds).focusValue).toBe(1);
    // And an explicit choice always wins: a focus that re-derived itself would
    // jump away the moment the player filled the value they were looking at.
    expect(view(firstTwo, { focusValue: 9 }).focusValue).toBe(9);
  });

  it('marks the cards already in the draft as taken', () => {
    const model = view(defaultIds);
    for (const row of model.rows) {
      expect(row.complete).toBe(true);
      expect(row.slots.filter(Boolean).length).toBe(2);
      const pool = view(defaultIds, { focusValue: row.value }).pool;
      const chosen = pool.filter((option) => option.chosen).map((option) => option.cardId);
      expect(chosen.sort()).toEqual([...row.slots].filter(Boolean).sort());
    }
    expect(model.legal).toBe(true);
    expect(model.filled).toBe(20);
  });

  it('a full draft is exactly what the server would accept', () => {
    const ids = draftCardIds(view(defaultIds));
    const entries = ids.map((id) => ({ cardId: id, value: CARD_CATALOG.get(id)?.value ?? 1 }));
    expect(validateDeck(entries as never, CARD_CATALOG)).toEqual({ ok: true });
  });

  it('toggling adds a card and removes it again', () => {
    const first = CARDS[0].id;
    const added = toggleDraftCard([], first, CARD_CATALOG);
    expect(added).toEqual([first]);
    expect(toggleDraftCard(added, first, CARD_CATALOG)).toEqual([]);
  });

  it('a full row simply refuses a third card, so the rule enforces itself', () => {
    const threes = CARDS.filter((def) => def.value === 3);
    expect(threes.length).toBeGreaterThanOrEqual(3);
    let draft: string[] = [];
    draft = toggleDraftCard(draft, threes[0].id, CARD_CATALOG);
    draft = toggleDraftCard(draft, threes[1].id, CARD_CATALOG);
    const refused = toggleDraftCard(draft, threes[2].id, CARD_CATALOG);
    expect(refused).toEqual(draft);
    // And the player is never left holding an unsaveable deck as a result.
    expect(view(refused).rows.find((row) => row.value === 3)?.complete).toBe(true);
  });

  it('never mutates the draft it was handed', () => {
    const draft = [CARDS[0].id];
    const frozen = [...draft];
    toggleDraftCard(draft, CARDS[1].id, CARD_CATALOG);
    toggleDraftCard(draft, CARDS[0].id, CARD_CATALOG);
    expect(draft).toEqual(frozen);
  });

  it('ignores a draft entry the catalog no longer knows', () => {
    const model = view(['a_card_that_was_retired', ...defaultIds.slice(0, 2)]);
    expect(model.filled).toBe(2);
    expect(draftCardIds(model)).not.toContain('a_card_that_was_retired');
  });

  it('keeps only the first two copies when a corrupt draft over-fills a value', () => {
    const threes = CARDS.filter((def) => def.value === 3).map((def) => def.id);
    const model = view(threes);
    const row = model.rows.find((r) => r.value === 3);
    expect(row?.slots).toEqual([threes[0], threes[1]]);
  });

  it('the signature moves when the draft or the saved list changes', () => {
    const base = deckBuilderSignature(view(defaultIds));
    expect(deckBuilderSignature(view(defaultIds))).toBe(base);
    expect(deckBuilderSignature(view(defaultIds.slice(0, 19)))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { savedNames: ['A'] }))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { activeName: 'A' }))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { setFilter: 'briarpack' }))).not.toBe(base);
  });

  it('the DRAFT NAME deliberately moves nothing: it is what the player is typing', () => {
    // Not an omission. The name field is the thing being typed into, so a
    // signature that moved with it rebuilt the window because the player
    // typed, destroying the field and the caret with it. The input already
    // shows what was typed; repainting it can only take it away. Loading a
    // saved deck still repaints it, through `activeName` above.
    const base = deckBuilderSignature(view(defaultIds));
    expect(deckBuilderSignature(view(defaultIds, { draftName: 'Other' }))).toBe(base);
    expect(deckBuilderShellSignature(view(defaultIds, { draftName: 'Other' }))).toBe(
      deckBuilderShellSignature(view(defaultIds)),
    );
  });

  it('holds the SHELL still for a toggle, so a click cannot rebuild the window', () => {
    // A shell change is the only one that costs a full rebuild, so nothing
    // that moves while a player is working may reach it. The progress count
    // and the Save button track `filled`, and the window writes those in
    // place rather than repainting to show them.
    const empty = view([]);
    const withCard = view([defaultIds[4]]);
    expect(deckBuilderShellSignature(withCard)).toBe(deckBuilderShellSignature(empty));
    expect(withCard.filled).not.toBe(empty.filled);
    // The two regions DO move: the column shows the new slot, and the pool
    // shows that card as taken.
    const focus = CARD_CATALOG.get(defaultIds[4])?.value;
    const before = view([], { focusValue: focus });
    const after = view([defaultIds[4]], { focusValue: focus });
    expect(deckBuilderDeckSignature(after)).not.toBe(deckBuilderDeckSignature(before));
    expect(deckBuilderPoolSignature(after)).not.toBe(deckBuilderPoolSignature(before));
  });

  it('the POOL signature notices a card being TAKEN, not just the slots filling', () => {
    // Teeth: the pressed state of an option is what tells a player their click
    // landed, and two different drafts can leave a value's slots looking the
    // same, so the chosen flags belong in the pool signature.
    const model = view([]);
    const taken = { ...model, pool: model.pool.map((o, i) => ({ ...o, chosen: i === 0 })) };
    expect(deckBuilderPoolSignature(taken)).not.toBe(deckBuilderPoolSignature(model));
  });

  it('the DECK signature notices the value being worked on, since the column shows it', () => {
    // The column doubles as the navigator, so the selected row has to look
    // selected; that is a repaint of the column, not of the pool alone.
    const a = view([], { focusValue: 2 });
    const b = view([], { focusValue: 7 });
    expect(deckBuilderDeckSignature(a)).not.toBe(deckBuilderDeckSignature(b));
  });
});

describe('deck builder design-identity filter', () => {
  it('offers every identity in the pool, derived rather than declared', () => {
    const model = view([]);
    expect(model.sets.length).toBe(CARD_SETS.length);
    for (const set of CARD_SETS) expect(model.sets).toContain(set);
    // No filter by default: the whole catalog is on offer.
    expect(model.setFilter).toBeNull();
  });

  it('narrows the pool to one identity, which is why it is worth having', () => {
    const model = view([], { setFilter: 'briarpack' });
    expect(model.setFilter).toBe('briarpack');
    expect(model.pool.length).toBeGreaterThan(0);
    for (const option of model.pool) expect(option.def.set).toBe('briarpack');
    // One card per value, because an identity is a complete value 1 to 10 run.
    for (const value of [1, 4, 10] as const) {
      expect(view([], { setFilter: 'briarpack', focusValue: value }).pool.length).toBe(1);
    }
  });

  it('keeps a chosen card visible under a filter that excludes it', () => {
    // Hiding it would leave a filled slot the player has no way to clear.
    const chosen = CARDS.find((def) => def.set === 'briarpack' && def.value === 3);
    expect(chosen).toBeDefined();
    const model = view([chosen!.id], { setFilter: 'mirefen_tide', focusValue: 3 });
    const row = model.rows.find((r) => r.value === 3);
    expect(row?.slots).toContain(chosen!.id);
    expect(model.pool.some((o) => o.cardId === chosen!.id && o.chosen)).toBe(true);
  });

  it('treats an identity the pool does not hold as no filter at all', () => {
    // Otherwise a stale filter would silently empty every row.
    const model = view([], { setFilter: 'basics' });
    expect(model.setFilter).toBeNull();
    expect(model.pool.length).toBe(view([]).pool.length);
  });

  it('puts the filter in the repaint signature, or switching would show nothing', () => {
    expect(deckBuilderSignature(view([], { setFilter: 'briarpack' }))).not.toBe(
      deckBuilderSignature(view([], { setFilter: 'mirefen_tide' })),
    );
  });
});
