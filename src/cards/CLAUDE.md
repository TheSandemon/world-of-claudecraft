<!-- src/cards/: the standalone Card Duel playtest slice (/cards, cards.html).
     Root CLAUDE.md owns the repo-wide rules (i18n, module-first, determinism);
     src/sim/minigames/card_duel/CLAUDE.md owns the rules engine itself. -->

# src/cards - the Card Duel playtest slice

A world-less table at `/cards`: no login, no server, no 3D world. Instant load,
hot-seat two-sided play, a seed box that reproduces an exact shuffle, computer
opponents, and a scriptable match runner for sweeps.

## The rule that makes this worth having

**It composes the real engine, never a copy.** `slice_core.ts` imports
`src/sim/minigames/card_duel/` and drives the shipping `resolveCardRound`; the
only logic it adds is what a world-less session needs on top (which seat is a
bot, has each side committed, the round log). `src/editor/` is the exemplar: its
viewport composes the real `Sim` and `Renderer` rather than a lookalike.

A drifted harness is worse than no harness. If you find yourself writing a
comparison, a draw rule, or an effect here, it belongs in the engine.

## Shape

| File | What it is |
|---|---|
| `slice_core.ts` | pure, DOM-free session state over the engine; what the tests drive |
| `app.ts` | thin DOM consumer: paints `slice_core` state, routes clicks |
| `main.ts` | entry: loads the locale, mounts the table |
| `styles.css` | slice-local styling; deliberately does NOT load the HUD sheets |

The split is the repo's usual pure-core plus thin-consumer recipe, so the
session logic is testable in plain Node (`tests/cards_slice_core.test.ts`) and
the DOM half stays paint-only.

## It ships

`/cards` is a real route in both `vite.config.ts` and `server/main.ts`, so
playtesters get a URL. That means **every player-visible string is a `t()` key**
in `src/ui/i18n.catalog/cards.ts`, exactly like the guide and the editor. It is
a playtest tool, not a dev-only scratchpad.

## Determinism

The slice owns one `Rng` seeded from the seed box, and hands it to the engine
and the bot policies. Same seed plus same inputs always replays a session move
for move, which is what makes a reported interaction reproducible. Never reach
for `Math.random` or a clock here.
