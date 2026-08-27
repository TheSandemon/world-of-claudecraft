import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, CARDS, DEFAULT_DECK_LIST } from '../src/sim/content/cards';
import { validateDeck } from '../src/sim/minigames/card_duel';
import { CARD_SETS } from '../src/sim/minigames/card_duel/types';
import {
  buildDeckBuilderView,
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

  it("each row's pool holds only cards of that value", () => {
    for (const row of view([]).rows) {
      expect(row.options.length).toBeGreaterThan(0);
      for (const option of row.options) expect(option.def.value).toBe(row.value);
    }
  });

  it('marks the cards already in the draft as taken', () => {
    const model = view(defaultIds);
    for (const row of model.rows) {
      expect(row.complete).toBe(true);
      expect(row.slots.filter(Boolean).length).toBe(2);
      const chosen = row.options.filter((option) => option.chosen).map((option) => option.cardId);
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

  it('the signature moves when the draft, the name, or the saved list changes', () => {
    const base = deckBuilderSignature(view(defaultIds));
    expect(deckBuilderSignature(view(defaultIds))).toBe(base);
    expect(deckBuilderSignature(view(defaultIds.slice(0, 19)))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { draftName: 'Other' }))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { savedNames: ['A'] }))).not.toBe(base);
    expect(deckBuilderSignature(view(defaultIds, { activeName: 'A' }))).not.toBe(base);
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

  it('narrows every row to one identity, which is why it is worth having', () => {
    const model = view([], { setFilter: 'briarpack' });
    expect(model.setFilter).toBe('briarpack');
    const offered = model.rows.flatMap((row) => row.options);
    expect(offered.length).toBeGreaterThan(0);
    for (const option of offered) expect(option.def.set).toBe('briarpack');
    // One card per value, because an identity is a complete value 1 to 10 run.
    for (const row of model.rows) expect(row.options.length).toBe(1);
  });

  it('keeps a chosen card visible under a filter that excludes it', () => {
    // Hiding it would leave a filled slot the player has no way to clear.
    const chosen = CARDS.find((def) => def.set === 'briarpack' && def.value === 3);
    expect(chosen).toBeDefined();
    const model = view([chosen!.id], { setFilter: 'mirefen_tide' });
    const row = model.rows.find((r) => r.value === 3);
    expect(row?.slots).toContain(chosen!.id);
    expect(row?.options.some((o) => o.cardId === chosen!.id && o.chosen)).toBe(true);
  });

  it('treats an identity the pool does not hold as no filter at all', () => {
    // Otherwise a stale filter would silently empty every row.
    const model = view([], { setFilter: 'basics' });
    expect(model.setFilter).toBeNull();
    expect(model.rows[0].options.length).toBe(view([]).rows[0].options.length);
  });

  it('puts the filter in the repaint signature, or switching would show nothing', () => {
    expect(deckBuilderSignature(view([], { setFilter: 'briarpack' }))).not.toBe(
      deckBuilderSignature(view([], { setFilter: 'mirefen_tide' })),
    );
  });
});
