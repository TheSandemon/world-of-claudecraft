// The default card art: the scene core and the SVG it draws.
//
// What this suite is actually defending is that NO CARD RENDERS BLANK. The
// fallback used to be a flat gradient keyed on tribe, and only five of the
// twelve tribes had one, so with no painting commissioned for any card the
// whole two-hundred-card catalog rendered as about six coloured rectangles.
// The scene replaces it, which means the scene is now what every card in the
// game looks like: totality and determinism are the load-bearing properties,
// not the specific shapes.

import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/sim/content/cards';
import { CARD_SETS, CARD_TRIBES } from '../src/sim/minigames/card_duel/types';
import { cardSceneSvg } from '../src/ui/cards/card_scene_markup';
import {
  buildCardScene,
  type CardSceneModel,
  sceneMotifKinds,
} from '../src/ui/cards/card_scene_view';

const scene = (key: string, over: Partial<Parameters<typeof buildCardScene>[0]> = {}) =>
  buildCardScene({ key, ...over });

describe('card scene core', () => {
  it('is a pure function of its input: the same card is the same picture', () => {
    // The property a player depends on without ever thinking about it. A card
    // they are learning to recognise must look identical in the next hand, the
    // next session and on the next machine, so the scene is derived from a hash
    // of the key and nothing else: no wall clock, no Math.random, no counter.
    const a = buildCardScene({ key: 'ashen_flight_dragons_spark', tribes: ['Dragon'] });
    const b = buildCardScene({ key: 'ashen_flight_dragons_spark', tribes: ['Dragon'] });
    expect(a).toEqual(b);
    expect(cardSceneSvg(a, 'x')).toBe(cardSceneSvg(b, 'x'));
  });

  it('draws a different picture for a different card', () => {
    // Teeth on the determinism test above: a constant would satisfy it too.
    const a = scene('ashen_flight_dragons_spark');
    const b = scene('ashen_flight_dragons_smoke_break');
    expect(a.seed).not.toBe(b.seed);
    expect(cardSceneSvg(a, 'a')).not.toBe(cardSceneSvg(b, 'b'));
  });

  it('gives EVERY card in the catalog a drawable scene', () => {
    // The whole point. Every one of these renders through this core today.
    expect(CARDS.length).toBeGreaterThan(100);
    // The seed doubles as the SVG id namespace, so a collision between two
    // DIFFERENT art ids would make two cards share a gradient and paint one in
    // the other's sky.
    const seeds = new Map<number, string[]>();
    for (const def of CARDS) {
      const model = buildCardScene({
        key: def.art,
        tribes: def.tribes,
        tags: def.tags,
        set: def.set,
        rarity: def.rarity,
      });
      expect(model.palette.skyTop, def.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(model.horizon.length, def.id).toBeGreaterThan(0);
      seeds.set(model.seed, [...(seeds.get(model.seed) ?? []), def.art]);
      const svg = cardSceneSvg(model, model.seed.toString(36));
      expect(svg.startsWith('<svg'), def.id).toBe(true);
      expect(svg.endsWith('</svg>'), def.id).toBe(true);
      // No unresolved value ever reaches the markup: `undefined` in a path or
      // a transform is the failure mode that renders an EMPTY panel, which is
      // exactly the state this whole module exists to make impossible, and it
      // does not throw on the way there.
      expect(svg, def.id).not.toContain('undefined');
      expect(svg, def.id).not.toContain('NaN');
    }
    for (const [seed, arts] of seeds) {
      expect(new Set(arts).size, `seed ${seed} collides across ${arts.join(', ')}`).toBe(1);
    }
  });

  it('has a palette and a horizon vocabulary for every set and every tribe', () => {
    // Completeness against the CONTENT's own lists rather than a copy of them,
    // so a new design identity or a new tribe fails here instead of shipping a
    // set of cards that all render in the fallback hall.
    for (const set of [...CARD_SETS, 'basics' as const]) {
      const model = scene('probe', { set });
      expect(model.palette.ground, set).toMatch(/^#[0-9a-f]{6}$/);
      expect(model.horizon.length, set).toBeGreaterThan(0);
    }
    for (const tribe of CARD_TRIBES) {
      expect(scene('probe', { tribes: [tribe] }).subject, tribe).not.toBe('none');
    }
  });

  it("reads the motifs off the card's own words", () => {
    // The part that makes the art about the CARD rather than its category: the
    // ids are authored English compounds, so the words in them are the closest
    // thing the content has to a description of the scene.
    expect(sceneMotifKinds('boneflame_host_pyre_night')).toEqual(['flame', 'moon']);
    expect(sceneMotifKinds('sableweb_brood_silk_road')).toEqual(['web']);
    expect(sceneMotifKinds('stormheart_conclave_thunder_vote')).toEqual(['bolt', 'scroll']);
    // An unknown word contributes nothing rather than failing.
    expect(sceneMotifKinds('nonsense_gibberish_zzz')).toEqual([]);
  });

  it('caps the motifs and never repeats a kind', () => {
    // A small panel stops reading as a picture and starts reading as a pile of
    // stickers; and a card whose id says fire three ways gets one flame.
    expect(sceneMotifKinds('fire_flame_ember_pyre_ash_smoke')).toEqual(['flame']);
    expect(sceneMotifKinds('fire_moon_storm_crown_web_bone').length).toBe(3);
  });

  it('still draws a place for a card with no tribe, set or recognisable words', () => {
    // The retired-id case (a saved deck naming a card the catalog dropped) and
    // the unauthored basics. "No art" must never be a state that reaches a
    // player as an empty rectangle.
    const model = scene('9');
    expect(model.subject).toBe('none');
    expect(model.setting).toBe('hall');
    const svg = cardSceneSvg(model, '9');
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('undefined');
  });

  it('namespaces its gradient ids per card', () => {
    // SVG ids are DOCUMENT-global and a hand holds five faces at once, so a
    // shared id silently paints every card on screen in the first one's sky.
    const model = scene('ashen_flight_dragons_spark', { tribes: ['Dragon'] });
    const a = cardSceneSvg(model, 'alpha');
    const b = cardSceneSvg(model, 'beta');
    expect(a).toContain('cs-glow-alpha');
    expect(b).toContain('cs-glow-beta');
    expect(a).not.toContain('cs-glow-beta');
    // And EVERY id the card mints is actually referenced, in whichever of the
    // two forms SVG uses: `url(#id)` for a paint server, `href="#id"` for a
    // `<use>`. An unreferenced id is a definition that paints nothing, which
    // is the silent half of getting the namespacing wrong.
    for (const svg of [a, b]) {
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const name of ids) {
        expect(
          svg.includes(`url(#${name})`) || svg.includes(`href="#${name}"`),
          `id ${name} is defined but never referenced`,
        ).toBe(true);
      }
    }
  });

  it('is decorative to a screen reader', () => {
    // The card's accessible name already carries its name, value and rules
    // sentence; a backdrop announcing itself would bury the three facts the
    // player acts on.
    const svg = cardSceneSvg(scene('greenwake_circle_treants_root_walk'), 'x');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
  });

  it('cards that share an art id share a scene', () => {
    // Which is the whole reason `art` is a separate field from the card id on
    // a CardDefinition: two cards may deliberately use one painting.
    const shared = { tribes: ['Beast'] as const };
    expect(buildCardScene({ key: 'shared_art', ...shared })).toEqual(
      buildCardScene({ key: 'shared_art', ...shared }),
    );
  });

  it('keeps every scene inside the panel it is drawn in', () => {
    // A prop or a motif placed off-panel is a scene that renders half empty,
    // and at the hand size that reads as the blank rectangle this replaced.
    for (const def of CARDS) {
      const model: CardSceneModel = buildCardScene({
        key: def.art,
        tribes: def.tribes,
        tags: def.tags,
        set: def.set,
        rarity: def.rarity,
      });
      for (const prop of model.horizon) {
        expect(prop.x, `${def.id} horizon x`).toBeGreaterThanOrEqual(0);
        expect(prop.x, `${def.id} horizon x`).toBeLessThanOrEqual(100);
        expect(prop.scale, `${def.id} horizon scale`).toBeGreaterThan(0);
      }
      for (const motif of model.motifs) {
        expect(motif.x, `${def.id} motif x`).toBeGreaterThanOrEqual(0);
        expect(motif.x, `${def.id} motif x`).toBeLessThanOrEqual(100);
        // Motifs live in the upper half, out of the subject's way.
        expect(motif.y, `${def.id} motif y`).toBeLessThan(50);
        expect(motif.scale, `${def.id} motif scale`).toBeGreaterThan(0);
      }
      // The subject stays on the panel too: half the 40-wide silhouette must
      // not walk off the 96-wide panel.
      expect(Math.abs(model.subjectShift), `${def.id} subject shift`).toBeLessThan(20);
    }
  });
});
